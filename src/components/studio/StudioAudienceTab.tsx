import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Mail, MessageSquare, Plus, Search, Trash2, X } from 'lucide-react';
import { Locale } from '../../types';
import { auth } from '../../lib/firebase';

type AudienceTab = 'subscribers' | 'submissions';
type SubscriberStatus = 'active' | 'unsubscribed';
type SubmissionStatus = 'new' | 'read' | 'archived';

interface SubscriberItem { id: string; email: string; createdAt: string | null; source: string; status: SubscriberStatus; }
interface SubmissionItem { id: string; name: string; email: string; subject: string; message: string; createdAt: string | null; status: SubmissionStatus; }
interface AudienceMetrics { subscribers: number; activeSubscribers: number; newSubscribers: number; submissions: number; newSubmissions: number; uniqueVisitors: number; conversionRate: number | null; }
interface AudienceResponse { data: SubscriberItem[] | SubmissionItem[]; total: number; hasMore: boolean; nextCursor?: string | null; metrics: AudienceMetrics; metricsCapped?: boolean; }

interface StudioAudienceTabProps { siteId: string; handle: string; locale: Locale; }

function formatDate(value: string | null, locale: Locale): string {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return 'Not available';
  return parsed.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const StudioAudienceTab: React.FC<StudioAudienceTabProps> = ({ siteId, handle, locale }) => {
  const isRtl = locale === 'ar';
  const [activeTab, setActiveTab] = useState<AudienceTab>('subscribers');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newSource, setNewSource] = useState('Manual Entry');
  const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [metrics, setMetrics] = useState<AudienceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [metricsCapped, setMetricsCapped] = useState(false);

  const request = useCallback(async (url: string, init?: RequestInit): Promise<Response> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error(isRtl ? 'يرجى تسجيل الدخول لإدارة الجمهور.' : 'Sign in to manage your audience.');
    const token = await currentUser.getIdToken();
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers || {}) }
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.message || payload?.error?.message || payload?.error || (isRtl ? 'تعذر تحميل بيانات الجمهور.' : 'Audience request failed.'));
    }
    return response;
  }, [isRtl]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ type: activeTab, siteId, siteHandle: handle, limit: '50' });
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [activeTab, from, handle, search, siteId, status, to]);

  const loadAudience = useCallback(async (append = false) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams(queryString);
      if (append && nextCursor) params.set('cursor', nextCursor);
      const response = await request(`/api/creator/audience?${params.toString()}`);
      const payload = await response.json() as AudienceResponse;
      setMetrics(payload.metrics || null);
      setMetricsCapped(Boolean(payload.metricsCapped));
      setNextCursor(payload.nextCursor || null);
      if (activeTab === 'subscribers') setSubscribers((current) => append ? [...current, ...(payload.data as SubscriberItem[])] : payload.data as SubscriberItem[]);
      else setSubmissions((current) => append ? [...current, ...(payload.data as SubmissionItem[])] : payload.data as SubmissionItem[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : (isRtl ? 'تعذر تحميل بيانات الجمهور.' : 'Could not load audience data.'));
    } finally { setLoading(false); }
  }, [activeTab, isRtl, nextCursor, queryString, request]);

  useEffect(() => {
    setNextCursor(null);
    const timer = window.setTimeout(() => { void loadAudience(false); }, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, from, search, status, to, siteId, handle]);

  const deleteRecord = async (kind: AudienceTab, id: string) => {
    if (!window.confirm(isRtl ? 'هل تريد حذف هذا السجل نهائياً؟' : 'Delete this record permanently?')) return;
    setBusyId(id);
    try { await request(`/api/creator/audience/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadAudience(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : (isRtl ? 'تعذر الحذف.' : 'Could not delete the record.')); }
    finally { setBusyId(null); }
  };

  const updateStatus = async (kind: AudienceTab, id: string, nextStatus: string) => {
    setBusyId(id);
    try { await request(`/api/creator/audience/${kind}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }); await loadAudience(); }
    catch (statusError) { setError(statusError instanceof Error ? statusError.message : (isRtl ? 'تعذر تحديث الحالة.' : 'Could not update status.')); }
    finally { setBusyId(null); }
  };

  const addSubscriber = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyId('new');
    try {
      await request('/api/creator/audience/subscribers', { method: 'POST', body: JSON.stringify({ siteId, siteHandle: handle, email: newEmail, source: newSource }) });
      setNewEmail(''); setNewSource('Manual Entry'); setShowAddModal(false); setActiveTab('subscribers'); await loadAudience();
    } catch (addError) { setError(addError instanceof Error ? addError.message : (isRtl ? 'تعذر إضافة المشترك.' : 'Could not add subscriber.')); }
    finally { setBusyId(null); }
  };

  const exportAudience = async (format: 'csv' | 'json') => {
    setBusyId(`export-${format}`);
    try {
      const response = await request(`/api/creator/audience/export?${queryString}&format=${format}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `raloa-${handle}-${activeTab}-export.${format}`; link.click(); URL.revokeObjectURL(url);
    } catch (exportError) { setError(exportError instanceof Error ? exportError.message : (isRtl ? 'تعذر التصدير.' : 'Could not export audience data.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <MetricCard label={isRtl ? 'المشتركون' : 'Subscribers'} value={metrics?.subscribers ?? 0} detail={metrics ? `+${metrics.newSubscribers} ${isRtl ? 'آخر 30 يوماً' : 'last 30 days'}` : 'Not available'} icon={<Mail className="w-4 h-4 text-indigo-500" />} />
        <MetricCard label={isRtl ? 'رسائل النماذج' : 'Form leads'} value={metrics?.submissions ?? 0} detail={metrics ? `+${metrics.newSubmissions} ${isRtl ? 'آخر 30 يوماً' : 'last 30 days'}` : 'Not available'} icon={<MessageSquare className="w-4 h-4 text-blue-500" />} />
        <MetricCard label={isRtl ? 'معدل التحويل' : 'Conversion'} value={metrics?.conversionRate === null || metrics?.conversionRate === undefined ? 'Not available' : `${metrics.conversionRate}%`} detail={metrics ? `${metrics.uniqueVisitors.toLocaleString()} ${isRtl ? 'زائر فريد' : 'unique visitors'}` : (isRtl ? 'لا توجد بيانات' : 'No data yet')} icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} />
      </div>

      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <AudienceTabButton active={activeTab === 'subscribers'} onClick={() => { setActiveTab('subscribers'); setStatus(''); }} icon={<Mail className="w-3.5 h-3.5" />} label={isRtl ? 'المشتركون' : 'Subscribers'} count={metrics?.subscribers ?? 0} />
            <AudienceTabButton active={activeTab === 'submissions'} onClick={() => { setActiveTab('submissions'); setStatus(''); }} icon={<MessageSquare className="w-3.5 h-3.5" />} label={isRtl ? 'رسائل النماذج' : 'Form responses'} count={metrics?.submissions ?? 0} />
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'subscribers' && <button type="button" onClick={() => setShowAddModal(true)} className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />{isRtl ? 'إضافة مشترك' : 'Add subscriber'}</button>}
            <button type="button" disabled={Boolean(busyId)} onClick={() => void exportAudience('csv')} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />CSV</button>
            <button type="button" disabled={Boolean(busyId)} onClick={() => void exportAudience('json')} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"><Download className="w-3.5 h-3.5 text-indigo-600" />JSON</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2">
          <label className="relative"><Search className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={activeTab === 'subscribers' ? (isRtl ? 'بحث بالبريد أو المصدر...' : 'Search email or source...') : (isRtl ? 'بحث بالاسم أو الرسالة...' : 'Search name, email, or message...')} className="w-full pl-9 rtl:pl-3.5 rtl:pr-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs"><option value="">{isRtl ? 'كل الحالات' : 'All statuses'}</option>{activeTab === 'subscribers' ? <><option value="active">{isRtl ? 'نشط' : 'Active'}</option><option value="unsubscribed">{isRtl ? 'غير مشترك' : 'Unsubscribed'}</option></> : <><option value="new">{isRtl ? 'جديد' : 'New'}</option><option value="read">{isRtl ? 'مقروء' : 'Read'}</option><option value="archived">{isRtl ? 'مؤرشف' : 'Archived'}</option></>}</select>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label={isRtl ? 'من تاريخ' : 'From date'} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label={isRtl ? 'إلى تاريخ' : 'To date'} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs" />
        </div>

        {metricsCapped && <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertCircle className="w-4 h-4 shrink-0" /><span>{isRtl ? 'بعض المقاييس جزئية لأن معالجة البيانات الكبيرة لم تكتمل بعد.' : 'Some audience metrics are partial because the aggregate query reached its safety boundary.'}</span></div>}
        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span><button type="button" onClick={() => { setError(''); void loadAudience(false); }} className="ml-auto underline">{isRtl ? 'إعادة المحاولة' : 'Retry'}</button></div>}
        {loading && (subscribers.length === 0 && submissions.length === 0) ? <div className="py-12 flex items-center justify-center text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />{isRtl ? 'جار التحميل...' : 'Loading audience data...'}</div> : activeTab === 'subscribers' ? <SubscriberTable items={subscribers} locale={locale} busyId={busyId} onDelete={(id) => void deleteRecord('subscribers', id)} onStatus={(id, next) => void updateStatus('subscribers', id, next)} /> : <SubmissionList items={submissions} locale={locale} busyId={busyId} onDelete={(id) => void deleteRecord('submissions', id)} onStatus={(id, next) => void updateStatus('submissions', id, next)} />}
        {nextCursor && <button type="button" disabled={loading} onClick={() => void loadAudience(true)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : 'hidden'}`} />{loading ? (isRtl ? 'جار التحميل...' : 'Loading...') : (isRtl ? 'تحميل المزيد' : 'Load more')}</button>}
      </div>

      {showAddModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" role="dialog" aria-modal="true"><div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">{isRtl ? 'إضافة مشترك' : 'Add subscriber'}</h3><button type="button" onClick={() => setShowAddModal(false)} aria-label={isRtl ? 'إغلاق' : 'Close'}><X className="w-4 h-4" /></button></div><form onSubmit={(event) => void addSubscriber(event)} className="space-y-3"><input type="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="subscriber@example.com" className="w-full px-3 py-2 rounded-xl border text-sm" /><input value={newSource} onChange={(event) => setNewSource(event.target.value)} placeholder={isRtl ? 'المصدر' : 'Source'} className="w-full px-3 py-2 rounded-xl border text-sm" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-2 rounded-xl border text-xs">{isRtl ? 'إلغاء' : 'Cancel'}</button><button type="submit" disabled={busyId === 'new'} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs disabled:opacity-50">{busyId === 'new' ? (isRtl ? 'جار الحفظ...' : 'Saving...') : (isRtl ? 'حفظ' : 'Save')}</button></div></form></div></div>}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: number | string; detail: string; icon: React.ReactNode }> = ({ label, value, detail, icon }) => <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800"><div className="flex items-center justify-between text-slate-400 mb-1"><span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>{icon}</div><p className="text-2xl font-black text-slate-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p><p className="text-[11px] text-slate-500 mt-1">{detail}</p></div>;

const AudienceTabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }> = ({ active, onClick, icon, label, count }) => <button type="button" onClick={onClick} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${active ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'}`}>{icon}{label}<span className="px-1.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-600">{count}</span></button>;

const SubscriberTable: React.FC<{ items: SubscriberItem[]; locale: Locale; busyId: string | null; onDelete: (id: string) => void; onStatus: (id: string, status: SubscriberStatus) => void }> = ({ items, locale, busyId, onDelete, onStatus }) => <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800"><table className="w-full text-left rtl:text-right text-xs"><thead><tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase text-[10px]"><th className="py-2.5 px-3.5">Email</th><th className="py-2.5 px-3.5">Source</th><th className="py-2.5 px-3.5">Joined</th><th className="py-2.5 px-3.5">Status</th><th className="py-2.5 px-3.5 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{items.length === 0 ? <tr><td colSpan={5} className="py-10 text-center text-slate-400">{locale === 'ar' ? 'لا توجد بيانات جمهور محفوظة.' : 'No audience records found.'}</td></tr> : items.map((item) => <tr key={item.id}><td className="py-2.5 px-3.5 font-mono">{item.email}</td><td className="py-2.5 px-3.5 text-slate-500">{item.source}</td><td className="py-2.5 px-3.5 text-slate-400">{formatDate(item.createdAt, locale)}</td><td className="py-2.5 px-3.5"><select value={item.status} disabled={busyId === item.id} onChange={(event) => onStatus(item.id, event.target.value as SubscriberStatus)} className="rounded-lg border px-2 py-1 text-[11px] bg-transparent"><option value="active">Active</option><option value="unsubscribed">Unsubscribed</option></select></td><td className="py-2.5 px-3.5 text-right"><button type="button" disabled={busyId === item.id} onClick={() => onDelete(item.id)} aria-label="Delete subscriber" className="text-slate-400 hover:text-rose-600 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody></table></div>;

const SubmissionList: React.FC<{ items: SubmissionItem[]; locale: Locale; busyId: string | null; onDelete: (id: string) => void; onStatus: (id: string, status: SubmissionStatus) => void }> = ({ items, locale, busyId, onDelete, onStatus }) => <div className="space-y-2.5">{items.length === 0 ? <div className="py-10 text-center text-xs text-slate-400">{locale === 'ar' ? 'لا توجد رسائل محفوظة.' : 'No form submissions found.'}</div> : items.map((item) => <article key={item.id} className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong className="text-xs">{item.name || '—'}</strong><span className="text-[11px] font-mono text-slate-400 ml-2">{item.email}</span>{item.subject && <p className="text-[11px] text-slate-500 mt-1">{item.subject}</p>}</div><div className="flex items-center gap-2"><span className="text-[10px] text-slate-400">{formatDate(item.createdAt, locale)}</span><select value={item.status} disabled={busyId === item.id} onChange={(event) => onStatus(item.id, event.target.value as SubmissionStatus)} className="rounded-lg border px-2 py-1 text-[11px] bg-transparent"><option value="new">New</option><option value="read">Read</option><option value="archived">Archived</option></select><button type="button" disabled={busyId === item.id} onClick={() => onDelete(item.id)} aria-label="Delete submission" className="text-slate-400 hover:text-rose-600 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /></button></div></div><p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg">{item.message}</p></article>)}</div>;
