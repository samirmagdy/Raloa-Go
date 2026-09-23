import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PremiumMark } from '../brand/PremiumMark';
import {
  Search,
  X,
  LayoutGrid,
  CreditCard,
  HelpCircle,
  Users,
  Workflow,
  Mail,
  Home,
  ArrowRight,
  PlusCircle,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Headphones,
  Globe,
  LogIn,
  Keyboard,
  ExternalLink,
  ChevronRight,
  Compass
} from 'lucide-react';
import { Locale, TemplateItem } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';
import { templatesData } from '../../data/content';
import { Theme } from '../../utils/theme';

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
  theme: Theme;
  onNavigateToSection: (sectionId: string) => void;
  onSelectTemplate: (template: TemplateItem) => void;
  onOpenStudio: (username?: string, template?: TemplateItem) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onToggleTheme: () => void;
  onToggleSound: () => void;
  soundEnabled: boolean;
  voiceTourEnabled?: boolean;
  onToggleVoiceTour?: () => void;
  onToggleLocale: () => void;
  onOpenShortcuts: () => void;
}

type CommandCategory = 'all' | 'sections' | 'templates' | 'actions';

interface CommandItem {
  id: string;
  category: 'sections' | 'templates' | 'actions';
  title: string;
  titleAr: string;
  subtitle?: string;
  subtitleAr?: string;
  badge?: string;
  badgeAr?: string;
  icon: React.ReactNode;
  keywords: string[];
  action: () => void;
  avatar?: string;
  color?: string;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  locale,
  theme,
  onNavigateToSection,
  onSelectTemplate,
  onOpenStudio,
  onOpenAuth,
  onToggleTheme,
  onToggleSound,
  soundEnabled,
  voiceTourEnabled = false,
  onToggleVoiceTour,
  onToggleLocale,
  onOpenShortcuts
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CommandCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isRtl = locale === 'ar';
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen);
  const isDark = theme === 'dark';

  // Detect platform modifier symbol (⌘ vs Ctrl)
  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return true;
    return /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform);
  }, []);

  // Reset state and autofocus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveCategory('all');
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Build searchable commands list
  const allCommands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    // 1. Landing Page Sections
    const sections: Array<{
      id: string;
      title: string;
      titleAr: string;
      subtitle: string;
      subtitleAr: string;
      icon: React.ReactNode;
      keywords: string[];
    }> = [
      {
        id: 'hero',
        title: 'Home & Hero Overview',
        titleAr: 'الصفحة الرئيسية والمقدمة',
        subtitle: 'Back to top overview and creator bio examples',
        subtitleAr: 'العودة إلى البداية ونماذج مواقع المبدعين',
        icon: <Home className="w-4 h-4 text-blue-500" />,
        keywords: ['home', 'hero', 'top', 'overview', 'start', 'بداية', 'رئيسية', 'مقدمة']
      },
      {
        id: 'templates',
        title: 'Templates Gallery',
        titleAr: 'معرض القوالب والتصاميم',
        subtitle: 'Browse 10+ conversion-focused creator themes',
        subtitleAr: 'استعرض أكثر من ١٠ قوالب احترافية لصناع المحتوى',
        icon: <LayoutGrid className="w-4 h-4 text-violet-500" />,
        keywords: ['templates', 'themes', 'gallery', 'designs', 'starter', 'قوالب', 'تصاميم', 'معرض']
      },
      {
        id: 'how-it-works',
        title: 'How It Works',
        titleAr: 'كيف تعمل المنصة',
        subtitle: '3-step setup: choose template, customize, launch',
        subtitleAr: '٣ خطوات بسيطة: اختر قالباً، خصصه، وانطلق',
        icon: <Workflow className="w-4 h-4 text-emerald-500" />,
        keywords: ['how it works', 'steps', 'workflow', 'setup', 'guide', 'كيف', 'خطوات', 'شرح', 'طريقة']
      },
      {
        id: 'features',
        title: 'Platform Features & Tools',
        titleAr: 'المميزات والأدوات المتطورة',
        subtitle: 'Custom domains, instant shop, calendar bookings, analytics',
        subtitleAr: 'نطاقات مخصصة، متجر رقمي، حجز مواعيد، تحليلات',
        icon: <PremiumMark className="w-4 h-4 text-amber-500" />,
        keywords: ['features', 'tools', 'domain', 'store', 'shop', 'calendar', 'booking', 'analytics', 'مميزات', 'أدوات', 'نطاق', 'متجر']
      },
      {
        id: 'testimonials',
        title: 'Creator Stories & Reviews',
        titleAr: 'قصص نجاح المبدعين وآراؤهم',
        subtitle: 'Hear from photographers, educators, and indie founders',
        subtitleAr: 'تجارب وآراء المصورين والمدربين ورواد الأعمال',
        icon: <Users className="w-4 h-4 text-sky-500" />,
        keywords: ['stories', 'testimonials', 'reviews', 'social proof', 'creators', 'قصص', 'تجارب', 'آراء', 'تقييمات']
      },
      {
        id: 'pricing',
        title: 'Pricing Plans & Transparency',
        titleAr: 'خطط الأسعار الشفافة',
        subtitle: 'Free forever plan, Pro ($9/mo), and Studio with zero commission',
        subtitleAr: 'باقة مجانية مدى الحياة وباقة المحترفين بدون عمولة',
        icon: <CreditCard className="w-4 h-4 text-indigo-500" />,
        keywords: ['pricing', 'plans', 'cost', 'free', 'pro', 'subscription', 'fees', 'أسعار', 'باقات', 'مجاني', 'اشتراك']
      },
      {
        id: 'faq',
        title: 'Help Center & FAQ',
        titleAr: 'الأسئلة الشائعة والدعم الفني',
        subtitle: 'Answers about custom domains, payments, and migrations',
        subtitleAr: 'إجابات حول النطاقات وبوابات الدفع والنقل',
        icon: <HelpCircle className="w-4 h-4 text-rose-500" />,
        keywords: ['faq', 'help', 'support', 'questions', 'answers', 'أسئلة', 'دعم', 'مساعدة']
      },
      {
        id: 'newsletter',
        title: 'Creator Dispatch Newsletter',
        titleAr: 'النشرة البريدية للمبدعين',
        subtitle: 'Weekly tips on monetization, bio links, and personal brand growth',
        subtitleAr: 'نصائح أسبوعية لتنمية علامتك الشخصية ومبيعاتك',
        icon: <Mail className="w-4 h-4 text-teal-500" />,
        keywords: ['newsletter', 'subscribe', 'email', 'updates', 'dispatch', 'نشرة', 'بريد', 'اشتراك']
      }
    ];

    sections.forEach((s) => {
      list.push({
        id: `sec-${s.id}`,
        category: 'sections',
        title: s.title,
        titleAr: s.titleAr,
        subtitle: s.subtitle,
        subtitleAr: s.subtitleAr,
        badge: 'Section',
        badgeAr: 'قسم',
        icon: s.icon,
        keywords: s.keywords,
        action: () => {
          onClose();
          onNavigateToSection(s.id);
        }
      });
    });

    // 2. Templates Catalog
    templatesData.forEach((tmpl) => {
      list.push({
        id: `tmpl-${tmpl.id}`,
        category: 'templates',
        title: tmpl.name,
        titleAr: tmpl.name,
        subtitle: `${tmpl.role} • ${tmpl.category}`,
        subtitleAr: `${tmpl.role} • ${tmpl.category}`,
        badge: tmpl.category,
        badgeAr: tmpl.category,
        avatar: tmpl.avatar,
        color: tmpl.themeColor,
        icon: <LayoutGrid className="w-4 h-4" style={{ color: tmpl.themeColor }} />,
        keywords: [
          tmpl.name,
          tmpl.role,
          tmpl.category,
          tmpl.bio,
          tmpl.bioAr,
          'template',
          'theme',
          'portfolio',
          'creator',
          'قالب',
          'تصميم'
        ],
        action: () => {
          onClose();
          onNavigateToSection('templates');
          onSelectTemplate(tmpl);
        }
      });
    });

    // 3. Quick Actions
    list.push(
      {
        id: 'act-studio',
        category: 'actions',
        title: 'Create Your Page (Open Studio)',
        titleAr: 'أنشئ موقعك المصغر (فتح الاستوديو)',
        subtitle: 'Launch the live interactive editor with immediate preview',
        subtitleAr: 'ابدأ تحرير وتخصيص موقعك مباشرة مع معاينة حية',
        badge: 'Action',
        badgeAr: 'إجراء',
        icon: <PlusCircle className="w-4 h-4 text-indigo-500" />,
        keywords: ['create', 'studio', 'builder', 'editor', 'start', 'page', 'بناء', 'استوديو', 'إنشاء', 'تصميم'],
        action: () => {
          onClose();
          onOpenStudio();
        }
      },
      {
        id: 'act-theme',
        category: 'actions',
        title: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        titleAr: isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن',
        subtitle: isDark ? 'Activate crisp daylight theme' : 'Activate eye-safe midnight theme',
        subtitleAr: isDark ? 'تفعيل مظهر الإضاءة النهاري' : 'تفعيل المظهر الليلي المريح',
        badge: 'Theme (T)',
        badgeAr: 'المظهر (T)',
        icon: isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />,
        keywords: ['theme', 'dark', 'light', 'mode', 'color', 'مظهر', 'داكن', 'فاتح', 'ليل', 'نهار'],
        action: () => {
          onClose();
          onToggleTheme();
        }
      },
      {
        id: 'act-sound',
        category: 'actions',
        title: soundEnabled ? 'Mute Ambient Focus Sound' : 'Play Ambient Focus Sound',
        titleAr: soundEnabled ? 'كتم الصوت المحيطي للتركيز' : 'تشغيل الصوت المحيطي للتركيز',
        subtitle: soundEnabled ? 'Silence background synthesizers' : 'Generative soothing audio tones',
        subtitleAr: soundEnabled ? 'إيقاف نغمات التركيز الصوتية' : 'تشغيل نغمات محيطية مهدئة',
        badge: 'Audio (M)',
        badgeAr: 'الصوت (M)',
        icon: soundEnabled ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-500" />,
        keywords: ['sound', 'audio', 'music', 'ambient', 'focus', 'mute', 'صوت', 'موسيقى', 'كتم', 'محيطي'],
        action: () => {
          onClose();
          onToggleSound();
        }
      },
      {
        id: 'act-voice',
        category: 'actions',
        title: voiceTourEnabled ? 'Stop Voice-over Tour' : 'Start Voice-over Tour Walkthrough',
        titleAr: voiceTourEnabled ? 'إيقاف الجولة الصوتية' : 'بدء الجولة الصوتية التعريفية',
        subtitle: voiceTourEnabled ? 'End spoken narration' : 'Listen to guided narration as you scroll',
        subtitleAr: voiceTourEnabled ? 'إنهاء السرد الصوتي' : 'استمع لشرح صوتي متفاعل مع التمرير',
        badge: 'Voice (V)',
        badgeAr: 'صوت (V)',
        icon: <Headphones className="w-4 h-4 text-indigo-500" />,
        keywords: ['voice', 'tour', 'narration', 'audiobook', 'speech', 'walkthrough', 'جولة', 'صوتية', 'سرد', 'شرح'],
        action: () => {
          onClose();
          if (onToggleVoiceTour) onToggleVoiceTour();
        }
      },
      {
        id: 'act-locale',
        category: 'actions',
        title: isRtl ? 'Switch Interface to English' : 'التبديل إلى الواجهة العربية',
        titleAr: isRtl ? 'Switch Interface to English' : 'التبديل إلى الواجهة العربية',
        subtitle: isRtl ? 'Full English UI & LTR direction' : 'واجهة كاملة باللغة العربية مع دعم RTL',
        subtitleAr: isRtl ? 'Full English UI & LTR direction' : 'واجهة كاملة باللغة العربية مع دعم RTL',
        badge: 'Lang (L)',
        badgeAr: 'اللغة (L)',
        icon: <Globe className="w-4 h-4 text-blue-500" />,
        keywords: ['language', 'arabic', 'english', 'locale', 'translate', 'عربي', 'انجليزي', 'لغة', 'ترجمة'],
        action: () => {
          onClose();
          onToggleLocale();
        }
      },
      {
        id: 'act-auth',
        category: 'actions',
        title: 'Sign In / Account Access',
        titleAr: 'تسجيل الدخول / الوصول للحساب',
        subtitle: 'Manage your mini-site links, domain settings, and earnings',
        subtitleAr: 'إدارة روابطك ونطاقاتك ومبيعاتك الرقمية',
        badge: 'Account',
        badgeAr: 'الحساب',
        icon: <LogIn className="w-4 h-4 text-slate-700 dark:text-slate-300" />,
        keywords: ['sign in', 'login', 'account', 'auth', 'register', 'دخول', 'حساب', 'تسجيل'],
        action: () => {
          onClose();
          onOpenAuth('signin');
        }
      },
      {
        id: 'act-shortcuts',
        category: 'actions',
        title: 'View Keyboard Shortcuts',
        titleAr: 'عرض دليل اختصارات لوحة المفاتيح',
        subtitle: 'Master navigation keys: Esc, T, M, V, L, H, ?',
        subtitleAr: 'تعرف على جميع الاختصارات السريعة للتنقل',
        badge: 'Shortcuts (?)',
        badgeAr: 'اختصارات (?)',
        icon: <Keyboard className="w-4 h-4 text-violet-500" />,
        keywords: ['keyboard', 'shortcuts', 'hotkeys', 'help', 'keys', 'اختصارات', 'مفاتيح', 'أزرار'],
        action: () => {
          onClose();
          onOpenShortcuts();
        }
      }
    );

    return list;
  }, [
    isRtl,
    isDark,
    soundEnabled,
    voiceTourEnabled,
    onClose,
    onNavigateToSection,
    onSelectTemplate,
    onOpenStudio,
    onToggleTheme,
    onToggleSound,
    onToggleVoiceTour,
    onToggleLocale,
    onOpenAuth,
    onOpenShortcuts
  ]);

  // Filter commands by active category tab & search query
  const filteredCommands = useMemo(() => {
    let list = allCommands;

    // Filter by category tab
    if (activeCategory !== 'all') {
      list = list.filter((item) => item.category === activeCategory);
    }

    // Filter by text query
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return list;
    }

    return list.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(trimmed);
      const matchTitleAr = item.titleAr.toLowerCase().includes(trimmed);
      const matchSub = item.subtitle?.toLowerCase().includes(trimmed);
      const matchSubAr = item.subtitleAr?.toLowerCase().includes(trimmed);
      const matchKeywords = item.keywords.some((kw) => kw.toLowerCase().includes(trimmed));

      return matchTitle || matchTitleAr || matchSub || matchSubAr || matchKeywords;
    });
  }, [allCommands, activeCategory, query]);

  // Ensure selected index is bounded within results
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length, activeCategory, query]);

  // Handle keyboard navigation within list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredCommands.length > 0 ? (prev + 1) % filteredCommands.length : 0));
      scrollSelectedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredCommands.length > 0 ? (prev - 1 + filteredCommands.length) % filteredCommands.length : 0
      );
      scrollSelectedIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const scrollSelectedIntoView = () => {
    setTimeout(() => {
      const activeEl = listRef.current?.querySelector('[aria-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 10);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={isRtl ? 'لوحة الأوامر والبحث السريع' : 'Command Palette & Quick Navigation'}
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.25)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[82vh] transition-all animate-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Search Header Bar */}
        <div className="flex items-center px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 gap-3 bg-white dark:bg-slate-900">
          <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isRtl
                ? 'ابحث عن قسم، قالب، ميزة، أو إجراء... (مثال: Elena, pricing, mode)'
                : 'Search sections, templates, features, or actions... (e.g. Elena, pricing, dark)'
            }
            className="flex-1 bg-transparent text-[15px] sm:text-[16px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              Esc
            </kbd>
          )}
        </div>

        {/* Category Filters Pills */}
        <div className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/80 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            {isRtl ? 'الكل' : 'All'}
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('sections')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'sections'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{isRtl ? 'الأقسام' : 'Sections'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('templates')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'templates'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{isRtl ? 'القوالب' : 'Templates'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {templatesData.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('actions')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'actions'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <PremiumMark className="w-3.5 h-3.5" />
            <span>{isRtl ? 'الإجراءات السريعة' : 'Actions'}</span>
          </button>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          className="flex-1 overflow-y-auto p-2 sm:p-3 divide-y divide-slate-100/60 dark:divide-slate-800/40"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6 opacity-60" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                {isRtl ? 'لم يتم العثور على نتائج' : 'No matching results found'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                {isRtl
                  ? `لم نجد أي قسم أو قالب يطابق "${query}". جرب البحث بكلمات أخرى مثل "أسعار" أو "قوالب".`
                  : `We couldn't find any section, template, or action matching "${query}". Try searching for "templates" or "pricing".`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setActiveCategory('all');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
              >
                <span>{isRtl ? 'مسح الفلتر والبحث' : 'Reset search filter'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const title = isRtl ? item.titleAr : item.title;
                const subtitle = isRtl ? item.subtitleAr : item.subtitle;
                const badge = isRtl ? item.badgeAr : item.badge;

                return (
                  <div
                    key={item.id}
                    id={`cmd-${item.id}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`group flex items-center gap-3 px-3 sm:px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-100 ${
                      isSelected
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800 text-indigo-950 dark:text-white shadow-xs'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border border-transparent text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {/* Item Icon or Avatar */}
                    {item.avatar ? (
                      <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <img
                          src={item.avatar}
                          alt={title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-white dark:bg-slate-900 shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800'
                        }`}
                      >
                        {item.icon}
                      </div>
                    )}

                    {/* Content text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[13.5px] sm:text-[14px] truncate">
                          {title}
                        </span>
                        {badge && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              isSelected
                                ? 'bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </div>
                      {subtitle && (
                        <p className="text-[11.5px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {subtitle}
                        </p>
                      )}
                    </div>

                    {/* Action Arrow / Enter Cue */}
                    <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 sm:opacity-70 transition-opacity">
                      {isSelected ? (
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shadow-2xs">
                          <span>↵</span>
                          <span>{isRtl ? 'اختيار' : 'Select'}</span>
                        </kbd>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
                ↓
              </kbd>
              <span className="hidden sm:inline">{isRtl ? 'للتنقل' : 'navigate'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
                ↵
              </kbd>
              <span className="hidden sm:inline">{isRtl ? 'للتحديد' : 'select'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
                esc
              </kbd>
              <span className="hidden sm:inline">{isRtl ? 'للإغلاق' : 'close'}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">RALOA</span>
            <span>•</span>
            <span>{isRtl ? 'بحث فوري' : 'Quick Jump'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
