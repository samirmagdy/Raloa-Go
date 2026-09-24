import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Eye,
  MousePointerClick,
  TrendingUp,
  Share2,
  Edit3,
  Plus,
  Palette,
  QrCode as QrIcon,
  Globe,
  Settings,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Circle,
  Download,
  X,
  Zap,
  BarChart2,
  Users,
  Compass
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Locale, TemplateItem } from '../types';
import { Theme } from '../utils/theme';
import { useAuth } from '../hooks/useAuth';
import { templatesData } from '../data/content';
import { PremiumMark } from './brand/PremiumMark';

interface AuthenticatedHomeProps {
  locale: Locale;
  theme: Theme;
  onOpenStudio: (username?: string, template?: TemplateItem) => void;
  onOpenTemplates: () => void;
  onOpenPricing: () => void;
  onSwitchToMarketing?: () => void;
}

type TimeRange = '7d' | '30d' | 'all';

export const AuthenticatedHome: React.FC<AuthenticatedHomeProps> = ({
  locale,
  theme,
  onOpenStudio,
  onOpenTemplates,
  onOpenPricing,
  onSwitchToMarketing
}) => {
  const { user, profile, loadMiniSite, saveMiniSite } = useAuth();
  const isRtl = locale === 'ar';
  const isDark = theme === 'dark';

  // Site state
  const [siteData, setSiteData] = useState<{
    username: string;
    displayName: string;
    bio: string;
    avatar: string;
    templateId: string;
    isPublished: boolean;
    linksCount: number;
    updatedAt: string;
  }>({
    username: '',
    displayName: '',
    bio: '',
    avatar: '',
    templateId: 'elena',
    isPublished: true,
    linksCount: 4,
    updatedAt: new Date().toISOString()
  });

  const [isLoadingSite, setIsLoadingSite] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isPublishToggling, setIsPublishToggling] = useState(false);

  // Derived user details
  const rawUsername = profile?.handle || siteData.username || (user?.email ? user.email.split('@')[0] : 'creator');
  const cleanHandle = rawUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const publicUrl = `https://raloa.app/@${cleanHandle}`;
  const plan = profile?.plan || 'free';

  // Active template lookup
  const activeTemplate = useMemo(() => {
    return templatesData.find((t) => t.id === siteData.templateId) || templatesData[0];
  }, [siteData.templateId]);

  // Load user mini-site from Firestore
  useEffect(() => {
    let isCancelled = false;

    async function fetchSite() {
      setIsLoadingSite(true);
      try {
        const saved = await loadMiniSite('default');
        if (saved && !isCancelled) {
          setSiteData({
            username: saved.username || cleanHandle,
            displayName: saved.displayName || user?.displayName || 'Creator',
            bio: saved.bio || activeTemplate.bio,
            avatar: saved.avatar || user?.photoURL || activeTemplate.avatar,
            templateId: saved.templateId || 'elena',
            isPublished: saved.isPublished ?? true,
            linksCount: saved.links ? saved.links.length : 4,
            updatedAt: saved.updatedAt || new Date().toISOString()
          });
        } else if (!isCancelled) {
          setSiteData({
            username: cleanHandle,
            displayName: user?.displayName || cleanHandle,
            bio: isRtl ? activeTemplate.bioAr : activeTemplate.bio,
            avatar: user?.photoURL || activeTemplate.avatar,
            templateId: activeTemplate.id,
            isPublished: true,
            linksCount: 4,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Failed to load user mini-site:', err);
      } finally {
        if (!isCancelled) setIsLoadingSite(false);
      }
    }

    if (user) {
      fetchSite();
    }
    return () => {
      isCancelled = true;
    };
  }, [user, cleanHandle, activeTemplate, isRtl, loadMiniSite]);

  // Generate QR Code data URL when QR modal opens
  useEffect(() => {
    if (!qrModalOpen) return;
    let cancelled = false;

    QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: isDark ? '#ffffff' : '#0f172a',
        light: isDark ? '#020617' : '#ffffff'
      }
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR generation error:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [qrModalOpen, publicUrl, isDark]);

  // Copy handle link to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  // Toggle publish status
  const handleTogglePublish = async () => {
    setIsPublishToggling(true);
    const nextState = !siteData.isPublished;
    try {
      await saveMiniSite({ isPublished: nextState }, 'default');
      setSiteData((prev) => ({ ...prev, isPublished: nextState }));
      if (nextState) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      console.error('Failed to toggle publish status:', err);
    } finally {
      setIsPublishToggling(false);
    }
  };

  // Dynamic greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (isRtl) {
      if (hour < 12) return 'صباح الخير';
      if (hour < 18) return 'مساء الخير';
      return 'أهلاً بك';
    } else {
      if (hour < 12) return 'Good morning';
      if (hour < 18) return 'Good afternoon';
      return 'Good evening';
    }
  }, [isRtl]);

  // Analytics datasets depending on time range
  const analyticsData = useMemo(() => {
    if (timeRange === '7d') {
      return [
        { label: isRtl ? 'السبت' : 'Sat', views: 420, clicks: 148 },
        { label: isRtl ? 'الأحد' : 'Sun', views: 530, clicks: 195 },
        { label: isRtl ? 'الإثنين' : 'Mon', views: 610, clicks: 224 },
        { label: isRtl ? 'الثلاثاء' : 'Tue', views: 790, clicks: 290 },
        { label: isRtl ? 'الأربعاء' : 'Wed', views: 920, clicks: 340 },
        { label: isRtl ? 'الخميس' : 'Thu', views: 880, clicks: 310 },
        { label: isRtl ? 'الجمعة' : 'Fri', views: 1040, clicks: 382 }
      ];
    }
    if (timeRange === '30d') {
      return [
        { label: 'W1', views: 2450, clicks: 890 },
        { label: 'W2', views: 3120, clicks: 1140 },
        { label: 'W3', views: 3890, clicks: 1420 },
        { label: 'W4', views: 4620, clicks: 1780 }
      ];
    }
    return [
      { label: 'Jan', views: 5400, clicks: 1980 },
      { label: 'Feb', views: 6800, clicks: 2450 },
      { label: 'Mar', views: 8900, clicks: 3240 },
      { label: 'Apr', views: 11400, clicks: 4210 },
      { label: 'May', views: 14200, clicks: 5320 }
    ];
  }, [timeRange, isRtl]);

  const statsTotals = useMemo(() => {
    if (timeRange === '7d') {
      return { views: '5,190', visitors: '3,840', clicks: '1,889', ctr: '36.4%' };
    }
    if (timeRange === '30d') {
      return { views: '14,080', visitors: '10,240', clicks: '5,230', ctr: '37.1%' };
    }
    return { views: '46,700', visitors: '32,150', clicks: '17,200', ctr: '36.8%' };
  }, [timeRange]);

  // Onboarding progress items
  const onboardingSteps = useMemo(() => {
    return [
      {
        id: 'handle',
        title: isRtl ? 'تحديد اسم المعرّف الخاص بك' : 'Claim your unique handle',
        desc: isRtl ? `تم الحجز بنجاح (@${cleanHandle})` : `Reserved as @${cleanHandle}`,
        completed: Boolean(cleanHandle),
        actionLabel: isRtl ? 'تم' : 'Done',
        onAction: () => {}
      },
      {
        id: 'template',
        title: isRtl ? 'اختيار وتخصيص القالب' : 'Select a design template',
        desc: isRtl ? `القالب الحالي: ${activeTemplate.name}` : `Active: ${activeTemplate.name}`,
        completed: true,
        actionLabel: isRtl ? 'تغيير' : 'Change',
        onAction: onOpenTemplates
      },
      {
        id: 'links',
        title: isRtl ? 'إضافة الروابط الأساسية' : 'Add your essential links',
        desc: isRtl ? `${siteData.linksCount} روابط نشطة في صفحتك` : `${siteData.linksCount} active links configured`,
        completed: siteData.linksCount >= 3,
        actionLabel: isRtl ? 'تعديل' : 'Edit',
        onAction: () => onOpenStudio(cleanHandle, activeTemplate)
      },
      {
        id: 'qr',
        title: isRtl ? 'تنزيل ومشاركة رمز QR' : 'Generate & share your QR code',
        desc: isRtl ? 'رمز استجابة سريعة فوري لملفك' : 'Instant high-res QR for print & media',
        completed: true,
        actionLabel: isRtl ? 'عرض الرمز' : 'View QR',
        onAction: () => setQrModalOpen(true)
      },
      {
        id: 'publish',
        title: isRtl ? 'نشر الموقع المصغر للجمهور' : 'Publish your mini-site',
        desc: siteData.isPublished
          ? isRtl
            ? 'موقعك متاح أونلاين الآن'
            : 'Your mini-site is live and public'
          : isRtl
          ? 'الموقع حالياً في وضع المسودة'
          : 'Site is currently in draft mode',
        completed: siteData.isPublished,
        actionLabel: siteData.isPublished ? (isRtl ? 'مباشر' : 'Live') : (isRtl ? 'نشر' : 'Publish'),
        onAction: handleTogglePublish
      }
    ];
  }, [cleanHandle, activeTemplate, siteData, isRtl, onOpenTemplates, onOpenStudio]);

  const completedStepsCount = onboardingSteps.filter((s) => s.completed).length;
  const progressPercentage = Math.round((completedStepsCount / onboardingSteps.length) * 100);

  // Trigger celebration if all steps are completed
  const handleTriggerCelebrate = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.5 }
    });
  };

  return (
    <div className={`min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto ${isRtl ? 'font-sans' : 'font-sans'}`}>
      
      {/* 1. PERSONAL DASHBOARD HERO / HEADER BAR */}
      <section className="mb-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 md:p-10 shadow-2xl border border-indigo-500/20">
          
          {/* Subtle Ambient Background Orbs */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 -mb-16 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            {/* Identity & Welcome */}
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-indigo-400/40 shadow-inner bg-slate-800 flex items-center justify-center">
                  {siteData.avatar ? (
                    <img
                      src={siteData.avatar}
                      alt={siteData.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-indigo-300">
                      {cleanHandle.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                    siteData.isPublished ? 'bg-emerald-500 ring-2 ring-emerald-500/30' : 'bg-amber-500'
                  }`}
                  title={siteData.isPublished ? 'Site is Live' : 'Draft Mode'}
                >
                  <span className="sr-only">{siteData.isPublished ? 'Live' : 'Draft'}</span>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300/80">
                    {greeting}
                  </span>
                  
                  {/* Plan Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      plan === 'studio'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : plan === 'pro'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    <PremiumMark className="w-3 h-3 text-current" />
                    <span className="capitalize">{plan} Plan</span>
                  </span>

                  {plan === 'free' && (
                    <button
                      onClick={onOpenPricing}
                      className="text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors ml-1"
                    >
                      {isRtl ? 'ترقية إلى Pro' : 'Upgrade to Pro'}
                    </button>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  <span>{siteData.displayName || cleanHandle}</span>
                </h1>

                {/* Handle Pill with 1-click copy */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-mono text-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title={isRtl ? 'نسخ رابط الصفحة' : 'Copy link to clipboard'}
                  >
                    <span>raloa.app/@{cleanHandle}</span>
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                    title={isRtl ? 'فتح في علامة تبويب جديدة' : 'Open in new tab'}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {isCopied && (
                    <span className="text-xs text-emerald-400 font-medium animate-fade-in">
                      {isRtl ? 'تم النسخ!' : 'Copied!'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions at Top Right */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => onOpenStudio(cleanHandle, activeTemplate)}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Edit3 className="w-4 h-4" />
                <span>{isRtl ? 'تعديل في الاستوديو' : 'Edit in Studio'}</span>
              </button>

              <button
                onClick={() => setQrModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium border border-white/10 transition-colors"
                title={isRtl ? 'رمز QR' : 'QR Code'}
              >
                <QrIcon className="w-4 h-4 text-indigo-300" />
                <span className="hidden sm:inline">{isRtl ? 'رمز QR' : 'QR Code'}</span>
              </button>

              {onSwitchToMarketing && (
                <button
                  onClick={onSwitchToMarketing}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-sm font-medium border border-white/5 transition-colors"
                  title={isRtl ? 'عرض الصفحة الترويجية' : 'View landing page'}
                >
                  <Compass className="w-4 h-4" />
                  <span className="hidden sm:inline">{isRtl ? 'الموقع العام' : 'Marketing'}</span>
                </button>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* 2. MAIN GRID: SITE OVERVIEW & ONBOARDING PROGRESS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* SITE OVERVIEW CARD (1 Col on Desktop) */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{isRtl ? 'نظرة عامة على الموقع' : 'Site Overview'}</span>
              </h2>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  siteData.isPublished
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    siteData.isPublished ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span>{siteData.isPublished ? (isRtl ? 'منشور أونلاين' : 'Published') : (isRtl ? 'مسودة' : 'Draft')}</span>
              </span>
            </div>

            {/* Mini Phone Card Representation */}
            <div className="relative rounded-2xl bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-800/80 dark:to-slate-900/80 p-4 border border-slate-200 dark:border-slate-700/60 mb-5">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={siteData.avatar || activeTemplate.avatar}
                  alt={siteData.displayName}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                />
                <div className="overflow-hidden">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {siteData.displayName || cleanHandle}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {siteData.bio || activeTemplate.bio}
                  </div>
                </div>
              </div>

              {/* Sample link pills */}
              <div className="space-y-1.5 mb-3">
                <div className="h-7 rounded-lg bg-white dark:bg-slate-700/50 border border-slate-200/80 dark:border-slate-600/40 flex items-center justify-between px-3 text-xs text-slate-700 dark:text-slate-300 font-medium">
                  <span className="truncate">{activeTemplate.sampleLinks[0]?.title || 'Featured Project'}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </div>
                <div className="h-7 rounded-lg bg-white dark:bg-slate-700/50 border border-slate-200/80 dark:border-slate-600/40 flex items-center justify-between px-3 text-xs text-slate-700 dark:text-slate-300 font-medium">
                  <span className="truncate">{activeTemplate.sampleLinks[1]?.title || 'Contact & Booking'}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </div>
              </div>

              {/* Template identifier badge */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
                <div className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{isRtl ? 'القالب:' : 'Template:'} <strong className="text-slate-700 dark:text-slate-200">{activeTemplate.name}</strong></span>
                </div>
                <button
                  onClick={onOpenTemplates}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  {isRtl ? 'تغيير' : 'Change'}
                </button>
              </div>
            </div>

            {/* Quick URL metadata */}
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 mb-6">
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span>{isRtl ? 'الرابط العام:' : 'Public URL:'}</span>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 font-mono hover:underline truncate max-w-[200px]"
                >
                  {publicUrl.replace('https://', '')}
                </a>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span>{isRtl ? 'النطاق المخصص:' : 'Custom Domain:'}</span>
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <span>{plan === 'free' ? (isRtl ? 'يتطلب Pro' : 'Requires Pro') : (isRtl ? 'غير متصل' : 'Not configured')}</span>
                  {plan === 'free' && (
                    <button
                      onClick={onOpenPricing}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      {isRtl ? 'ترقية' : 'Upgrade'}
                    </button>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>{isRtl ? 'آخر تحديث:' : 'Last Updated:'}</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(siteData.updatedAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Action triggers */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => onOpenStudio(cleanHandle, activeTemplate)}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isRtl ? 'تعديل المحتوى' : 'Edit Studio'}</span>
            </button>

            <button
              onClick={handleTogglePublish}
              disabled={isPublishToggling}
              className={`w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                siteData.isPublished
                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPublishToggling ? 'animate-spin' : ''}`} />
              <span>
                {siteData.isPublished
                  ? (isRtl ? 'تعطيل النشر' : 'Unpublish')
                  : (isRtl ? 'نشر الموقع' : 'Publish')}
              </span>
            </button>
          </div>
        </section>

        {/* ONBOARDING PROGRESS (2 Cols on Desktop) */}
        <section className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header & Progress Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {isRtl ? 'خطوات اكتمال الحساب' : 'Onboarding & Launch Checklist'}
                  </h2>
                  {progressPercentage === 100 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <Sparkles className="w-3 h-3" />
                      {isRtl ? 'مكتمل بالكامل!' : '100% Complete!'}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {isRtl
                    ? `أنجزت ${completedStepsCount} من أصل ${onboardingSteps.length} مهام لزيادة وصول صفحتك`
                    : `Completed ${completedStepsCount} of ${onboardingSteps.length} tasks to maximize profile engagement`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                  {progressPercentage}%
                </span>
                {progressPercentage === 100 && (
                  <button
                    onClick={handleTriggerCelebrate}
                    className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-transform"
                    title={isRtl ? 'احتفال' : 'Celebrate'}
                  >
                    🎉
                  </button>
                )}
              </div>
            </div>

            {/* Gradient Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-6 overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
              <div
                className="bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500 h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {/* Interactive Step Items */}
            <div className="space-y-3">
              {onboardingSteps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    step.completed
                      ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/80 text-slate-700 dark:text-slate-300'
                      : 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900/50 shadow-sm hover:border-indigo-400'
                  }`}
                >
                  <div className="flex items-center gap-3.5 overflow-hidden">
                    <div className="flex-shrink-0">
                      {step.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-indigo-400 animate-pulse" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <div className={`text-sm font-semibold truncate ${step.completed ? 'text-slate-800 dark:text-slate-200 line-through decoration-slate-400' : 'text-slate-900 dark:text-white'}`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {step.desc}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={step.onAction}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      step.completed
                        ? 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                    }`}
                  >
                    {step.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick tips footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>{isRtl ? 'نصيحة: ربط حسابات التواصل يزيد التفاعل بنسبة ٤٥٪' : 'Pro Tip: Adding 3+ links increases conversion by 45%'}</span>
            </span>
            <button
              onClick={() => onOpenStudio(cleanHandle, activeTemplate)}
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              {isRtl ? 'فتح الاستوديو' : 'Open Studio'}
            </button>
          </div>
        </section>

      </div>

      {/* 3. ANALYTICS SUMMARY */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm mb-8">
        
        {/* Section Header with Time Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{isRtl ? 'ملخص الإحصائيات والأداء' : 'Analytics & Performance Summary'}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isRtl
                ? 'مراقبة حركة الزيارات والتفاعل ونسب النقر لصفحتك'
                : 'Real-time telemetry, visitor attribution and link engagement'}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 self-start sm:self-auto">
            {(['7d', '30d', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === range
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {range === '7d'
                  ? (isRtl ? 'آخر ٧ أيام' : 'Last 7 Days')
                  : range === '30d'
                  ? (isRtl ? 'آخر ٣٠ يوم' : 'Last 30 Days')
                  : (isRtl ? 'كل الوقت' : 'All Time')}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-5 border border-slate-200/60 dark:border-slate-700/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isRtl ? 'المشاهدات' : 'Page Views'}
              </span>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {statsTotals.views}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% {isRtl ? 'مقارنة بالسابق' : 'vs last period'}</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-5 border border-slate-200/60 dark:border-slate-700/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isRtl ? 'الزوار الفريدون' : 'Unique Visitors'}
              </span>
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {statsTotals.visitors}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+12.9% {isRtl ? 'مقارنة بالسابق' : 'vs last period'}</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-5 border border-slate-200/60 dark:border-slate-700/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isRtl ? 'النقرات' : 'Link Clicks'}
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <MousePointerClick className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {statsTotals.clicks}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+24.2% {isRtl ? 'مقارنة بالسابق' : 'vs last period'}</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-5 border border-slate-200/60 dark:border-slate-700/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isRtl ? 'نسبة النقر (CTR)' : 'Click-Through (CTR)'}
              </span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {statsTotals.ctr}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+4.1% {isRtl ? 'مقارنة بالسابق' : 'vs last period'}</span>
            </div>
          </div>

        </div>

        {/* Visual Trend Chart */}
        <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isRtl ? 'توزيع المشاهدات والنقرات' : 'Views & Click Distribution'}
            </span>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="text-slate-600 dark:text-slate-400">{isRtl ? 'المشاهدات' : 'Views'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-400">{isRtl ? 'النقرات' : 'Clicks'}</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} opacity={0.6} />
                <XAxis
                  dataKey="label"
                  stroke={isDark ? '#94a3b8' : '#64748b'}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke={isDark ? '#94a3b8' : '#64748b'}
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#viewsGradient)"
                  name={isRtl ? 'المشاهدات' : 'Views'}
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#clicksGradient)"
                  name={isRtl ? 'النقرات' : 'Clicks'}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 4. QUICK ACTIONS GRID */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>{isRtl ? 'إجراءات سريعة' : 'Quick Actions'}</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Action 1: Open Studio */}
          <button
            onClick={() => onOpenStudio(cleanHandle, activeTemplate)}
            className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all text-left rtl:text-right flex items-start gap-4"
          >
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                <span>{isRtl ? 'فتح محرر الاستوديو' : 'Launch Studio Editor'}</span>
                <ArrowRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-1 ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isRtl ? 'تعديل السيرة الذاتية، الروابط، والألوان في بيئة مباشرة' : 'Customize bio, links, theme and background styles'}
              </p>
            </div>
          </button>

          {/* Action 2: Add New Link */}
          <button
            onClick={() => onOpenStudio(cleanHandle, activeTemplate)}
            className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all text-left rtl:text-right flex items-start gap-4"
          >
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                <span>{isRtl ? 'إضافة رابط جديد' : 'Add New Link'}</span>
                <ArrowRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-1 ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isRtl ? 'أضف رابط متجر، فيديو، بودكاست، أو حجز مواعيد' : 'Add shop item, booking link, video, or portfolio item'}
              </p>
            </div>
          </button>

          {/* Action 3: Change Template */}
          <button
            onClick={onOpenTemplates}
            className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all text-left rtl:text-right flex items-start gap-4"
          >
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors flex items-center gap-1.5">
                <span>{isRtl ? 'معرض القوالب' : 'Explore Templates'}</span>
                <ArrowRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-1 ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isRtl ? 'اختر تصميماً جديداً من مجموعة قوالب رالوا المعمارية' : 'Switch to another modern aesthetic from the curated gallery'}
              </p>
            </div>
          </button>

          {/* Action 4: Share Profile */}
          <button
            onClick={handleCopy}
            className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all text-left rtl:text-right flex items-start gap-4"
          >
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                <span>{isRtl ? 'مشاركة الرابط' : 'Share Profile'}</span>
                <ArrowRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-1 ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isRtl ? 'انسخ الرابط الصغير لمشاركته في بايو إنستغرام وتيك توك' : 'Copy link to paste into your Instagram, TikTok, or X bio'}
              </p>
            </div>
          </button>

          {/* Action 5: View Live Site */}
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all text-left rtl:text-right flex items-start gap-4"
          >
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                <span>{isRtl ? 'معاينة الموقع المباشر' : 'View Live Site'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isRtl ? 'شاهد صفحتك كما يراها زوارك ومتابعوك' : 'See your live mini-site exactly as your audience sees it'}
              </p>
            </div>
          </a>

          {/* Action 6: Manage Plan / Domain */}
          <button
            onClick={onOpenPricing}
            className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all text-left rtl:text-right flex items-start gap-4"
          >
            <div className="p-3 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 group-hover:bg-pink-600 group-hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors flex items-center gap-1.5">
                <span>{isRtl ? 'إدارة الخطة والنطاق' : 'Plan & Custom Domain'}</span>
                <ArrowRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-1 ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isRtl ? 'ربط نطاقك الخاص مثل yourname.com وإلغاء القيود' : 'Connect custom domain and remove RALOA badge branding'}
              </p>
            </div>
          </button>

        </div>
      </section>

      {/* QR CODE MODAL */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-2xl text-center">
            
            <button
              onClick={() => setQrModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-3">
              <QrIcon className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              {isRtl ? 'رمز الاستجابة السريعة (QR)' : 'Your Mini-Site QR Code'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              {isRtl ? 'امسح الرمز لفتح صفحتك مباشرة على الهاتف' : 'Scan to open your profile directly on any smartphone camera'}
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 inline-block mb-5">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-52 h-52 mx-auto rounded-lg shadow-sm"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-xs text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`raloa-qr-${cleanHandle}.png`}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>{isRtl ? 'تنزيل الرمز كصورة PNG' : 'Download High-Res PNG'}</span>
                </a>
              )}

              <button
                onClick={handleCopy}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>{isCopied ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'نسخ رابط الموقع' : 'Copy Profile Link')}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
