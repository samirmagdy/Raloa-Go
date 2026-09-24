import React, { useEffect, useState } from 'react';
import {
  Settings,
  Globe,
  Shield,
  CreditCard,
  Sliders,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Trash2,
  Sparkles,
  Link,
  Lock,
  Zap,
  EyeOff
} from 'lucide-react';
import { Locale } from '../../types';
import { PremiumMark } from '../brand/PremiumMark';
import { auth } from '../../lib/firebase';

interface StudioSettingsTabProps {
  handle: string;
  plan: 'free' | 'pro' | 'studio' | string;
  customDomain: string;
  onCustomDomainChange: (val: string) => void;
  metaTitle: string;
  onMetaTitleChange: (val: string) => void;
  metaDescription: string;
  onMetaDescriptionChange: (val: string) => void;
  hidePoweredBy: boolean;
  onHidePoweredByChange: (val: boolean) => void;
  sensitiveWarning: boolean;
  onSensitiveWarningChange: (val: boolean) => void;
  ga4Id: string;
  onGa4IdChange: (val: string) => void;
  metaPixelId: string;
  onMetaPixelIdChange: (val: string) => void;
  webhookUrl: string;
  onWebhookUrlChange: (val: string) => void;
  onExportJson: () => void;
  onResetDefaults: () => void;
  onUpgradePlan?: () => void;
  locale: Locale;
}

