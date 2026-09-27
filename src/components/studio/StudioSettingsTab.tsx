import React, { useEffect, useState } from 'react';
import {
  Globe,
  ShoppingBag,
  CalendarDays,
  UserRound,
  CreditCard,
  CheckCircle2,
  Download,
  Trash2,
  Zap,
} from 'lucide-react';
import { BookingConfig, Locale, ProfileSocialLink, SocialIntegrationStatus } from '../../types';
import { auth } from '../../lib/firebase';
import { StudioSchedulingSettings } from './StudioSchedulingSettings';
import { StudioProductsSettings } from './StudioProductsSettings';
import { getPlanCapabilities } from '../../lib/planCapabilities';

interface StudioSettingsTabProps {
  siteId: string;
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
  socials: ProfileSocialLink[];
  onSocialsChange: (val: ProfileSocialLink[]) => void;
  bookingConfig: BookingConfig;
  onBookingConfigChange: (val: BookingConfig) => void;
  onExportJson: () => void;
  onResetDefaults: () => void;
  onUpgradePlan?: () => void;
  onOpenAccountSettings?: () => void;
  locale: Locale;
}

type SettingsSection = 'account' | 'domain' | 'products' | 'scheduling' | 'integrations' | 'billing';

const normalizeSettingsSection = (value: string | null): SettingsSection => {
  switch (value) {
    case 'domain': return 'domain';
    case 'products': return 'products';
    case 'scheduling':
    case 'bookings': return 'scheduling';
    case 'integrations': return 'integrations';
    case 'billing': return 'billing';
    // Preserve the old settings URLs while moving their content into Account.
    case 'site':
    case 'advanced':
    case 'account':
    default: return 'account';
  }
};

