import React, { useState, useMemo, useEffect } from 'react';
import { PremiumMark } from '../brand/PremiumMark';
import {
  X,
  BarChart3,
  TrendingUp,
  MousePointerClick,
  Eye,
  RefreshCw,
  ArrowUpRight,
  Calendar,
  Layers,
  Database,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Locale } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';
import { fetchPlatformMetrics } from '../../lib/firebase';

interface ProjectStatsModalProps {
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
  onOpenStudio?: () => void;
}

interface StatDay {
  date: string;
  views: number;
  clicks: number;
}

// Helper to generate realistic simulated stats with seed variation
function generateStatsData(daysCount: number, seed: number = 1): StatDay[] {
  const result: StatDay[] = [];
  const now = new Date();

  // Pseudo-random deterministic factor based on seed
  const rand = (min: number, max: number, offset: number) => {
    const pseudo = Math.sin(seed * 997 + offset * 13) * 10000;
    const norm = pseudo - Math.floor(pseudo);
    return Math.floor(norm * (max - min + 1)) + min;
  };

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayLabel = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const baseViews = isWeekend ? 1400 : 950;
    const views = baseViews + rand(-250, 450, i);
    const clicks = Math.round(views * (0.32 + (rand(-6, 8, i + 50) / 100)));

    result.push({
      date: dayLabel,
      views,
      clicks
    });
  }

  return result;
}

