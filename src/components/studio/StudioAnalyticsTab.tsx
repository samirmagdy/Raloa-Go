import React, { useState } from 'react';
import {
  BarChart2,
  TrendingUp,
  Eye,
  MousePointerClick,
  Users,
  Compass,
  ArrowUpRight,
  Calendar,
  Share2
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
import { Locale } from '../../types';
import { StudioBlockItem } from './SortableBlockList';

interface StudioAnalyticsTabProps {
  links: StudioBlockItem[];
  locale: Locale;
}

export const StudioAnalyticsTab: React.FC<StudioAnalyticsTabProps> = ({
  links,
  locale
}) => {
  const isRtl = locale === 'ar';
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  // Realistic 30-day analytics timeline data
  const analyticsData = [
    { date: 'Aug 26', views: 820, clicks: 142 },
    { date: 'Aug 29', views: 940, clicks: 178 },
    { date: 'Sep 01', views: 1100, clicks: 210 },
    { date: 'Sep 04', views: 1350, clicks: 280 },
    { date: 'Sep 07', views: 1220, clicks: 245 },
    { date: 'Sep 10', views: 1480, clicks: 310 },
    { date: 'Sep 13', views: 1620, clicks: 355 },
    { date: 'Sep 16', views: 1850, clicks: 420 },
    { date: 'Sep 19', views: 2100, clicks: 490 },
    { date: 'Sep 22', views: 2380, clicks: 540 },
    { date: 'Sep 24', views: 2540, clicks: 590 }
  ];

  // UTM tracking attribution breakdown
  const utmSources = [
    { source: 'Instagram Stories', medium: 'social_bio', campaign: 'fall_launch', clicks: 2420, percent: 45 },
    { source: 'TikTok Profile', medium: 'social', campaign: 'creator_vlog', clicks: 1530, percent: 28 },
    { source: 'Twitter / X', medium: 'post_link', campaign: 'thread_promo', clicks: 810, percent: 15 },
    { source: 'Direct / QR Code', medium: 'offline_print', campaign: 'meetup_standee', clicks: 420, percent: 8 },
    { source: 'YouTube Channel', medium: 'video_desc', campaign: 'tutorials', clicks: 220, percent: 4 }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* 1. Key 30-day KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isRtl ? 'المشاهدات (٣٠ يوماً)' : '30-Day Views'}</span>
            <Eye className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">18,420</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+24.6% {isRtl ? 'مقارنة بالسابق' : 'vs last period'}</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isRtl ? 'الزوار الفريدون' : 'Unique Visitors'}</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">12,190</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+19.2%</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isRtl ? 'إجمالي النقرات' : 'Total Clicks'}</span>
            <MousePointerClick className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">4,280</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+31.5%</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isRtl ? 'معدل النقر (CTR)' : 'Average CTR'}</span>
            <Compass className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">23.2%</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            {isRtl ? 'معدل تفاعل ممتاز' : 'Top tier creator benchmark'}
          </p>
        </div>
      </div>

      {/* 2. 30-Day Timeline Chart */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {isRtl ? 'الرسم البياني لتفاعل الزوار' : 'Traffic & Engagement Timeline'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRtl ? 'مقارنة يومية بين المشاهدات والنقرات الفعلية' : 'Daily views compared against actual link clicks'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setTimeRange('7d')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                timeRange === '7d' ? 'bg-white dark:bg-slate-750 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
              }`}
            >
              7D
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('30d')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                timeRange === '30d' ? 'bg-white dark:bg-slate-750 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
              }`}
            >
              30D
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                timeRange === 'all' ? 'bg-white dark:bg-slate-750 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
              }`}
            >
              ALL
            </button>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analyticsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="studioViewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="studioClicksGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '11px'
                }}
              />
              <Area type="monotone" dataKey="views" name={isRtl ? 'المشاهدات' : 'Views'} stroke="#4F46E5" strokeWidth={2.5} fillOpacity={1} fill="url(#studioViewsGrad)" />
              <Area type="monotone" dataKey="clicks" name={isRtl ? 'النقرات' : 'Clicks'} stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#studioClicksGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Top Performing Links Breakdown */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {isRtl ? 'أداء الروابط الأكثر نقراً' : 'Top Performing Links'}
        </h3>

        <div className="space-y-2.5">
          {links.slice(0, 5).map((l, index) => {
            const simulatedClicks = [1840, 1120, 780, 420, 210][index] || 120;
            const simulatedCtr = [34.2, 22.8, 16.4, 9.1, 4.5][index] || 3.2;

            return (
              <div
                key={l.id}
                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {l.title}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 truncate">
                      {l.url}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-right rtl:text-left">
                  <div>
                    <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                      {simulatedClicks.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{isRtl ? 'نقرة' : 'clicks'}</span>
                  </div>
                  <div className="w-16">
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {simulatedCtr}%
                    </span>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(simulatedCtr * 2.5, 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. UTM Attribution Table */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {isRtl ? 'مصادر الزيارات وحملات UTM' : 'UTM Tracking & Referral Attribution'}
        </h3>

        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full text-left rtl:text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-2.5 px-3.5">{isRtl ? 'المصدر (Source)' : 'Source'}</th>
                <th className="py-2.5 px-3.5">{isRtl ? 'الوسيط (Medium)' : 'Medium'}</th>
                <th className="py-2.5 px-3.5">{isRtl ? 'الحملة (Campaign)' : 'Campaign'}</th>
                <th className="py-2.5 px-3.5 text-right rtl:text-left">{isRtl ? 'النقرات' : 'Clicks'}</th>
                <th className="py-2.5 px-3.5 text-right rtl:text-left">{isRtl ? 'النسبة' : 'Share'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {utmSources.map((u, i) => (
                <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3.5 font-bold text-slate-800 dark:text-slate-200">
                    {u.source}
                  </td>
                  <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500">
                    {u.medium}
                  </td>
                  <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-400">
                    {u.campaign}
                  </td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 dark:text-white text-right rtl:text-left">
                    {u.clicks.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold text-right rtl:text-left">
                    {u.percent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