export const StudioSettingsTab: React.FC<StudioSettingsTabProps> = ({
  siteId,
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
  socials,
  onSocialsChange,
  bookingConfig,
  onBookingConfigChange,
  onExportJson,
  onResetDefaults,
  onUpgradePlan,
  onOpenAccountSettings,
  locale
}) => {
  const isRtl = locale === 'ar';
  const capabilities = getPlanCapabilities({ plan: plan === 'pro' || plan === 'studio' ? plan : 'free' });
  const settingsSections: Array<{ id: SettingsSection; label: string; icon: typeof UserRound }> = [
    { id: 'account', label: isRtl ? 'الحساب' : 'Account', icon: UserRound },
    { id: 'domain', label: isRtl ? 'النطاق و SEO' : 'Domain & SEO', icon: Globe },
    { id: 'products', label: isRtl ? 'المنتجات' : 'Products', icon: ShoppingBag },
    { id: 'scheduling', label: isRtl ? 'الحجوزات' : 'Scheduling', icon: CalendarDays },
    { id: 'integrations', label: isRtl ? 'التكاملات' : 'Integrations', icon: Zap },
    { id: 'billing', label: isRtl ? 'الفوترة' : 'Billing', icon: CreditCard }
  ];
  const [activeSubSection, setActiveSubSection] = useState<SettingsSection>(() => {
    if (typeof window === 'undefined') return 'account';
    return normalizeSettingsSection(new URLSearchParams(window.location.search).get('settings'));
  });
  const [domainVerified, setDomainVerified] = useState(false);
  const [domainStatus, setDomainStatus] = useState<'idle' | 'pending' | 'verified' | 'failed'>('idle');
  const [domainSslStatus, setDomainSslStatus] = useState<'pending' | 'active' | 'failed' | ''>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [domainId, setDomainId] = useState('');
  const [dnsRecords, setDnsRecords] = useState<Array<{ type: string; name: string; value: string }>>([]);
  const [domainError, setDomainError] = useState('');
  const [integrations, setIntegrations] = useState<SocialIntegrationStatus[]>([]);
  const [integrationError, setIntegrationError] = useState('');
  const [integrationBusy, setIntegrationBusy] = useState('');

  const getApiHeaders = async (): Promise<Record<string, string>> => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadIntegrations = async () => {
    try {
      const response = await fetch('/api/integrations', { headers: await getApiHeaders() });
      if (!response.ok) return;
      const payload = await response.json();
      setIntegrations(Array.isArray(payload.integrations) ? payload.integrations : []);
    } catch (_) { setIntegrationError(isRtl ? 'تعذر تحميل حالة الربط.' : 'Could not load integration status.'); }
  };

  useEffect(() => {
    if (activeSubSection === 'integrations' || new URLSearchParams(window.location.search).get('integration') === 'github') loadIntegrations();
  }, [activeSubSection]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('integration') === 'github') setActiveSubSection('integrations');
  }, []);

  const selectSettingsSection = (section: SettingsSection) => {
    setActiveSubSection(section);
    const query = new URLSearchParams(window.location.search);
    query.set('settings', section);
    window.history.replaceState({}, '', `${window.location.pathname}?${query.toString()}${window.location.hash}`);
  };

  const handleSettingsNavKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = settingsSections.findIndex((section) => section.id === activeSubSection);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % settingsSections.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + settingsSections.length) % settingsSections.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = settingsSections.length - 1;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    const nextSection = settingsSections[nextIndex];
    selectSettingsSection(nextSection.id);
    document.getElementById(`studio-settings-tab-${nextSection.id}`)?.focus();
  };

  const connectGithub = async () => {
    setIntegrationBusy('github');
    setIntegrationError('');
    try {
      const response = await fetch('/api/integrations/github/start?format=json', { headers: await getApiHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.url !== 'string') throw new Error(payload?.error?.message || payload?.message || 'GitHub integration is unavailable.');
      window.location.assign(payload.url);
    } catch (error) { setIntegrationError(error instanceof Error ? error.message : 'GitHub connection failed.'); setIntegrationBusy(''); }
  };

  const disconnectIntegration = async (provider: string) => {
    setIntegrationBusy(provider);
    try {
      const response = await fetch(`/api/integrations/${provider}`, { method: 'DELETE', headers: await getApiHeaders() });
      if (!response.ok) throw new Error('Could not disconnect integration.');
      setIntegrations((current) => current.filter((item) => item.provider !== provider));
    } catch (error) { setIntegrationError(error instanceof Error ? error.message : 'Could not disconnect integration.'); }
    finally { setIntegrationBusy(''); }
  };

  const addSocialLink = () => onSocialsChange([...socials, { platform: 'instagram', url: '', enabled: true }]);

  useEffect(() => {
    if (activeSubSection !== 'domain' || !customDomain) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/domains', { headers: await getApiHeaders() });
        if (!response.ok) return;
        const payload = await response.json();
        const existing = (payload.domains || []).find((domain: any) => domain.hostname === customDomain && domain.siteId === siteId);
        if (!cancelled && existing) {
          setDomainId(existing.domainId);
          setDomainVerified(existing.verificationStatus === 'verified' && existing.sslStatus === 'active');
          setDomainStatus(existing.verificationStatus || 'idle');
          setDomainSslStatus(existing.sslStatus || '');
          setDnsRecords(existing.dnsRecords || []);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [activeSubSection, customDomain, siteId]);

  const handleVerifyDomain = async () => {
    setIsVerifying(true);
    setDomainError('');
    setDomainStatus('pending');
    try {
      const headers = { 'Content-Type': 'application/json', ...(await getApiHeaders()) };
      let activeDomainId = domainId;
      let payload: any = null;
      if (!activeDomainId) {
        const provision = await fetch('/api/domains/provision', {
          method: 'POST',
          headers,
          body: JSON.stringify({ hostname: customDomain, siteId })
        });
        payload = await provision.json();
        if (!provision.ok) throw new Error(payload.error || 'Could not provision domain');
        activeDomainId = payload.domain.domainId;
        setDomainId(activeDomainId);
        setDnsRecords(payload.dnsRecords || payload.domain.dnsRecords || []);
      }

      const retryDelays = [1000, 2000, 4000, 8000, 16000];
      for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
        const verification = await fetch('/api/domains/verify', {
          method: 'POST',
          headers,
          body: JSON.stringify({ domainId: activeDomainId })
        });
        const verifiedPayload = await verification.json();
        if (!verification.ok) throw new Error(verifiedPayload.error || 'Could not verify domain');

        const domain = verifiedPayload.domain;
        const verified = domain.verificationStatus === 'verified' && domain.sslStatus === 'active';
        setDomainStatus(domain.verificationStatus || 'pending');
        setDomainSslStatus(domain.sslStatus || 'pending');
        setDomainVerified(verified);
        setDnsRecords(domain.dnsRecords || dnsRecords);
        if (verified) return;
        if (domain.verificationStatus === 'failed' || domain.sslStatus === 'failed') {
          throw new Error(domain.lastError || 'DNS or SSL verification failed');
        }
        if (attempt < retryDelays.length - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, retryDelays[attempt]));
        }
      }
      throw new Error('DNS verification is still pending. Confirm the records and try again shortly.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not verify domain';
      setDomainStatus(message.startsWith('DNS verification is still pending') ? 'pending' : 'failed');
      setDomainError(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!domainId || isRemoving) return;
    if (!window.confirm(isRtl ? 'هل تريد إزالة هذا النطاق؟' : 'Remove this custom domain?')) return;
    setIsRemoving(true);
    setDomainError('');
    try {
      const response = await fetch(`/api/domains/${encodeURIComponent(domainId)}`, {
        method: 'DELETE',
        headers: await getApiHeaders()
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not remove domain');
      onCustomDomainChange('');
      setDomainId('');
      setDomainVerified(false);
      setDomainStatus('idle');
      setDomainSslStatus('');
      setDnsRecords([]);
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Could not remove domain');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Settings Navigation Bar */}
      <div role="tablist" aria-label={isRtl ? 'أقسام الإعدادات' : 'Settings sections'} className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
        {settingsSections.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              id={`studio-settings-tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`studio-settings-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectSettingsSection(tab.id)}
              onKeyDown={handleSettingsNavKeyDown}
              className={`min-h-11 shrink-0 rounded-xl px-3 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
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

      {/* Account */}
      {activeSubSection === 'account' && (
        <div id="studio-settings-panel-account" role="tabpanel" aria-labelledby="studio-settings-tab-account" tabIndex={0} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isRtl ? 'الحساب وإدارة الموقع' : 'Account & site management'}
          </h3>

          <div className="space-y-3.5">
            <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">{isRtl ? 'إعدادات الحساب' : 'Account settings'}</p>
                <p className="mt-1 text-[11px] text-slate-500">{isRtl ? 'الملف الشخصي، البريد، وكلمة المرور' : 'Profile, email, password, and account security'}</p>
              </div>
              <button type="button" onClick={onOpenAccountSettings} disabled={!onOpenAccountSettings} className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                {isRtl ? 'فتح إعدادات الحساب' : 'Open account settings'}
              </button>
            </div>
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={onExportJson} className="min-h-11 rounded-xl border border-slate-200 p-3.5 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 rtl:text-right">
                <div className="mb-1 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400"><Download className="h-4 w-4" /><span>{isRtl ? 'تصدير نسخة احتياطية' : 'Export site backup'}</span></div>
                <p className="text-[11px] text-slate-500">{isRtl ? 'تحميل إعدادات الموقع كملف JSON' : 'Download your site configuration as JSON'}</p>
              </button>
              <button type="button" onClick={onResetDefaults} className="min-h-11 rounded-xl border border-rose-200 p-3.5 text-left transition-colors hover:bg-rose-50 dark:border-rose-900/60 dark:hover:bg-rose-950/30 rtl:text-right">
                <div className="mb-1 flex items-center gap-2 text-xs font-bold text-rose-600"><Trash2 className="h-4 w-4" /><span>{isRtl ? 'استعادة إعدادات القالب' : 'Reset template defaults'}</span></div>
                <p className="text-[11px] text-slate-500">{isRtl ? 'إعادة ضبط الروابط والتصميم' : 'Restore the starting template settings'}</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Domain & SEO */}
      {activeSubSection === 'domain' && (
        <div id="studio-settings-panel-domain" role="tabpanel" aria-labelledby="studio-settings-tab-domain" tabIndex={0} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
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
                disabled={!capabilities.customDomains}
                  onChange={(e) => {
                  onCustomDomainChange(e.target.value.toLowerCase().trim());
                  setDomainVerified(false);
                  setDomainStatus('idle');
                  setDomainSslStatus('');
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
                disabled={isVerifying || !customDomain || !capabilities.customDomains}
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

          {domainId && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className={`font-bold ${domainStatus === 'verified' && domainSslStatus === 'active' ? 'text-emerald-600 dark:text-emerald-400' : domainStatus === 'failed' || domainSslStatus === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {domainStatus === 'verified' && domainSslStatus === 'active'
                  ? (isRtl ? 'تم التحقق وSSL مفعل' : 'Verified and SSL active')
                  : domainStatus === 'failed' || domainSslStatus === 'failed'
                  ? (isRtl ? 'فشل التحقق' : 'Verification failed')
                  : (isRtl ? 'بانتظار DNS وSSL' : 'Waiting for DNS and SSL')}
              </span>
              <button
                type="button"
                onClick={handleRemoveDomain}
                disabled={isRemoving || isVerifying}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isRemoving ? (isRtl ? 'جارٍ الإزالة...' : 'Removing...') : (isRtl ? 'إزالة النطاق' : 'Remove domain')}
              </button>
            </div>
          )}

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

      {/* Products */}
      {activeSubSection === 'products' && (
        <div id="studio-settings-panel-products" role="tabpanel" aria-labelledby="studio-settings-tab-products" tabIndex={0} className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{isRtl ? 'إدارة المنتجات' : 'Product management'}</h3>
            <p className="mt-1 text-xs text-slate-500">{isRtl ? 'إدارة ما تبيعه وأسعاره ومخزونه.' : 'Manage what you sell, including prices, inventory, and checkout settings.'}</p>
          </div>
          <StudioProductsSettings siteId={siteId} locale={locale} />
        </div>
      )}

      {/* Scheduling & Bookings */}
      {activeSubSection === 'scheduling' && (
        <div id="studio-settings-panel-scheduling" role="tabpanel" aria-labelledby="studio-settings-tab-scheduling" tabIndex={0} className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{isRtl ? 'الحجوزات والمواعيد' : 'Scheduling & bookings'}</h3>
            <p className="mt-1 text-xs text-slate-500">{isRtl ? 'حدد الخدمات والأوقات والتقويم المتصل.' : 'Configure services, availability, booking rules, and calendar connections.'}</p>
          </div>
          <StudioSchedulingSettings siteId={siteId} value={bookingConfig} onChange={onBookingConfigChange} locale={locale} allowCalendarIntegration={capabilities.studioControls} />
        </div>
      )}

      {/* 3. Integrations */}
      {activeSubSection === 'integrations' && (
        <div id="studio-settings-panel-integrations" role="tabpanel" aria-labelledby="studio-settings-tab-integrations" tabIndex={0} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isRtl ? 'الربط مع بكسل التتبع والتحليلات' : 'Analytics & Pixel Integrations'}
          </h3>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40" aria-labelledby="social-integrations-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 id="social-integrations-heading" className="text-xs font-bold text-slate-900 dark:text-white">{isRtl ? 'الروابط الاجتماعية والتكاملات' : 'Social links & integrations'}</h4>
                <p className="mt-1 text-[11px] text-slate-500">{isRtl ? 'الروابط العادية لا تحتاج صلاحيات. اربط GitHub بأمان لإدارة الاتصال من الخادم.' : 'Normal profile URLs stay simple. Connect GitHub securely; OAuth tokens remain server-side.'}</p>
              </div>
              <button type="button" onClick={addSocialLink} className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900">{isRtl ? 'إضافة رابط' : 'Add URL'}</button>
            </div>
            {socials.map((social, index) => (
              <div key={`${social.platform}-${index}`} className="flex gap-2">
                <select value={social.platform} onChange={(event) => onSocialsChange(socials.map((item, itemIndex) => itemIndex === index ? { ...item, platform: event.target.value } : item))} className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white" aria-label="Social platform">
                  {['instagram', 'x', 'youtube', 'linkedin', 'tiktok', 'github', 'spotify', 'email'].map((platform) => <option key={platform} value={platform}>{platform}</option>)}
                </select>
                <input type="url" value={social.url} onChange={(event) => onSocialsChange(socials.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} placeholder="https://github.com/username" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white" aria-label="Social profile URL" />
                <button type="button" onClick={() => onSocialsChange(socials.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg px-2 text-rose-600 hover:bg-rose-50" aria-label={isRtl ? 'حذف الرابط' : 'Remove social URL'}>×</button>
              </div>
            ))}
            <div className="rounded-lg border border-indigo-200 bg-white p-3 dark:border-indigo-900 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-bold text-slate-900 dark:text-white">GitHub</p><p className="text-[11px] text-slate-500">{isRtl ? 'حساب متصل بصلاحية read:user فقط' : 'OAuth connection with the minimal read:user scope'}</p></div>
                {integrations.some((item) => item.provider === 'github' && item.status === 'connected') ? <button type="button" onClick={() => disconnectIntegration('github')} disabled={Boolean(integrationBusy)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-600 disabled:opacity-50">{integrationBusy === 'github' ? '...' : (isRtl ? 'فصل' : 'Disconnect')}</button> : <button type="button" onClick={connectGithub} disabled={Boolean(integrationBusy)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">{integrationBusy === 'github' ? '...' : (isRtl ? 'ربط GitHub' : 'Connect GitHub')}</button>}
              </div>
              {integrations.filter((item) => item.provider === 'github').map((item) => <p key={item.provider} className="mt-2 text-[11px] text-emerald-600">{item.status === 'connected' ? `${item.accountLabel} · ${item.scopes.join(', ')}` : (item.lastError || 'Reconnect required')}</p>)}
            </div>
            {integrationError && <p role="alert" className="text-xs font-semibold text-rose-600">{integrationError}</p>}
          </section>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Google Analytics 4 (Measurement ID)
            </label>
            <input
              type="text"
              value={ga4Id}
              disabled={!capabilities.analytics}
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
              disabled={!capabilities.analytics}
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
              disabled={!capabilities.studioControls}
              onChange={(e) => onWebhookUrlChange(e.target.value)}
              placeholder="https://hooks.zapier.com/..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {/* 4. Billing */}
      {activeSubSection === 'billing' && (
        <div id="studio-settings-panel-billing" role="tabpanel" aria-labelledby="studio-settings-tab-billing" tabIndex={0} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
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

    </div>
  );
};
