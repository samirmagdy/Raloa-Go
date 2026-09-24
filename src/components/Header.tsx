
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Menu,
  X,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Check,
  LayoutDashboard,
  Smartphone,
  BarChart2,
  Zap,
  Edit3,
  Palette,
  ExternalLink,
  Copy,
  Sparkles
} from 'lucide-react';
import { PremiumMark } from './brand/PremiumMark';
import { RaloaLogo } from './brand/RaloaLogo';
import { LanguageDropdown } from './LanguageDropdown';
import { Locale } from '../types';
import { Theme } from '../utils/theme';
import { dictionary } from '../data/content';
import { useAuth } from '../hooks/useAuth';
import { useMotionValueEvent, useScroll } from 'motion/react';

interface HeaderProps {
  locale: Locale;
  onToggleLocale?: () => void;
  onSelectLocale: (locale: Locale) => void;
  onOpenStudio: (username?: string) => void;
  onOpenTemplates?: () => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onOpenCommandPalette?: () => void;
  onNavigateToSection?: (sectionId: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  voiceTourEnabled?: boolean;
  voiceTourSpeaking?: boolean;
  onToggleVoiceTour?: () => void;
  currentSection?: string;
  onReplayVoiceTour?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  locale,
  onToggleLocale,
  onSelectLocale,
  onOpenStudio,
  onOpenTemplates,
  onOpenAuth,
  onNavigateToSection,
  theme,
}) => {
  const { user, profile, logOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [copiedLink, setCopiedLink] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();

  const isRtl = locale === 'ar';
  const isDark = theme === 'dark';
  const t = dictionary[locale].nav;

  // Clean user handle and public URL
  const rawUsername = profile?.handle || (user?.email ? user.email.split('@')[0] : 'creator');
  const cleanHandle = rawUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const publicProfileUrl = `https://raloa.app/@${cleanHandle}`;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(publicProfileUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLanguage = (newLocale: Locale) => {
    if (onSelectLocale) {
      onSelectLocale(newLocale);
    } else if (onToggleLocale && newLocale !== locale) {
      onToggleLocale();
    }
  };

  useMotionValueEvent(scrollY, 'change', (value) => {
    setScrolled(value > 20);
  });

  // Track active dashboard section for authenticated user
  useEffect(() => {
    if (!user) return;
    const sectionIds: Array<{ id: string; key: string }> = [
      { id: 'personal-dashboard', key: 'dashboard' },
      { id: 'site-overview', key: 'site-overview' },
      { id: 'analytics-summary', key: 'analytics' },
      { id: 'quick-actions', key: 'quick-actions' }
    ];

    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const section = sectionIds.find((item) => item.id === visible.target.id);
        if (section) setActiveSection(section.key);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0.15, 0.5, 0.85] }
    );
    sectionIds.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [user]);

  const authenticatedNavLinks = [
    {
      id: 'dashboard',
      label: isRtl ? 'لوحة التحكم' : 'Dashboard',
      icon: LayoutDashboard,
      href: '#personal-dashboard',
      onClick: () => {
        setActiveSection('dashboard');
        if (onNavigateToSection) {
          onNavigateToSection('personal-dashboard');
        } else {
          const el = document.getElementById('personal-dashboard');
          if (el) {
            const topOffset = 80;
            const elementPosition = el.getBoundingClientRect().top;
            window.scrollTo({ top: elementPosition + document.documentElement.scrollTop - topOffset, behavior: 'smooth' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      }
    },
    {
      id: 'site-overview',
      label: isRtl ? 'موقعي' : 'My Site',
      icon: Smartphone,
      href: '#site-overview',
      onClick: () => {
        setActiveSection('site-overview');
        if (onNavigateToSection) {
          onNavigateToSection('site-overview');
        } else {
          const el = document.getElementById('site-overview');
          if (el) {
            const topOffset = 80;
            const elementPosition = el.getBoundingClientRect().top;
            window.scrollTo({ top: elementPosition + document.documentElement.scrollTop - topOffset, behavior: 'smooth' });
          }
        }
      }
    },
    {
      id: 'analytics',
      label: isRtl ? 'الإحصائيات' : 'Analytics',
      icon: BarChart2,
      href: '#analytics-summary',
      onClick: () => {
        setActiveSection('analytics');
        if (onNavigateToSection) {
          onNavigateToSection('analytics-summary');
        } else {
          const el = document.getElementById('analytics-summary');
          if (el) {
            const topOffset = 80;
            const elementPosition = el.getBoundingClientRect().top;
            window.scrollTo({ top: elementPosition + document.documentElement.scrollTop - topOffset, behavior: 'smooth' });
          }
        }
      }
    },
    {
      id: 'quick-actions',
      label: isRtl ? 'إجراءات سريعة' : 'Quick Actions',
      icon: Zap,
      href: '#quick-actions',
      onClick: () => {
        setActiveSection('quick-actions');
        if (onNavigateToSection) {
          onNavigateToSection('quick-actions');
        } else {
          const el = document.getElementById('quick-actions');
          if (el) {
            const topOffset = 80;
            const elementPosition = el.getBoundingClientRect().top;
            window.scrollTo({ top: elementPosition + document.documentElement.scrollTop - topOffset, behavior: 'smooth' });
          }
        }
      }
    },
    {
      id: 'templates',
      label: isRtl ? 'القوالب' : 'Templates',
      icon: Palette,
      href: '/templates',
      onClick: () => {
        if (onOpenTemplates) {
          onOpenTemplates();
        } else {
          window.location.href = '/templates';
        }
      }
    }
  ];

  const guestNavLinks = [
    { id: 'templates', label: t.templates, href: '#templates', icon: Palette, onClick: undefined },
    { id: 'features', label: t.features, href: '#features', icon: Sparkles, onClick: undefined },
    { id: 'how-it-works', label: t.howItWorks, href: '#how-it-works', icon: Zap, onClick: undefined },
    { id: 'pricing', label: t.pricing, href: '#pricing', icon: PremiumMark, onClick: undefined },
    { id: 'faq', label: t.resources, href: '#faq', icon: UserIcon, onClick: undefined }
  ];

  const navLinks = user ? authenticatedNavLinks : guestNavLinks;

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: { href: string; onClick?: () => void }) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (link.onClick) {
      link.onClick();
      return;
    }
    const element = document.querySelector(link.href);
    if (element) {
      const topOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + document.documentElement.scrollTop - topOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 h-[64px] transition-all duration-200 ${
          scrolled
            ? 'bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-850 shadow-[0_4px_20px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)]'
            : 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs border-b border-transparent'
        }`}
      >
        <div className="max-w-[1400px] w-full h-full mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
          {/* Left Section: Brand Logo & Desktop Nav */}
          <div className="flex items-center gap-3 lg:gap-5 xl:gap-6 min-w-0 flex-1">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg group"
              aria-label="RALOA Home"
            >
              <img
                src="/graphics/navbar-logo.png"
                alt="RALOA"
                width="720"
                height="180"
                className="h-7 sm:h-8 w-auto object-contain dark:hidden"
                draggable={false}
              />
              <img
                src="/brand/raloa-logo-horizontal-on-dark.png"
                alt="RALOA"
                width="630"
                height="280"
                className="hidden h-7 sm:h-8 w-auto object-contain dark:block"
                draggable={false}
              />
            </a>

            {/* Desktop Navigation Links */}
            <nav className="hidden xl:flex items-center gap-1 min-w-0" aria-label="Main Navigation">
              {navLinks.map((link) => {
                const isActive = user ? activeSection === link.id : false;
                const IconComponent = (link as any).icon;
                // Allow tertiary items like Quick Actions & Templates to hide gracefully on tighter desktop screens if needed
                const isSecondary = link.id === 'quick-actions' || link.id === 'templates';
                return (
                  <a
                    key={link.id || link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link)}
                    className={`inline-flex items-center gap-1.5 px-2.5 2xl:px-3 py-1.5 rounded-full text-[13px] 2xl:text-[14px] font-medium transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                      isSecondary ? 'hidden 2xl:inline-flex' : ''
                    } ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {IconComponent && user && (
                      <IconComponent
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      />
                    )}
                    <span>{link.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 xl:gap-2.5 shrink-0 z-10">
            {/* Language Switcher Dropdown */}
            <LanguageDropdown
              currentLocale={locale}
              onSelectLocale={handleSelectLanguage}
              variant="header"
            />

            {/* User Account / Sign In */}
            {user ? (
              <div className="relative hidden sm:block" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="inline-flex items-center gap-1.5 sm:gap-2 pl-2 pr-2.5 xl:pr-3 rtl:pl-3 rtl:pr-2 py-1.5 sm:py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
                  aria-expanded={userDropdownOpen}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover ring-1 ring-indigo-500"
                    />
                  ) : (
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] sm:text-[11px] font-bold">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-[12px] sm:text-[13px] font-bold text-slate-800 dark:text-white max-w-[65px] lg:max-w-[85px] truncate">
                    {user.displayName || user.email?.split('@')[0] || 'Account'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    {profile?.plan || 'Free'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div
                    className={`absolute ${
                      isRtl ? 'left-0' : 'right-0'
                    } top-full mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150`}
                  >
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {user.displayName || 'Creator'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <PremiumMark className="w-3 h-3" />
                          <span className="capitalize">{profile?.plan || 'Free'} Plan</span>
                        </div>
                        <span className="text-[10px] text-slate-400">@{cleanHandle}</span>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onOpenStudio();
                        }}
                        className="w-full px-4 py-2 text-left rtl:text-right text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{isRtl ? 'الاستوديو (محرر الموقع)' : 'Open Studio (Editor)'}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180 text-slate-400" />
                      </button>

                      <a
                        href={publicProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setUserDropdownOpen(false)}
                        className="w-full px-4 py-2 text-left rtl:text-right text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                          <span>{isRtl ? 'زيارة موقعي المباشر' : 'View Public Site'}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180 text-slate-400" />
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          handleCopyLink();
                        }}
                        className="w-full px-4 py-2 text-left rtl:text-right text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {copiedLink ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>
                            {copiedLink
                              ? isRtl
                                ? 'تم نسخ الرابط!'
                                : 'Link Copied!'
                              : isRtl
                              ? 'نسخ رابط موقعي'
                              : 'Copy Site Link'}
                          </span>
                        </div>
                      </button>
                    </div>

                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          logOut();
                        }}
                        className="w-full px-4 py-2 text-left rtl:text-right text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'تسجيل الخروج' : 'Sign Out'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => onOpenAuth('signin')}
                className="hidden sm:inline-flex text-[14px] font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 sm:px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                {t.signIn}
              </button>
            )}

            {/* Primary CTA Button */}
            <button
              onClick={() => onOpenStudio()}
              className="hidden sm:inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 xl:px-5 py-2 xl:py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-[13px] xl:text-[14px] font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer whitespace-nowrap"
            >
              {user ? (
                <>
                  <Edit3 className="w-4 h-4 text-indigo-400 dark:text-indigo-600" />
                  <span>{isRtl ? 'فتح الاستوديو' : 'Open Studio'}</span>
                </>
              ) : (
                <>
                  <span>{t.createPage}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </>
              )}
            </button>

            {/* Mobile / Tablet Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="xl:hidden min-w-11 min-h-11 p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 xl:hidden bg-slate-950/60 backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className={`fixed top-0 bottom-0 ${
              isRtl ? 'left-0' : 'right-0'
            } w-[320px] max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-900 shadow-2xl p-5 sm:p-6 flex flex-col justify-between transition-transform duration-300 ease-out border-s border-slate-200 dark:border-slate-800`}
            onClick={(e) => e.stopPropagation()}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <div>
              <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800">
                <RaloaLogo isRtl={isRtl} size="sm" theme={isDark ? 'on-dark' : 'primary'} />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links in Mobile Drawer */}
              <nav className="mt-5 flex flex-col space-y-1.5" aria-label="Mobile Navigation">
                {navLinks.map((link) => {
                  const isActive = user ? activeSection === link.id : false;
                  const IconComp = (link as any).icon;
                  return (
                    <a
                      key={link.id || link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link)}
                      className={`text-[15px] font-semibold py-2 px-3 rounded-xl flex items-center justify-between transition-colors ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                          : 'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {IconComp && (
                          <IconComp
                            className={`w-4 h-4 ${
                              isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                            }`}
                          />
                        )}
                        <span>{link.label}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
                    </a>
                  );
                })}
              </nav>

              {/* Language control in the mobile drawer */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                <LanguageDropdown
                  currentLocale={locale}
                  onSelectLocale={(newLocale) => {
                    handleSelectLanguage(newLocale);
                  }}
                  variant="mobile"
                />
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800">
              {user ? (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center gap-2.5">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-indigo-500"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {user.displayName || user.email?.split('@')[0]}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 rounded">
                          {profile?.plan || 'Free'} Plan
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">@{cleanHandle}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={publicProfileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 px-2 bg-white dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-center text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3 text-blue-500" />
                      <span>{isRtl ? 'عرض الموقع' : 'View Site'}</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex-1 py-1.5 px-2 bg-white dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg text-center text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      <span>{copiedLink ? (isRtl ? 'تم النسخ' : 'Copied!') : (isRtl ? 'نسخ الرابط' : 'Copy Link')}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logOut();
                    }}
                    className="w-full py-1.5 text-xs text-rose-600 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'تسجيل الخروج' : 'Sign Out'}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('signin');
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[14px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t.signIn}
                </button>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenStudio();
                }}
                className="w-full py-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-[14px] font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {user ? (
                  <>
                    <Edit3 className="w-4 h-4 text-indigo-400 dark:text-indigo-600" />
                    <span>{isRtl ? 'فتح الاستوديو' : 'Open Studio'}</span>
                  </>
                ) : (
                  <>
                    <span>{t.createPage}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
