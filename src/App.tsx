import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Locale, TemplateItem, PricingPlan } from './types';
import { templatesData, pricingPlans } from './data/content';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { TrustAndBenefits } from './components/TrustAndBenefits';
import { TemplateGallery } from './components/TemplateGallery';
import { TemplatesPage } from './components/TemplatesPage';
import { HowItWorks } from './components/HowItWorks';
import { FeatureGrid } from './components/FeatureGrid';
import { Testimonials } from './components/Testimonials';
import { PricingTable } from './components/PricingTable';
import { FAQAccordion } from './components/FAQAccordion';
import { Newsletter } from './components/Newsletter';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import { ScrollProgressBar } from './components/ScrollProgressBar';
import { ScrollSpyDots } from './components/ScrollSpyDots';
import { BackToTop } from './components/BackToTop';
import { FadeInSection } from './components/FadeInSection';
import { NotFound } from './components/NotFound';

// Interactive Modals
const CommandPaletteModal = lazy(() => import('./components/modals/CommandPaletteModal').then((m) => ({ default: m.CommandPaletteModal })));
const StudioModal = lazy(() => import('./components/modals/StudioModal').then((m) => ({ default: m.StudioModal })));
const TemplatePreviewModal = lazy(() => import('./components/modals/TemplatePreviewModal').then((m) => ({ default: m.TemplatePreviewModal })));
const PlanCheckoutModal = lazy(() => import('./components/modals/PlanCheckoutModal').then((m) => ({ default: m.PlanCheckoutModal })));
const MiniSiteDemoModal = lazy(() => import('./components/modals/MiniSiteDemoModal').then((m) => ({ default: m.MiniSiteDemoModal })));
const AuthModal = lazy(() => import('./components/modals/AuthModal').then((m) => ({ default: m.AuthModal })));
const ContactModal = lazy(() => import('./components/modals/ContactModal').then((m) => ({ default: m.ContactModal })));
const LegalModal = lazy(() => import('./components/modals/LegalModal').then((m) => ({ default: m.LegalModal })));
const KeyboardShortcutsModal = lazy(() => import('./components/modals/KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal })));
const ProjectStatsModal = lazy(() => import('./components/modals/ProjectStatsModal').then((m) => ({ default: m.ProjectStatsModal })));
const ReferralModal = lazy(() => import('./components/modals/ReferralModal').then((m) => ({ default: m.ReferralModal })));
import { EasterEggOverlay } from './components/EasterEggOverlay';
import { LoadingOverlay } from './components/LoadingOverlay';
import { CustomCursor } from './components/CustomCursor';
import { getInitialLocale, persistLocale } from './utils/locale';
import { Theme, getInitialTheme, applyTheme } from './utils/theme';
import { getInitialSoundEnabled, persistSoundEnabled, ambientSound } from './utils/audio';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useGlobalKeyboardListener } from './hooks/useGlobalKeyboardListener';
import { useSEO } from './hooks/useSEO';
import { useVoiceTour } from './hooks/useVoiceTour';
import { VoiceTourToggle } from './components/VoiceTourToggle';
import { AuthProvider } from './contexts/AuthContext';
import { recordPageView, recordLinkClick } from './lib/firebase';

function MainApp() {
  const [locale, setLocale] = useState<Locale>(() => getInitialLocale());
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => getInitialSoundEnabled());
  const [isLoading, setIsLoading] = useState(true);

  // Client Routing State for Handling 404 and Broken Links Gracefully
  const [currentRoute, setCurrentRoute] = useState<'home' | '404' | 'studio' | 'templates'>(() => {
    if (typeof window === 'undefined') return 'home';
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path === '/studio') return 'studio';
    if (path === '/templates') return 'templates';
    if (hash === '#404') return '404';
    if (path !== '/' && path !== '' && path !== '/index.html') return '404';
    return 'home';
  });

  useEffect(() => {
    const activePath = typeof window !== 'undefined' ? window.location.pathname : '/';
    recordPageView(activePath || '/');
  }, [currentRoute]);

  const [attemptedPath, setAttemptedPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path !== '/' && path !== '' && path !== '/index.html') return path;
    if (hash === '#404') return '#404';
    return '';
  });

  // Dynamic Section-Aware SEO Hook (updates document.title, canonical URL, OG, Twitter tags)
  useSEO({
    locale,
    customTitle:
      currentRoute === '404'
        ? locale === 'ar'
          ? '٤٠٤: الصفحة غير موجودة — RALOA'
          : '404: Page Not Found — RALOA'
        : currentRoute === 'templates'
          ? locale === 'ar'
            ? 'معرض قوالب رالوا — جميع التصاميم'
            : 'All Templates — RALOA Design Gallery'
          : undefined,
    customDescription:
      currentRoute === '404'
        ? locale === 'ar'
          ? 'عذراً، الصفحة المطلوبة غير متوفرة. عد إلى الصفحة الرئيسية لرالوا.'
          : 'The link you followed may be broken. Return to RALOA home.'
        : currentRoute === 'templates'
          ? locale === 'ar'
            ? 'استعرض جميع قوالب رالوا واختر التصميم المناسب لموقعك المصغر.'
            : 'Browse every RALOA template and choose the right design for your mini-site.'
          : undefined
  });

  // Web Speech API Voice-over Tour Hook
  const {
    isEnabled: voiceTourEnabled,
    isSpeaking: voiceTourSpeaking,
    currentSection: tourSection,
    toggleTour,
    replayCurrent
  } = useVoiceTour({ locale });

  // Modal States
  const [studioOpen, setStudioOpen] = useState(() => typeof window !== 'undefined' && window.location.pathname === '/studio');
  const [studioUsername, setStudioUsername] = useState('creator');
  const [studioTemplate, setStudioTemplate] = useState<TemplateItem>(templatesData[0]);

  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const templateParam = params.get('template') || params.get('preview');
    if (templateParam) {
      const match = templatesData.find(
        (t) => t.id.toLowerCase() === templateParam.toLowerCase() || t.name.toLowerCase() === templateParam.toLowerCase()
      );
      if (match) return match;
    }
    if (window.location.hash.startsWith('#template-')) {
      const templateId = window.location.hash.replace('#template-', '');
      const match = templatesData.find(
        (t) => t.id.toLowerCase() === templateId.toLowerCase() || t.name.toLowerCase() === templateId.toLowerCase()
      );
      if (match) return match;
    }
    return null;
  });

  const [selectedPlanState, setSelectedPlanState] = useState<{
    plan: PricingPlan;
    isYearly: boolean;
  } | null>(null);

  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: 'signin' | 'signup';
  }>({ open: false, mode: 'signin' });

  const [contactOpen, setContactOpen] = useState(false);
  const [legalTitle, setLegalTitle] = useState<string | null>(null);

  const [phoneAction, setPhoneAction] = useState<{
    type: 'portfolio' | 'booking' | 'shop' | 'gear';
    data?: any;
  } | null>(null);

  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [projectStatsOpen, setProjectStatsOpen] = useState(false);
  const [referralModalOpen, setReferralModalOpen] = useState(false);

  // Hidden Easter Egg state (listening for 'RALOA' or Konami Code)
  const [easterEggActive, setEasterEggActive] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const eggParam = params.get('egg') || params.get('easter_egg');
    return eggParam ? eggParam.toUpperCase() : null;
  });

  // Global listener for secret key sequence (e.g. 'RALOA' or Konami Code: ↑↑↓↓←→←→BA)
  const { reset: resetEasterEgg, trigger: triggerEasterEgg } = useGlobalKeyboardListener({
    onTrigger: (sequenceName) => {
      setEasterEggActive(sequenceName);
    }
  });

  // Synchronize document direction, lang attribute and persistence with selected locale
  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    persistLocale(locale);
  }, [locale]);

  // Initial page load branded overlay dismissal
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 750);

    return () => clearTimeout(timer);
  }, []);

  // Synchronize theme with document element and persistence
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Synchronize ambient audio engine and persistence with soundEnabled state
  useEffect(() => {
    persistSoundEnabled(soundEnabled);
    if (soundEnabled) {
      ambientSound.start();
    } else {
      ambientSound.stop();
    }
  }, [soundEnabled]);

  // If user previously enabled sound, resume on first interaction (respecting browser autoplay policies)
  useEffect(() => {
    if (!soundEnabled) return;

    const handleFirstInteraction = () => {
      if (soundEnabled && !ambientSound.getStatus()) {
        ambientSound.start();
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [soundEnabled]);

  // Listen to popstate and hashchange events for browser history back/forward navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === '/studio') {
        setStudioOpen(true);
        setCurrentRoute('studio');
      } else if (path === '/templates') {
        setStudioOpen(false);
        setCurrentRoute('templates');
      } else if (hash === '#404' || (path !== '/' && path !== '' && path !== '/index.html')) {
        setStudioOpen(false);
        setCurrentRoute('404');
        setAttemptedPath(path !== '/' && path !== '' ? path : hash);
      } else {
        setStudioOpen(false);
        setCurrentRoute('home');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleReturnHome = () => {
    setCurrentRoute('home');
    setAttemptedPath('');
    if (window.location.pathname !== '/' || window.location.hash !== '') {
      window.history.pushState(null, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenTemplates = () => {
    setCurrentRoute('templates');
    setAttemptedPath('');
    setStudioOpen(false);
    if (window.location.pathname !== '/templates') {
      window.history.pushState(null, '', '/templates');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToSection = (sectionId: string) => {
    setCurrentRoute('home');
    setAttemptedPath('');
    if (window.location.pathname !== '/' || window.location.hash !== '') {
      window.history.pushState(null, '', `/#${sectionId}`);
    }
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 60);
  };

  const handleTriggerNotFound = (path: string) => {
    setAttemptedPath(path);
    setCurrentRoute('404');
    const formattedUrl = path.startsWith('/') ? path : `/${path.replace(/^#/, '')}`;
    window.history.pushState(null, '', formattedUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleToggleSound = () => {
    setSoundEnabled((prev) => !prev);
  };

  const handleSelectLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    persistLocale(newLocale);
  };

  const toggleLocale = () => {
    const next = locale === 'en' ? 'ar' : 'en';
    handleSelectLocale(next);
  };

  const handleOpenStudio = (username?: string, template?: TemplateItem) => {
    if (username) setStudioUsername(username);
    if (template) setStudioTemplate(template);
    setStudioOpen(true);
    setCurrentRoute('studio');
    if (window.location.pathname !== '/studio') {
      window.history.pushState(null, '', '/studio');
    }
  };

  const handleCloseStudio = () => {
    setStudioOpen(false);
    setCurrentRoute('home');
    setAttemptedPath('');
    if (window.location.pathname === '/studio') {
      window.history.pushState(null, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTemplate = (template: TemplateItem) => {
    recordLinkClick(template.id, template.name, 'template_gallery');
    setPreviewTemplate(template);
    const params = new URLSearchParams(window.location.search);
    params.set('template', template.id);
    window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
  };

  const handleClosePreviewTemplate = () => {
    setPreviewTemplate(null);
    const params = new URLSearchParams(window.location.search);
    if (params.has('template') || params.has('preview')) {
      params.delete('template');
      params.delete('preview');
      const newQuery = params.toString() ? `?${params.toString()}` : '';
      window.history.pushState(null, '', `${window.location.pathname}${newQuery}`);
    }
  };

  const handleUseTemplateFromPreview = (template: TemplateItem) => {
    handleClosePreviewTemplate();
    handleOpenStudio(undefined, template);
  };

  const handleSelectPlan = (plan: PricingPlan, isYearly: boolean) => {
    setSelectedPlanState({ plan, isYearly });
  };

  const handleConfirmPlan = (plan: PricingPlan) => {
    setSelectedPlanState(null);
    handleOpenStudio();
  };

  // Determine if any modal is currently open
  const isAnyModalOpen = Boolean(
    commandPaletteOpen ||
    easterEggActive ||
    shortcutsModalOpen ||
    legalTitle ||
    phoneAction ||
    authModal.open ||
    selectedPlanState ||
    contactOpen ||
    previewTemplate
  );

  // Close the active modal in priority order (topmost first)
  const closeTopModal = () => {
    if (studioOpen) {
      handleCloseStudio();
      return;
    }
    if (commandPaletteOpen) {
      setCommandPaletteOpen(false);
      return;
    }
    if (easterEggActive) {
      setEasterEggActive(null);
      resetEasterEgg();
      return;
    }
    if (shortcutsModalOpen) {
      setShortcutsModalOpen(false);
      return;
    }
    if (legalTitle) {
      setLegalTitle(null);
      return;
    }
    if (phoneAction) {
      setPhoneAction(null);
      return;
    }
    if (authModal.open) {
      setAuthModal({ open: false, mode: 'signin' });
      return;
    }
    if (selectedPlanState) {
      setSelectedPlanState(null);
      return;
    }
    if (contactOpen) {
      setContactOpen(false);
      return;
    }
    if (previewTemplate) {
      handleClosePreviewTemplate();
      return;
    }
    if (studioOpen) {
      handleCloseStudio();
      return;
    }
  };

  // Register global keyboard shortcuts for accessibility and rapid navigation
  useKeyboardShortcuts([
    {
      key: 'Escape',
      description: 'Close active modal or return home',
      ignoreInInputs: false,
      preventDefault: true,
      handler: () => {
        if (studioOpen || isAnyModalOpen) {
          closeTopModal();
        } else if (currentRoute === '404') {
          handleReturnHome();
        } else if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    },
    {
      key: 't',
      description: 'Toggle theme (dark / light)',
      ignoreInInputs: true,
      handler: () => {
        handleToggleTheme();
      }
    },
    {
      key: 'l',
      description: 'Toggle language (English / Arabic)',
      ignoreInInputs: true,
      handler: () => {
        toggleLocale();
      }
    },
    {
      key: 'm',
      description: 'Toggle ambient sound (mute / unmute)',
      ignoreInInputs: true,
      handler: () => {
        handleToggleSound();
      }
    },
    {
      key: 'v',
      description: 'Toggle voice-over tour narration',
      ignoreInInputs: true,
      handler: () => {
        toggleTour();
      }
    },
    {
      key: 'h',
      description: 'Scroll to top or return home',
      ignoreInInputs: true,
      handler: () => {
        if (currentRoute === '404') {
          handleReturnHome();
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    },
    {
      key: 'k',
      metaOrCtrlKey: true,
      description: 'Open searchable command palette and quick jump',
      ignoreInInputs: false,
      preventDefault: true,
      handler: () => {
        setCommandPaletteOpen((prev) => !prev);
      }
    },
    {
      key: '?',
      description: 'Show / hide keyboard shortcuts',
      ignoreInInputs: true,
      handler: () => {
        setShortcutsModalOpen((prev) => !prev);
      }
    }
  ]);

  return (
    <div className={`min-h-screen bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 transition-colors duration-200 ${locale === 'ar' ? 'font-sans' : 'font-sans'}`}>
      
      {/* Keep the editor canvas clean: the system cursor remains available in Studio. */}
      {!studioOpen && <CustomCursor theme={theme} />}

      {/* Global Branded Loading Overlay */}
      <LoadingOverlay isLoading={isLoading} locale={locale} theme={theme} />

      {/* Dedicated Studio page, 404 page, or standard landing page */}
      {currentRoute === 'studio' ? (
        <Suspense fallback={<LoadingOverlay isLoading locale={locale} theme={theme} />}>
          <StudioModal
            initialUsername={studioUsername}
            initialTemplate={studioTemplate}
            locale={locale}
            onClose={handleCloseStudio}
          />
        </Suspense>
      ) : currentRoute === 'templates' ? (
        <TemplatesPage
          locale={locale}
          onReturnHome={handleReturnHome}
          onSelectTemplate={handleSelectTemplate}
        />
      ) : currentRoute === '404' ? (
        <NotFound
          locale={locale}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onSelectLocale={handleSelectLocale}
          onReturnHome={handleReturnHome}
          onNavigateToSection={handleNavigateToSection}
          attemptedPath={attemptedPath}
        />
      ) : (
        <>
          {/* 00 Fixed Viewport Scroll Progress Bar */}
          <ScrollProgressBar isRtl={locale === 'ar'} />

      {/* Vertical Scroll-Spy Indicator Dots */}
      <ScrollSpyDots locale={locale} />

      {/* 01 Sticky Navigation Header */}
      <Header
        locale={locale}
        onSelectLocale={handleSelectLocale}
        onToggleLocale={toggleLocale}
        onOpenStudio={(user) => handleOpenStudio(user)}
        onOpenAuth={(mode) => setAuthModal({ open: true, mode: mode || 'signin' })}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        voiceTourEnabled={voiceTourEnabled}
        voiceTourSpeaking={voiceTourSpeaking}
        onToggleVoiceTour={toggleTour}
        currentSection={tourSection}
        onReplayVoiceTour={replayCurrent}
      />

      <main>
        {/* 01 Hero Section with dynamic motion entrance & scroll parallax */}
        <FadeInSection id="hero-reveal" threshold={0.01} rootMargin="0px 0px -20px 0px">
          <Hero
            locale={locale}
            heroTemplate={templatesData[0]}
            onOpenStudio={handleOpenStudio}
            onOpenPhoneAction={(type, data) => setPhoneAction({ type, data })}
          />
        </FadeInSection>

        {/* 02 Trust & Benefits Section with Auto-Scrolling Marquee */}
        <FadeInSection id="trust-reveal">
          <TrustAndBenefits
            locale={locale}
            onOpenPublishedSite={(site) => {
              const username = site.handle.replace('raloa.app/@', '');
              handleOpenStudio(username);
            }}
          />
        </FadeInSection>

        {/* 03 Templates Carousel Section */}
        <FadeInSection id="templates-reveal">
          <TemplateGallery
            locale={locale}
            onSelectTemplate={handleSelectTemplate}
            onBrowseAll={handleOpenTemplates}
          />
        </FadeInSection>

        {/* 04 How It Works Section */}
        <FadeInSection id="how-it-works-reveal">
          <HowItWorks locale={locale} />
        </FadeInSection>

        {/* 05 Feature Grid Section */}
        <FadeInSection id="features-reveal">
          <FeatureGrid
            locale={locale}
            onExploreFeatures={() => {
              const pricingEl = document.getElementById('pricing');
              pricingEl?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </FadeInSection>

        {/* 06 Testimonials Section */}
        <FadeInSection id="testimonials-reveal">
          <Testimonials
            locale={locale}
            onSeeMoreStories={() => {
              handleSelectTemplate(templatesData[1]);
            }}
          />
        </FadeInSection>

        {/* 07 Pricing Table Section */}
        <FadeInSection id="pricing-reveal">
          <PricingTable
            locale={locale}
            onSelectPlan={handleSelectPlan}
          />
        </FadeInSection>

        {/* 08 FAQ Accordion Section */}
        <FadeInSection id="faq-reveal">
          <FAQAccordion
            locale={locale}
            onContactSupport={() => setContactOpen(true)}
          />
        </FadeInSection>

        {/* 09 Newsletter Signup Section */}
        <FadeInSection id="newsletter-reveal">
          <Newsletter locale={locale} />
        </FadeInSection>

        {/* 10 Final CTA Banner */}
        <FadeInSection id="final-cta-reveal">
          <FinalCTA
            locale={locale}
            onOpenStudio={handleOpenStudio}
          />
        </FadeInSection>
      </main>

      {/* 10 Footer */}
      <FadeInSection id="footer-reveal">
        <Footer
          locale={locale}
          onOpenPrivacyTerms={(title) => setLegalTitle(title)}
          onOpenShortcuts={() => setShortcutsModalOpen(true)}
          onOpenStats={() => setProjectStatsOpen(true)}
          onOpenReferral={() => setReferralModalOpen(true)}
          onTriggerNotFound={handleTriggerNotFound}
        />
      </FadeInSection>

      {/* Floating Back to Top Button */}
      <BackToTop locale={locale} />

      {/* Floating Voice-over Tour Controller Widget */}
      <VoiceTourToggle
        enabled={voiceTourEnabled}
        isSpeaking={voiceTourSpeaking}
        onToggle={toggleTour}
        currentSection={tourSection}
        onReplay={replayCurrent}
        variant="floating"
        locale={locale}
      />
    </>
  )}

      {/* --- REAL INTERACTIVE MODALS (0% FAKE IMPLEMENTATION) --- */}

      <Suspense fallback={null}>
      {/* Project Analytics & Stats Modal (Recharts) */}
      <ProjectStatsModal
        isOpen={projectStatsOpen}
        locale={locale}
        onClose={() => setProjectStatsOpen(false)}
        onOpenStudio={() => handleOpenStudio()}
      />

      {/* Keyboard Shortcuts Reference Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        locale={locale}
        onClose={() => setShortcutsModalOpen(false)}
        onTriggerEasterEgg={() => triggerEasterEgg('RALOA')}
      />

      {/* Template Preview Details Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          locale={locale}
          onClose={handleClosePreviewTemplate}
          onUseTemplate={handleUseTemplateFromPreview}
        />
      )}

      {/* Plan Checkout & Activation Modal */}
      {selectedPlanState && (
        <PlanCheckoutModal
          plan={selectedPlanState.plan}
          isYearly={selectedPlanState.isYearly}
          locale={locale}
          onClose={() => setSelectedPlanState(null)}
          onConfirmPlan={handleConfirmPlan}
        />
      )}

      {/* Hero Phone Interactive Link Modal (Elena's Portfolio, Booking, Shop) */}
      {phoneAction && (
        <MiniSiteDemoModal
          type={phoneAction.type}
          locale={locale}
          onClose={() => setPhoneAction(null)}
          onStartOwnPage={(uname) => {
            setPhoneAction(null);
            handleOpenStudio(uname);
          }}
        />
      )}

      {/* Authentication Modal */}
      {authModal.open && (
        <AuthModal
          initialMode={authModal.mode}
          locale={locale}
          onClose={() => setAuthModal({ open: false, mode: 'signin' })}
          onSuccess={(email) => {
            setAuthModal({ open: false, mode: 'signin' });
            handleOpenStudio(email.split('@')[0]);
          }}
        />
      )}

      {/* Contact Support Modal */}
      {contactOpen && (
        <ContactModal
          locale={locale}
          onClose={() => setContactOpen(false)}
        />
      )}

      {/* Legal & Terms Modal */}
      {legalTitle && (
        <LegalModal
          title={legalTitle}
          locale={locale}
          onClose={() => setLegalTitle(null)}
        />
      )}

      {/* Refer-a-Friend Rewards Modal */}
      {referralModalOpen && (
        <ReferralModal
          isOpen={referralModalOpen}
          locale={locale}
          onClose={() => setReferralModalOpen(false)}
        />
      )}

      {/* Secret Easter Egg Celebration Overlay */}
      <EasterEggOverlay
        isOpen={Boolean(easterEggActive)}
        sequenceName={easterEggActive}
        locale={locale}
        onClose={() => {
          setEasterEggActive(null);
          resetEasterEgg();
        }}
      />

      {/* Global Searchable Command Palette (Cmd+K) */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        locale={locale}
        theme={theme}
        onNavigateToSection={handleNavigateToSection}
        onSelectTemplate={handleSelectTemplate}
        onOpenStudio={(user, template) => handleOpenStudio(user, template)}
        onOpenAuth={(mode) => setAuthModal({ open: true, mode: mode || 'signin' })}
        onToggleTheme={handleToggleTheme}
        onToggleSound={handleToggleSound}
        soundEnabled={soundEnabled}
        voiceTourEnabled={voiceTourEnabled}
        onToggleVoiceTour={toggleTour}
        onToggleLocale={toggleLocale}
        onOpenShortcuts={() => setShortcutsModalOpen(true)}
      />
      </Suspense>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
