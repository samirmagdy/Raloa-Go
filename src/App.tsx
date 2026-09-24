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
import { PublicCreatorProfile } from './components/PublicCreatorProfile';
import { InvalidSslFallback } from './components/InvalidSslFallback';
import { AuthenticatedHome } from './components/AuthenticatedHome';
import { useAuth } from './hooks/useAuth';

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
import { initAttribution } from './utils/attribution';

type AppRoute = 'home' | '404' | 'studio' | 'templates' | 'profile' | 'ssl_error';

function resolveInitialRoute(): {
  route: AppRoute;
  handle: string;
  attempted: string;
  authModal?: { open: boolean; mode: 'signin' | 'signup' | 'forgot' | 'reset' };
} {
  if (typeof window === 'undefined') {
    return { route: 'home', handle: '', attempted: '' };
  }

  const path = window.location.pathname;
  const hash = window.location.hash;
  const searchParams = new URLSearchParams(window.location.search);

  // AC-06: SSL Error 526 fallback check
  if (searchParams.get('ssl_error') === '526' || searchParams.get('ssl_error') === 'true') {
    return { route: 'ssl_error', handle: '', attempted: path };
  }

  if (path === '/studio' || path.startsWith('/studio/')) {
    return { route: 'studio', handle: '', attempted: '' };
  }
  if (path === '/templates') {
    return { route: 'templates', handle: '', attempted: '' };
  }
  if (path === '/login') {
    return { route: 'home', handle: '', attempted: '', authModal: { open: true, mode: 'signin' } };
  }
  if (path === '/register') {
    const handleParam = searchParams.get('handle') || (typeof window !== 'undefined' ? sessionStorage.getItem('claimed_handle') || '' : '');
    return { route: 'home', handle: handleParam, attempted: '', authModal: { open: true, mode: 'signup' } };
  }
  if (path === '/forgot-password') {
    return { route: 'home', handle: '', attempted: '', authModal: { open: true, mode: 'forgot' } };
  }
  if (path === '/reset-password') {
    return { route: 'home', handle: '', attempted: '', authModal: { open: true, mode: 'reset' } };
  }
  if (path === '/features' || path === '/pricing' || path === '/guides' || path === '/about' || path === '/contact') {
    return { route: 'home', handle: '', attempted: '' };
  }

  // Handle route check: /@handle or /public-render/handle (FR-1.4)
  const handleMatch = path.match(/^\/(?:@|public-render\/)([a-zA-Z0-9._-]+)$/);
  if (handleMatch) {
    const rawHandle = handleMatch[1].toLowerCase();
    const creatorExists = templatesData.some(
      (t) => t.id.toLowerCase() === rawHandle || t.name.toLowerCase() === rawHandle
    );
    if (creatorExists) {
      return { route: 'profile', handle: rawHandle, attempted: '' };
    }
    // AC-03: Invalid handle -> 404 with Claim this handle CTA
    return { route: '404', handle: rawHandle, attempted: `/@${rawHandle}` };
  }

  if (hash === '#404') {
    return { route: '404', handle: '', attempted: '#404' };
  }
  if (path !== '/' && path !== '' && path !== '/index.html') {
    return { route: '404', handle: '', attempted: path };
  }

  return { route: 'home', handle: '', attempted: '' };
}