export const StudioSettingsTab: React.FC<StudioSettingsTabProps> = ({
  handle,
  plan = 'free',
  customDomain,
  onCustomDomainChange,
  metaTitle,
  onMetaTitleChange,
  metaDescription,
  onMetaDescriptionChange,
  hidePoweredBy,
  onHidePoweredByChange,
  sensitiveWarning,
  onSensitiveWarningChange,
  ga4Id,
  onGa4IdChange,
  metaPixelId,
  onMetaPixelIdChange,
  webhookUrl,
  onWebhookUrlChange,
  onExportJson,
  onResetDefaults,
  onUpgradePlan,
  locale
}) => {
  const isRtl = locale === 'ar';
  const [activeSubSection, setActiveSubSection] = useState<'site' | 'domain' | 'integrations' | 'billing' | 'advanced'>('site');
  const [domainVerified, setDomainVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [domainId, setDomainId] = useState('');
  const [dnsRecords, setDnsRecords] = useState<Array<{ type: string; name: string; value: string }>>([]);
  const [domainError, setDomainError] = useState('');

  const getApiHeaders = async (): Promise<Record<string, string>> => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    if (activeSubSection !== 'domain' || !customDomain) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/domains', { headers: await getApiHeaders() });
        if (!response.ok) return;
        const payload = await response.json();
        const existing = (payload.domains || []).find((domain: any) => domain.hostname === customDomain);
        if (!cancelled && existing) {
          setDomainId(existing.domainId);
          setDomainVerified(existing.verificationStatus === 'verified' && existing.sslStatus === 'active');
          setDnsRecords(existing.dnsRecords || []);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [activeSubSection, customDomain]);

  const handleVerifyDomain = async () => {
    setIsVerifying(true);
    setDomainError('');
    try {
      const headers = { 'Content-Type': 'application/json', ...(await getApiHeaders()) };
      let activeDomainId = domainId;
      let payload: any = null;
      if (!activeDomainId) {
        const provision = await fetch('/api/domains/provision', {
          method: 'POST',
          headers,
          body: JSON.stringify({ hostname: customDomain, siteId: handle || 'default' })
        });
        payload = await provision.json();
        if (!provision.ok) throw new Error(payload.error || 'Could not provision domain');
        activeDomainId = payload.domain.domainId;
        setDomainId(activeDomainId);
        setDnsRecords(payload.dnsRecords || payload.domain.dnsRecords || []);
      }

      const verification = await fetch('/api/domains/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ domainId: activeDomainId })
      });
      const verifiedPayload = await verification.json();
      if (!verification.ok) throw new Error(verifiedPayload.error || 'Could not verify domain');
      setDomainVerified(verifiedPayload.domain.verificationStatus === 'verified' && verifiedPayload.domain.sslStatus === 'active');
      setDnsRecords(verifiedPayload.domain.dnsRecords || dnsRecords);
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Could not verify domain');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Settings Navigation Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700">
        {[
          { id: 'site', label: isRtl ? 'الموقع' : 'Site', icon: Settings },
          { id: 'domain', label: isRtl ? 'النطاق و SEO' : 'Domain & SEO', icon: Globe },
          { id: 'integrations', label: isRtl ? 'الربط والتكامل' : 'Integrations', icon: Zap },
          { id: 'billing', label: isRtl ? 'الاشتراك' : 'Billing', icon: CreditCard },
          { id: 'advanced', label: isRtl ? 'متقدم' : 'Advanced', icon: Sliders }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubSection(tab.id as any)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Site Settings */}
      {activeSubSection === 'site' && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isRtl ? 'إعدادات الموقع العامة' : 'General Site Settings'}
          </h3>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRtl ? 'عنوان الموقع (Site Title)' : 'Site Title'}
              </label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => onMetaTitleChange(e.target.value)}
                placeholder={`${handle} | RALOA Link-in-Bio`}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Powered by RALOA badge toggle */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {isRtl ? 'إخفاء شارة "Powered by RALOA"' : 'Remove RALOA Branding'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isRtl ? 'متاح لمشتركي باقتي Pro و Studio لإزالة الشعار من أسفل صفحتك' : 'Hide the footer watermark badge on your public page'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={hidePoweredBy}
                onChange={(e) => onHidePoweredByChange(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            {/* Sensitive Content Warning Toggle */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {isRtl ? 'شاشة تحذير المحتوى الحساس (+١٨)' : 'Sensitive Content Warning (18+)'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isRtl ? 'إظهار شاشة موافقة عمرية للزائرين قبل استعراض صفحتك' : 'Require visitors to confirm they are 18+ before accessing content'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={sensitiveWarning}
                onChange={(e) => onSensitiveWarningChange(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Domain & SEO */}
      {activeSubSection === 'domain' && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isRtl ? 'النطاق المخصص وتهيئة محركات البحث (SEO)' : 'Custom Domain & SEO Metadata'}
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'النطاق المخصص (Custom Domain)' : 'Custom Domain'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customDomain}
                onChange={(e) => {
                  onCustomDomainChange(e.target.value.toLowerCase().trim());
                  setDomainVerified(false);
                  setDomainId('');
                  setDnsRecords([]);
                  setDomainError('');
                }}
                placeholder="links.mybrand.com"
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleVerifyDomain}
                disabled={isVerifying || !customDomain}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isVerifying ? (
                  isRtl ? 'جارِ التحقق...' : 'Verifying...'
                ) : domainVerified ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    <span>{isRtl ? 'مفعل' : 'Active'}</span>
                  </span>
                ) : (
                  domainId ? (isRtl ? 'إعادة التحقق' : 'Check status again') : (isRtl ? 'تحقق من DNS' : 'Verify DNS')
                )}
              </button>
            </div>
          </div>

          {domainError && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">{domainError}</p>}

          {dnsRecords.length > 0 && (
            <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                {isRtl ? 'أضف سجلات DNS التالية ثم أعد التحقق:' : 'Add these DNS records, then check again:'}
              </p>
              {dnsRecords.map((record) => (
                <div key={`${record.type}-${record.name}`} className="grid grid-cols-[58px_1fr] gap-2 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                  <span className="font-bold">{record.type}</span>
                  <span className="break-all">{record.name} → {record.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* DNS Configuration Instructions */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <p className="text-xs font-bold text-slate-800 dark:text-white">
              {isRtl ? 'إعدادات سجلات DNS المطلوبة لدى مزود نطاقك:' : 'Required DNS Records at your Registrar:'}
            </p>
            <div className="grid grid-cols-3 gap-2 font-mono text-[11px] p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700">
              <span className="text-slate-500">CNAME</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">cname.raloa.app</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Auto-SSL</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'وصف محركات البحث (Meta Description)' : 'Meta Description'}
            </label>
            <textarea
              rows={2}
              value={metaDescription}
              onChange={(e) => onMetaDescriptionChange(e.target.value)}
              placeholder={isRtl ? 'وصف يظهر في نتائج بحث جوجل عند البحث عن موقعك...' : 'Short preview description shown on Google and social media cards...'}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>
      )}

      {/* 3. Integrations */}
      {activeSubSection === 'integrations' && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isRtl ? 'الربط مع بكسل التتبع والتحليلات' : 'Analytics & Pixel Integrations'}
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Google Analytics 4 (Measurement ID)
            </label>
            <input
              type="text"
              value={ga4Id}
              onChange={(e) => onGa4IdChange(e.target.value)}
              placeholder="G-XXXXXXXXXX"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Meta Pixel ID (Facebook / Instagram)
            </label>
            <input
              type="text"
              value={metaPixelId}
              onChange={(e) => onMetaPixelIdChange(e.target.value)}
              placeholder="123456789012345"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Webhook URL (Zapier / Make / Slack)
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => onWebhookUrlChange(e.target.value)}
              placeholder="https://hooks.zapier.com/..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {/* 4. Billing */}
      {activeSubSection === 'billing' && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {isRtl ? 'باقتك الحالية' : 'Current Active Plan'}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <h4 className="text-xl font-black text-slate-900 dark:text-white capitalize">
                  {plan} Plan
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  {isRtl ? 'نشط' : 'Active'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onUpgradePlan}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
            >
              {isRtl ? 'ترقية الخطة' : 'Upgrade Plan'}
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <p className="font-bold text-slate-800 dark:text-white">{isRtl ? 'المميزات المتضمنة:' : 'Included features:'}</p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <li>{isRtl ? 'عدد غير محدود من الروابط والكتل' : 'Unlimited custom links & blocks'}</li>
              <li>{isRtl ? 'ربط نطاقات مخصصة مع شهادة SSL مجانية' : 'Custom domains with automated SSL certificate'}</li>
              <li>{isRtl ? 'إحصائيات تفاعلية لمدة ٣٠ يوماً' : '30-day interactive analytics timeline'}</li>
              <li>{isRtl ? 'تصدير بيانات المشتركين والنماذج' : 'Direct CSV/JSON export for audience data'}</li>
            </ul>
          </div>
        </div>
      )}

      {/* 5. Advanced */}
      {activeSubSection === 'advanced' && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isRtl ? 'الخيارات المتقدمة وإدارة البيانات' : 'Advanced Operations & Data Management'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onExportJson}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-left rtl:text-right transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs mb-1">
                <Download className="w-4 h-4" />
                <span>{isRtl ? 'تصدير نسخة احتياطية (JSON)' : 'Export Site Backup (JSON)'}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isRtl ? 'تحميل كامل محتويات وإعدادات موقعك في ملف' : 'Download complete site configuration file'}
              </p>
            </button>

            <button
              type="button"
              onClick={onResetDefaults}
              className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left rtl:text-right transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 text-rose-600 font-bold text-xs mb-1">
                <Trash2 className="w-4 h-4" />
                <span>{isRtl ? 'استعادة إعدادات القالب الأصلية' : 'Reset to Template Defaults'}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isRtl ? 'إعادة ضبط الروابط والتصميم للوضع الأصلي' : 'Clear custom changes and restore starting template'}
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