export const ProjectStatsModal: React.FC<ProjectStatsModalProps> = ({
  isOpen,
  locale,
  onClose,
  onOpenStudio
}) => {
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  const [seed, setSeed] = useState<number>(1);
  const [liveMetrics, setLiveMetrics] = useState<{ totalVisits: number; totalClicks: number; activeSitesCount: number } | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const isRtl = locale === 'ar';
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen);

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const data = await fetchPlatformMetrics();
      setLiveMetrics(data);
    } catch (err) {
      console.error('Error fetching live platform metrics:', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMetrics();
    }
  }, [isOpen]);

  const chartData = useMemo(() => {
    return generateStatsData(period, seed);
  }, [period, seed]);

  const totals = useMemo(() => {
    const totalViews = chartData.reduce((acc, d) => acc + d.views, 0);
    const totalClicks = chartData.reduce((acc, d) => acc + d.clicks, 0);
    const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0';

    return {
      totalViews,
      totalClicks,
      ctr
    };
  }, [chartData]);

  if (!isOpen) return null;

  const topLinks = [
    {
      title: isRtl ? 'رابط ملف بورتفوليو ٢٠٢٤' : '2024 Portfolio Showcase',
      url: 'portfolio.pdf',
      clicks: Math.round(totals.totalClicks * 0.42),
      share: '42%'
    },
    {
      title: isRtl ? 'حجز جلسة استشارية مباشرة' : 'Book 1-on-1 Consultation',
      url: 'cal.com/meeting',
      clicks: Math.round(totals.totalClicks * 0.28),
      share: '28%'
    },
    {
      title: isRtl ? 'تحميل كتالوج المنتجات الرقمية' : 'Digital Presets & LUTs Store',
      url: 'shop.gumroad.com',
      clicks: Math.round(totals.totalClicks * 0.18),
      share: '18%'
    },
    {
      title: isRtl ? 'حساب إنستغرام وقناة يوتيوب' : 'Instagram & YouTube Channel',
      url: 'youtube.com/@channel',
      clicks: Math.round(totals.totalClicks * 0.12),
      share: '12%'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-stats-title"
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] transition-colors duration-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-800/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-2xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="project-stats-title" className="text-base font-extrabold text-[#0F172A] dark:text-white leading-tight">
                  {isRtl ? 'إحصائيات المشروع والزيارات' : 'Creator Project Stats'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/80 dark:border-emerald-800/60">
                  {isRtl ? 'محاكاة حية' : 'Live Preview'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isRtl
                  ? 'نموذج تفاعلي يوضح بيانات الزيارات ونقرات الروابط للوحة التحكم'
                  : 'Interactive preview of your mini-site visitor analytics & CTR'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isRtl ? 'توليد أرقام عشوائية جديدة' : 'Randomize / Re-roll data'}
              aria-label={isRtl ? 'تحديث البيانات' : 'Randomize data'}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label={isRtl ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Live Firestore Telemetry Verification Banner */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 leading-tight">
                  <span>{isRtl ? 'بيانات التتبع المباشرة من Firestore' : 'Live Firestore Telemetry'}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </h4>
                <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mt-0.5">
                  {loadingMetrics
                    ? (isRtl ? 'جاري قراءة السجلات الحية...' : 'Reading live Firestore records...')
                    : (isRtl
                      ? `${liveMetrics?.totalVisits ?? 0} زيارة موثقة • ${liveMetrics?.totalClicks ?? 0} نقرة رابط مسجلة`
                      : `${liveMetrics?.totalVisits ?? 0} verified visits • ${liveMetrics?.totalClicks ?? 0} recorded link clicks`)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchMetrics}
              disabled={loadingMetrics}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3 h-3 ${loadingMetrics ? 'animate-spin' : ''}`} />
              <span>{isRtl ? 'مزامنة' : 'Sync'}</span>
            </button>
          </div>

          {/* Controls: Time Range Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="font-semibold">{isRtl ? 'الفترة الزمنية:' : 'Reporting Window:'}</span>
            </div>
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setPeriod(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    period === d
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isRtl ? `آخر ${d} يوم` : `Last ${d} Days`}
                </button>
              ))}
            </div>
          </div>

          {/* KPI Highlight Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Card 1: Views */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {isRtl ? 'مشاهدات الموقع' : 'Site Views'}
                </span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Eye className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#0F172A] dark:text-white">
                  {totals.totalViews.toLocaleString()}
                </span>
                <span className="inline-flex items-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-3 h-3 mr-0.5 rtl:ml-0.5 rtl:mr-0" />
                  +24.8%
                </span>
              </div>
            </div>

            {/* Card 2: Link Clicks */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {isRtl ? 'نقرات الروابط' : 'Link Clicks'}
                </span>
                <div className="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <MousePointerClick className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#0F172A] dark:text-white">
                  {totals.totalClicks.toLocaleString()}
                </span>
                <span className="inline-flex items-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-3 h-3 mr-0.5 rtl:ml-0.5 rtl:mr-0" />
                  +18.4%
                </span>
              </div>
            </div>

            {/* Card 3: CTR */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {isRtl ? 'نسبة النقر للظهور' : 'Click-Through Rate'}
                </span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#0F172A] dark:text-white">
                  {totals.ctr}%
                </span>
                <span className="inline-flex items-center text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {isRtl ? 'أداء متفوق' : 'Top Tier'}
                </span>
              </div>
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {isRtl ? 'اتجاهات الزيارات والنقرات اليومية' : 'Daily Engagement Velocity'}
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {chartData.length} {isRtl ? 'نقاط قياس' : 'data points'}
              </span>
            </div>

            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.2} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                    }}
                    labelStyle={{ fontWeight: 'bold', color: '#94A3B8' }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    name={isRtl ? 'مشاهدات الموقع' : 'Site Views'}
                    dataKey="views"
                    stroke="#4F46E5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#viewsGradient)"
                  />
                  <Area
                    type="monotone"
                    name={isRtl ? 'نقرات الروابط' : 'Link Clicks'}
                    dataKey="clicks"
                    stroke="#06B6D4"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#clicksGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breakdown: Top Performing Interactive Links */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>{isRtl ? 'أعلى الروابط نقراً' : 'Top Performing Links'}</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                {isRtl ? 'إجمالي النقرات الموزعة' : 'Share of Total Clicks'}
              </span>
            </div>

            <div className="space-y-2">
              {topLinks.map((link, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-xs"
                >
                  <div className="flex-1 min-w-0 mr-3 rtl:mr-0 rtl:ml-3">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                      {link.title}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate block">
                      {link.url}
                    </span>
                  </div>
                  <div className="text-right rtl:text-left shrink-0">
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {link.clicks.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block">
                      {link.share}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Action Bar */}
        <div className="p-4.5 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 dark:text-slate-400 text-center sm:text-left rtl:sm:text-right">
            <span>{isRtl ? 'جاهز لتتبع زياراتك الحقيقية بدقة؟' : 'Ready to track real visitor data in real-time?'}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isRtl ? 'إغلاق' : 'Close'}
            </button>
            {onOpenStudio && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStudio();
                }}
                className="flex-1 sm:flex-initial px-4.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PremiumMark className="w-3.5 h-3.5" />
                <span>{isRtl ? 'ابدأ موقعك مجاناً' : 'Start Your Site'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