function MainApp() {
  const { user } = useAuth();
  const [homeView, setHomeView] = useState<'dashboard' | 'marketing'>('dashboard');
  const [locale, setLocale] = useState<Locale>(() => getInitialLocale());
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => getInitialSoundEnabled());
  const [isLoading, setIsLoading] = useState(true);

  const initialRouteInfo = resolveInitialRoute();
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(initialRouteInfo.route);
  const [profileHandle, setProfileHandle] = useState<string>(initialRouteInfo.handle);
  const [attemptedPath, setAttemptedPath] = useState<string>(initialRouteInfo.attempted);

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
  const [studioOpen, setStudioOpen] = useState(() => typeof window !== 'undefined' && (window.location.pathname === '/studio' || window.location.pathname.startsWith('/studio/')));
  const [studioUsername, setStudioUsername] = useState(() => initialRouteInfo.handle || 'creator');
  const [studioTemplate, setStudioTemplate] = useState<TemplateItem>(templatesData[0]);

  // Attribution & In-App Browser Initialization (FR-2.1, FR-2.2, FR-2.3)
  useEffect(() => {
    initAttribution();
  }, []);


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
    mode: 'signin' | 'signup' | 'forgot' | 'reset';
  }>(() => initialRouteInfo.authModal || { open: false, mode: 'signin' });

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
      const info = resolveInitialRoute();
      setCurrentRoute(info.route);
      setProfileHandle(info.handle);
      setAttemptedPath(info.attempted);
      if (info.route === 'studio') {
        setStudioOpen(true);
      } else {
        setStudioOpen(false);
      }
      if (info.authModal) {
        setAuthModal(info.authModal);
      }
      if (info.handle) {
        setStudioUsername(info.handle);
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
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selected_template_id', template.id);
      sessionStorage.setItem('raloa_selected_template', JSON.stringify(template));
      window.history.pushState(null, '', `/register?template=${encodeURIComponent(template.id)}`);
    }
    setStudioTemplate(template);
    setAuthModal({ open: true, mode: 'signup' });
  };

  const handleSelectPlan = (plan: PricingPlan, isYearly: boolean) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selected_plan', plan.id);
      sessionStorage.setItem('selected_plan_yearly', String(isYearly));
      window.history.pushState(null, '', `/register?plan=${encodeURIComponent(plan.id)}`);
    }
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

      {/* Dedicated Studio page, profile page, SSL error page, 404 page, or standard landing page */}
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
      ) : currentRoute === 'profile' ? (
        <PublicCreatorProfile
          handle={profileHandle}
          locale={locale}
          onClaimHandle={(handle) => {
            setStudioUsername(handle);
            setAuthModal({ open: true, mode: 'signup' });
          }}
          onReturnHome={handleReturnHome}
          onNotFound={(handle) => {
            setCurrentRoute('404');
            setAttemptedPath(`/@${handle}`);
          }}
        />
      ) : currentRoute === 'ssl_error' ? (
        <InvalidSslFallback
          locale={locale}
          onReturnHome={handleReturnHome}
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
          onClaimHandle={(handle) => {
            setStudioUsername(handle);
            setAuthModal({ open: true, mode: 'signup' });
          }}
        />
      ) : user && homeView === 'dashboard' ? (
        <>
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
            <AuthenticatedHome
              locale={locale}
              theme={theme}
              onOpenStudio={handleOpenStudio}
              onOpenTemplates={handleOpenTemplates}
              onOpenPricing={() => {
                const el = document.getElementById('pricing');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                } else {
                  handleSelectPlan(pricingPlans[1], false);
                }
              }}
              onSwitchToMarketing={() => setHomeView('marketing')}
            />
          </main>

          {/* Footer */}
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
        </>
      ) : (

        <>
          {/* Floating banner when logged in and browsing public marketing page */}
          {user && (
            <div className="sticky top-20 z-30 bg-gradient-to-r from-indigo-950/95 via-slate-900/95 to-indigo-950/95 backdrop-blur-md text-white text-xs py-2 px-4 flex items-center justify-between border-b border-indigo-500/20 shadow-md">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {locale === 'ar'
                    ? 'أنت تستعرض الصفحة الترويجية العامة الآن.'
                    : 'You are currently browsing the public marketing page.'}
                </span>
              </span>
              <button
                onClick={() => setHomeView('dashboard')}
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm transition-all hover:scale-105 active:scale-95"
              >
                {locale === 'ar' ? 'العودة إلى لوحة التحكم ←' : 'Return to Dashboard →'}
              </button>
            </div>
          )}

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
          initialHandle={studioUsername}
          initialTemplate={studioTemplate?.id}
          resetToken={typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') || '' : ''}
          locale={locale}
          onClose={() => {
            setAuthModal({ open: false, mode: 'signin' });
            if (typeof window !== 'undefined' && ['/login', '/register', '/forgot-password', '/reset-password'].includes(window.location.pathname)) {
              window.history.pushState(null, '', '/');
            }
          }}
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
