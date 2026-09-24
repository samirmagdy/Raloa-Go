import React, { useState } from 'react';
import {
  Users,
  Mail,
  MessageSquare,
  Download,
  Search,
  Filter,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { Locale } from '../../types';

interface SubscriberItem {
  id: string;
  email: string;
  date: string;
  source: string;
  status: 'active' | 'unsubscribed';
}

interface FormResponseItem {
  id: string;
  name: string;
  email: string;
  message: string;
  date: string;
}

interface StudioAudienceTabProps {
  handle: string;
  locale: Locale;
}

export const StudioAudienceTab: React.FC<StudioAudienceTabProps> = ({
  handle,
  locale
}) => {
  const isRtl = locale === 'ar';
  const [activeSubTab, setActiveSubTab] = useState<'subscribers' | 'forms'>('subscribers');
  const [searchQuery, setSearchQuery] = useState('');

  // Sample production-grade data
  const subscribers: SubscriberItem[] = [
    { id: 'sub-1', email: 'sara.designer@gmail.com', date: '2026-09-23', source: 'Bio Link #1', status: 'active' },
    { id: 'sub-2', email: 'kareem.tech@outlook.com', date: '2026-09-22', source: 'Newsletter Card', status: 'active' },
    { id: 'sub-3', email: 'mark.founder@craft.io', date: '2026-09-20', source: 'Direct Profile', status: 'active' },
    { id: 'sub-4', email: 'nora.arts@gmail.com', date: '2026-09-19', source: 'Portfolio Page', status: 'active' },
    { id: 'sub-5', email: 'adam.sound@icloud.com', date: '2026-09-18', source: 'Bio Link #2', status: 'active' }
  ];

  const formResponses: FormResponseItem[] = [
    { id: 'fr-1', name: 'Leila Vance', email: 'leila@creativeagency.de', message: 'Interested in booking you for a 3-week design consultation project starting next month.', date: '2026-09-23' },
    { id: 'fr-2', name: 'Tariq Mansour', email: 'tariq@startuphub.ae', message: 'Loved your podcast episode. Would like to invite you as a keynote speaker at our creator summit.', date: '2026-09-21' },
    { id: 'fr-3', name: 'Maya Chen', email: 'maya@studiofocus.com', message: 'Question about your Lightroom presets licensing for commercial photography campaigns.', date: '2026-09-17' }
  ];

  const filteredSubscribers = subscribers.filter((s) =>
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredForms = formResponses.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (activeSubTab === 'subscribers') {
      csvContent += 'Email,Date,Source,Status\n';
      filteredSubscribers.forEach((s) => {
        csvContent += `"${s.email}","${s.date}","${s.source}","${s.status}"\n`;
      });
    } else {
      csvContent += 'Name,Email,Message,Date\n';
      filteredForms.forEach((f) => {
        csvContent += `"${f.name}","${f.email}","${f.message.replace(/"/g, '""')}","${f.date}"\n`;
      });
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `raloa-${handle}-${activeSubTab}-export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    const dataToExport = activeSubTab === 'subscribers' ? filteredSubscribers : filteredForms;
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `raloa-${handle}-${activeSubTab}-export.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* 1. Audience Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isRtl ? 'المشتركون بالبريد' : 'Subscribers'}</span>
            <Mail className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">1,248</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            +18.4% {isRtl ? 'هذا الشهر' : 'this month'}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isRtl ? 'رسائل النماذج' : 'Form Leads'}</span>
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">84</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            +12.1% {isRtl ? 'معدل الرد' : 'response rate'}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">{isRtl ? 'معدل التحويل' : 'Conversion'}</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">4.8%</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            {isRtl ? 'من إجمالي الزوار الفريدين' : 'from unique visitors'}
          </p>
        </div>
      </div>

      {/* 2. Sub-tab Selector & Export Controls */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Sub-tab Pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveSubTab('subscribers')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'subscribers'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{isRtl ? 'المشتركون في النشرة' : 'Subscribers'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-600 font-mono">
                {subscribers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('forms')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'forms'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{isRtl ? 'رسائل النماذج' : 'Form Responses'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-600 font-mono">
                {formResponses.length}
              </span>
            </button>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isRtl ? 'تصدير CSV' : 'Export CSV'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isRtl ? 'تصدير JSON' : 'Export JSON'}</span>
            </button>
          </div>
        </div>

        {/* Search Filter Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeSubTab === 'subscribers'
                ? isRtl ? 'بحث في البريد الإلكتروني أو المصدر...' : 'Search by email or source...'
                : isRtl ? 'بحث في الاسم أو الرسالة...' : 'Search by name or message content...'
            }
            className="w-full pl-9 rtl:pl-3.5 rtl:pr-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 3. Subscribers Table */}
        {activeSubTab === 'subscribers' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
            <table className="w-full text-left rtl:text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-2.5 px-3.5">{isRtl ? 'البريد الإلكتروني' : 'Email Address'}</th>
                  <th className="py-2.5 px-3.5">{isRtl ? 'المصدر' : 'Source'}</th>
                  <th className="py-2.5 px-3.5">{isRtl ? 'تاريخ الانضمام' : 'Joined Date'}</th>
                  <th className="py-2.5 px-3.5">{isRtl ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSubscribers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3.5 font-mono font-medium text-slate-800 dark:text-slate-200">
                      {s.email}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500">
                      {s.source}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-400">
                      {s.date}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>{s.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Form Responses Table */}
        {activeSubTab === 'forms' && (
          <div className="space-y-2.5">
            {filteredForms.map((f) => (
              <div
                key={f.id}
                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {f.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 ml-2 rtl:ml-0 rtl:mr-2">
                      {f.email}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {f.date}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                  {f.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
