import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowRight, Menu, X, Search, User as UserIcon, LogOut, ChevronDown, Check } from 'lucide-react';
import { PremiumMark } from './brand/PremiumMark';
import { RaloaLogo } from './brand/RaloaLogo';
import { LanguageDropdown } from './LanguageDropdown';
import { ThemeToggle } from './ThemeToggle';
import { SoundToggle } from './SoundToggle';
import { VoiceTourToggle } from './VoiceTourToggle';
import { Locale } from '../types';
import { Theme } from '../utils/theme';
import { dictionary } from '../data/content';
import { useAuth } from '../hooks/useAuth';

interface HeaderProps {
  locale: Locale;
  onToggleLocale?: () => void;
  onSelectLocale: (locale: Locale) => void;
  onOpenStudio: (username?: string) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onOpenCommandPalette?: () => void;
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
  onOpenAuth,
  onOpenCommandPalette,
  theme,
  onToggleTheme,
  soundEnabled,
  onToggleSound,
  voiceTourEnabled = false,
  voiceTourSpeaking = false,
  onToggleVoiceTour,
  currentSection = 'hero',
  onReplayVoiceTour
}) => {
  const { user, profile, logOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isRtl = locale === 'ar';
  const isDark = theme === 'dark';
  const t = dictionary[locale].nav;

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

  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return true;
    return /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform);
  }, []);

  const handleSelectLanguage = (newLocale: Locale) => {
    if (onSelectLocale) {
      onSelectLocale(newLocale);
    } else if (onToggleLocale && newLocale !== locale) {
      onToggleLocale();
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: t.templates, href: '#templates' },
    { label: t.features, href: '#features' },
    { label: t.howItWorks, href: '#how-it-works' },
    { label: t.pricing, href: '#pricing' },
    { label: t.resources, href: '#faq' }
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      const topOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 h-[72px] transition-all duration-200 ${
          scrolled
            ? 'bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-850 shadow-[0_4px_20px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)]'
            : 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs border-b border-transparent'
        }`}
      >
        <div className="max-w-[1200px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Left Section: Brand Logo & Desktop Nav */}
          <div className="flex items-center gap-7 lg:gap-8 xl:gap-10 shrink-0">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg group"
              aria-label="RALOA Home"
            >
              <RaloaLogo isRtl={isRtl} theme={isDark ? 'on-dark' : 'primary'} />
            </a>

            {/* Desktop Navigation Links (Cleanly separated from logo, non-wrapping) */}
            <nav className="hidden xl:flex items-center gap-5 xl:gap-7" aria-label="Main Navigation">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="text-[14px] font-medium text-slate-600 dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white transition-colors relative py-1 whitespace-nowrap"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 shrink-0">
            {/* Command Palette / Search Quick Jump Trigger */}
            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                aria-label={isRtl ? 'البحث السريع والتنقل (Cmd+K)' : 'Quick Search & Command Palette (Cmd+K)'}
                title={isRtl ? `البحث السريع (${isMac ? '⌘K' : 'Ctrl+K'})` : `Quick Search (${isMac ? '⌘K' : 'Ctrl+K'})`}
                className="hidden sm:inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-200/90 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all text-[12px] sm:text-[13px] font-medium cursor-pointer shadow-2xs group shrink-0 select-none"
              >
                <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                <span className="hidden xl:inline text-slate-600 dark:text-slate-300">
                  {isRtl ? 'بحث...' : 'Search...'}
                </span>
                <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span>{isMac ? '⌘' : 'Ctrl'}</span>
                  <span>K</span>
                </kbd>
              </button>
            )}

            {/* Voice-over Tour Toggle */}
            {onToggleVoiceTour && (
              <div className="hidden sm:block">
              <VoiceTourToggle
                enabled={voiceTourEnabled}
                isSpeaking={voiceTourSpeaking}
                onToggle={onToggleVoiceTour}
                currentSection={currentSection}
                onReplay={onReplayVoiceTour}
                variant="header"
                locale={locale}
              />
              </div>
            )}

            {/* Ambient Sound Toggle */}
            <div className="hidden sm:block">
              <SoundToggle
                enabled={soundEnabled}
                onToggle={onToggleSound}
                variant="header"
                locale={locale}
              />
            </div>

            {/* Global Theme Toggle */}
            <ThemeToggle
              theme={theme}
              onToggleTheme={onToggleTheme}
              variant="header"
              locale={locale}
            />

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
                  className="inline-flex items-center gap-2 pl-2 pr-3 rtl:pl-3 rtl:pr-2 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
                  aria-expanded={userDropdownOpen}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-indigo-500"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-[13px] font-bold text-slate-800 dark:text-white max-w-[90px] truncate">
                    {user.displayName || user.email?.split('@')[0] || 'Account'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    {profile?.plan || 'Free'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div
                    className={`absolute ${
                      isRtl ? 'left-0' : 'right-0'
                    } top-full mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150`}
                  >
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {user.displayName || 'Creator'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <PremiumMark className="w-3 h-3" />
                        <span className="capitalize">{profile?.plan || 'Free'} Plan</span>
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
                        <span>{isRtl ? 'لوحة تحكم الموقع (الاستوديو)' : 'Open Studio / My Site'}</span>
                        <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180 text-slate-400" />
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
              <span>{t.createPage}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
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
            } w-[310px] max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-900 shadow-2xl p-5 sm:p-6 flex flex-col justify-between transition-transform duration-300 ease-out border-s border-slate-200 dark:border-slate-800`}
            onClick={(e) => e.stopPropagation()}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
                <RaloaLogo isRtl={isRtl} size="sm" theme={isDark ? 'on-dark' : 'primary'} />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Quick Jump / Search Trigger */}
              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenCommandPalette();
                  }}
                  className="w-full mt-4 flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs font-semibold shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Search className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>{isRtl ? 'البحث عن قسم أو قالب...' : 'Search sections or templates...'}</span>
                  </div>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-white dark:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300">
                    {isMac ? '⌘K' : 'Ctrl+K'}
                  </kbd>
                </button>
              )}

              <nav className="mt-5 flex flex-col space-y-4" aria-label="Mobile Navigation">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="text-[16px] font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1 flex items-center justify-between"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
                  </a>
                ))}
              </nav>

              {/* Theme, Sound & Language Controls in Mobile Drawer */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
                {onToggleVoiceTour && (
                  <VoiceTourToggle
                    enabled={voiceTourEnabled}
                    isSpeaking={voiceTourSpeaking}
                    onToggle={onToggleVoiceTour}
                    currentSection={currentSection}
                    onReplay={onReplayVoiceTour}
                    variant="mobile"
                    locale={locale}
                  />
                )}

                <SoundToggle
                  enabled={soundEnabled}
                  onToggle={onToggleSound}
                  variant="mobile"
                  locale={locale}
                />

                <ThemeToggle
                  theme={theme}
                  onToggleTheme={onToggleTheme}
                  variant="mobile"
                  locale={locale}
                />

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
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-2.5">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-indigo-500"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {user.displayName || user.email?.split('@')[0]}
                      </p>
                      <span className="inline-block px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 rounded">
                        {profile?.plan || 'Free'} Plan
                      </span>
                    </div>
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
                <span>{t.createPage}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
