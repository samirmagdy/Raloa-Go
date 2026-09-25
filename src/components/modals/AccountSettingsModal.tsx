import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  ChevronRight,
  CreditCard,
  Globe2,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  UserRound,
  UsersRound,
  X
} from 'lucide-react';
import { Locale, UserProfile } from '../../types';
import { auth, googleProvider, sendPasswordReset, storage, recordReferralInvite } from '../../lib/firebase';
import { EmailAuthProvider, OAuthProvider, linkWithPopup, reauthenticateWithCredential, sendEmailVerification, unlink, updatePassword, verifyBeforeUpdateEmail } from 'firebase/auth';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

type Section = 'profile' | 'security' | 'notifications' | 'privacy' | 'billing' | 'referrals' | 'connected' | 'danger';
type Preferences = {
  notifications: Record<string, boolean>;
  privacy: Record<string, boolean>;
  channels: Record<string, boolean>;
};
type Billing = { plan: string; interval: string; status: string; renewalDate: string | null };
type BillingDetails = { invoices: Array<{ id: string; number: string | null; status: string | null; amountPaid: number; currency: string; created: number; hostedInvoiceUrl: string | null }>; paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null };
type ReferralSummary = {
  referralLink: string;
  qualifiedCount: number;
  pendingCount: number;
  rewards: { verifiedBadgeUnlocked?: boolean; freeProMonthsEarned?: number; customDomainUnlocked?: boolean };
  rewardExpiresAt: string | null;
};
type ReferralInvite = { id: string; email: string | null; status: string; createdAt: string | null };

interface AccountSettingsModalProps {
  locale: Locale;
  profile: UserProfile | null;
  onClose: () => void;
  onProfileUpdated: () => Promise<void> | void;
  onSelectLocale: (locale: Locale) => void;
  onManageBilling: () => void;
  onOpenPricing: () => void;
  onSignOut: () => Promise<void>;
}

const inputClass = 'w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const sectionClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_-24px_rgba(15,23,42,.35)] dark:border-slate-800 dark:bg-slate-900';

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  locale,
  profile,
  onClose,
  onProfileUpdated,
  onSelectLocale,
  onManageBilling,
  onOpenPricing,
  onSignOut
}) => {
  const isRtl = locale === 'ar';
  const [section, setSection] = useState<Section>('profile');
  const [profileForm, setProfileForm] = useState({ displayName: '', bio: '', pronouns: '', location: '', website: '', locale, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
  const [preferences, setPreferences] = useState<Preferences>({ notifications: {}, privacy: {}, channels: {} });
  const [billing, setBilling] = useState<Billing | null>(null);
  const [billingDetails, setBillingDetails] = useState<BillingDetails>({ invoices: [], paymentMethod: null });
  const [referrals, setReferrals] = useState<ReferralSummary | null>(null);
  const [referralInvites, setReferralInvites] = useState<ReferralInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [providerBusy, setProviderBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.photoURL || '');

  const copy = useMemo(() => isRtl ? {
    title: 'إعدادات الحساب', subtitle: 'تحكّم في هويتك وأمانك وبياناتك.', profile: 'الملف الشخصي', security: 'الأمان وتسجيل الدخول', notifications: 'الإشعارات', privacy: 'الخصوصية والبيانات', billing: 'الخطة والفوترة', referrals: 'الإحالات والمكافآت', connected: 'التطبيقات المرتبطة', danger: 'منطقة حساسة', save: 'حفظ التغييرات', saved: 'تم حفظ التغييرات', failed: 'تعذر حفظ التغييرات', loading: 'جارٍ تحميل الإعدادات…'
  } : {
    title: 'Account settings', subtitle: 'Control your identity, security, and data.', profile: 'Profile', security: 'Security & login', notifications: 'Notifications', privacy: 'Privacy & data', billing: 'Billing & plan', referrals: 'Referrals & rewards', connected: 'Connected apps', danger: 'Danger zone', save: 'Save changes', saved: 'Changes saved', failed: 'Could not save changes', loading: 'Loading settings…'
  }, [isRtl]);

  const sections: Array<{ id: Section; label: string; icon: React.ElementType }> = [
    { id: 'profile', label: copy.profile, icon: UserRound },
    { id: 'security', label: copy.security, icon: LockKeyhole },
    { id: 'notifications', label: copy.notifications, icon: Bell },
    { id: 'privacy', label: copy.privacy, icon: ShieldCheck },
    { id: 'billing', label: copy.billing, icon: CreditCard },
    { id: 'referrals', label: copy.referrals, icon: UsersRound },
    { id: 'connected', label: copy.connected, icon: Globe2 },
    { id: 'danger', label: copy.danger, icon: LogOut }
  ];

  const request = async (path: string, init?: RequestInit) => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    const response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || body?.error || body?.message || 'Request failed');
    return body;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [account, prefs, accountBilling, accountBillingDetails, accountReferrals] = await Promise.all([
          request('/api/account/profile'),
          request('/api/account/preferences'),
          request('/api/account/billing'),
          request('/api/account/billing/details'),
          request('/api/account/referrals')
        ]);
        if (cancelled) return;
        const next = account.profile || {};
        setProfileForm({
          displayName: next.displayName || profile?.displayName || '',
          bio: next.bio || '',
          pronouns: next.pronouns || '',
          location: next.location || '',
          website: next.website || '',
          locale: next.locale === 'ar' ? 'ar' : locale,
          timeZone: next.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        });
        setPreferences({ notifications: prefs.notifications || {}, privacy: prefs.privacy || {}, channels: prefs.channels || {} });
        setBilling(accountBilling.billing || null);
        setBillingDetails(accountBillingDetails || { invoices: [], paymentMethod: null });
        setReferrals(accountReferrals.summary || null);
        setReferralInvites(accountReferrals.invitations || []);
        setAvatarUrl(next.photoURL || profile?.photoURL || '');
      } catch (error) {
        if (!cancelled) setStatus({ type: 'error', text: error instanceof Error ? error.message : copy.failed });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const response = await request('/api/account/profile', { method: 'PUT', body: JSON.stringify(profileForm) });
      setProfileForm((current) => ({ ...current, ...(response.profile || {}) }));
      onSelectLocale(profileForm.locale);
      await onProfileUpdated();
      setStatus({ type: 'success', text: copy.saved });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : copy.failed });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !auth.currentUser) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setStatus({ type: 'error', text: isRtl ? 'استخدم JPG أو PNG أو WebP بحجم 5MB أو أقل.' : 'Use a JPG, PNG, or WebP image up to 5 MB.' });
      return;
    }
    setAvatarBusy(true);
    try {
      const objectRef = storageRef(storage, `users/${auth.currentUser.uid}/avatar`);
      await uploadBytes(objectRef, file, { contentType: file.type, cacheControl: 'public,max-age=3600' });
      const photoURL = await getDownloadURL(objectRef);
      await request('/api/account/profile', { method: 'PUT', body: JSON.stringify({ photoURL }) });
      setAvatarUrl(photoURL);
      await auth.currentUser.reload();
      await onProfileUpdated();
      setStatus({ type: 'success', text: isRtl ? 'تم تحديث الصورة.' : 'Avatar updated.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : (isRtl ? 'تعذر رفع الصورة.' : 'Avatar upload failed.') });
    } finally {
      setAvatarBusy(false);
      event.target.value = '';
    }
  };

  const removeAvatar = async () => {
    if (!auth.currentUser || !avatarUrl) return;
    setAvatarBusy(true);
    try {
      await deleteObject(storageRef(storage, `users/${auth.currentUser.uid}/avatar`)).catch(() => undefined);
      await request('/api/account/profile', { method: 'PUT', body: JSON.stringify({ photoURL: '' }) });
      setAvatarUrl('');
      await onProfileUpdated();
      setStatus({ type: 'success', text: isRtl ? 'تمت إزالة الصورة.' : 'Avatar removed.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : (isRtl ? 'تعذر إزالة الصورة.' : 'Avatar could not be removed.') });
    } finally {
      setAvatarBusy(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const response = await request('/api/account/preferences', { method: 'PUT', body: JSON.stringify(preferences) });
      setPreferences({ notifications: response.notifications, privacy: response.privacy, channels: response.channels });
      setStatus({ type: 'success', text: copy.saved });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : copy.failed });
    } finally {
      setSaving(false);
    }
  };

  const sendResetEmail = async () => {
    if (!auth.currentUser?.email) return;
    setSaving(true);
    try {
      await sendPasswordReset(auth.currentUser.email);
      setStatus({ type: 'success', text: isRtl ? 'تم إرسال رابط تغيير كلمة المرور إلى بريدك.' : 'A password reset link was sent to your email.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : copy.failed });
    } finally {
      setSaving(false);
    }
  };

  const resendVerification = async () => {
    if (!auth.currentUser || auth.currentUser.emailVerified) return;
    setSecurityBusy(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setStatus({ type: 'success', text: isRtl ? 'تم إرسال رسالة التحقق.' : 'Verification email sent.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : copy.failed });
    } finally {
      setSecurityBusy(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth.currentUser?.email || newPassword.length < 6) {
      setStatus({ type: 'error', text: isRtl ? 'كلمة المرور الجديدة يجب أن تتكون من 6 أحرف على الأقل.' : 'The new password must be at least 6 characters.' });
      return;
    }
    setSecurityBusy(true);
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, currentPassword));
      await updatePassword(auth.currentUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setStatus({ type: 'success', text: isRtl ? 'تم تغيير كلمة المرور.' : 'Password changed.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : copy.failed });
    } finally {
      setSecurityBusy(false);
    }
  };

  const changeEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth.currentUser || !newEmail.trim()) return;
    setSecurityBusy(true);
    try {
      if (!auth.currentUser.email) throw new Error('Current email is unavailable.');
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, currentPassword));
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail.trim().toLowerCase());
      setNewEmail('');
      setCurrentPassword('');
      setStatus({ type: 'success', text: isRtl ? 'تحقق من بريدك الجديد لإكمال التغيير.' : 'Check your new email to complete the change.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : copy.failed });
    } finally {
      setSecurityBusy(false);
    }
  };

  const requestDeletion = async () => {
    if (!window.confirm(isRtl ? 'هل تريد طلب حذف حسابك؟ سيتواصل معك فريق الدعم للتأكيد.' : 'Request account deletion? Support will contact you to confirm.')) return;
    setSaving(true);
    try {
      await request('/api/account/delete-request', { method: 'POST' });
      setDeleteRequested(true);
      setStatus({ type: 'success', text: isRtl ? 'تم تسجيل طلب الحذف.' : 'Deletion request recorded.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : copy.failed });
    } finally {
      setSaving(false);
    }
  };

  const exportAccountData = async () => {
    setSaving(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const response = await fetch('/api/account/export', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('Export is temporarily unavailable.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'raloa-account-export.json';
      link.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', text: isRtl ? 'تم تنزيل نسخة بياناتك.' : 'Your data export downloaded.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : copy.failed });
    } finally {
      setSaving(false);
    }
  };

  const toggleGoogleProvider = async () => {
    if (!auth.currentUser) return;
    setProviderBusy(true);
    try {
      const connected = auth.currentUser.providerData.some((provider) => provider.providerId === 'google.com');
      if (connected) {
        if (auth.currentUser.providerData.length <= 1) throw new Error(isRtl ? 'أضف وسيلة دخول أخرى قبل إزالة Google.' : 'Add another sign-in method before disconnecting Google.');
        await unlink(auth.currentUser, 'google.com');
      } else {
        await linkWithPopup(auth.currentUser, googleProvider);
      }
      await auth.currentUser.reload();
      setStatus({ type: 'success', text: isRtl ? 'تم تحديث التطبيقات المرتبطة.' : 'Connected apps updated.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : copy.failed });
    } finally {
      setProviderBusy(false);
    }
  };

  const toggleAppleProvider = async () => {
    if (!auth.currentUser) return;
    setProviderBusy(true);
    try {
      const connected = auth.currentUser.providerData.some((provider) => provider.providerId === 'apple.com');
      if (connected) {
        if (auth.currentUser.providerData.length <= 1) throw new Error(isRtl ? 'أضف وسيلة دخول أخرى قبل إزالة Apple.' : 'Add another sign-in method before disconnecting Apple.');
        await unlink(auth.currentUser, 'apple.com');
      } else {
        await linkWithPopup(auth.currentUser, new OAuthProvider('apple.com'));
      }
      await auth.currentUser.reload();
      setStatus({ type: 'success', text: isRtl ? 'تم تحديث التطبيقات المرتبطة.' : 'Connected apps updated.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : copy.failed });
    } finally {
      setProviderBusy(false);
    }
  };

  const sendReferralInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth.currentUser || !inviteEmail.trim()) return;
    setInviteBusy(true);
    try {
      await recordReferralInvite(auth.currentUser.uid, inviteEmail.trim());
      setInviteEmail('');
      const refreshed = await request('/api/account/referrals');
      setReferrals(refreshed.summary || null);
      setStatus({ type: 'success', text: isRtl ? 'تم حفظ الدعوة.' : 'Invitation saved.' });
    } catch (error) {
      setStatus({ type: 'error', text: error instanceof Error ? error.message : (isRtl ? 'تعذر حفظ الدعوة.' : 'Invitation could not be saved.') });
    } finally {
      setInviteBusy(false);
    }
  };

  const togglePreference = (group: keyof Preferences, key: string) => {
    setPreferences((current) => ({ ...current, [group]: { ...current[group], [key]: !current[group][key] } }));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:p-5" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-[#f7f8fc] shadow-2xl dark:bg-slate-950 sm:h-[min(760px,calc(100vh-40px))] sm:rounded-[28px] sm:border sm:border-slate-200 dark:sm:border-slate-800">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-7">
          <div>
            <p className="text-lg font-black tracking-[-0.03em] text-slate-950 dark:text-white">{copy.title}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={isRtl ? 'إغلاق' : 'Close'} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:hover:bg-slate-800 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:w-60 md:flex-col md:overflow-visible md:border-b-0 md:border-e md:p-4">
            {sections.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => { setSection(id); setStatus(null); }} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-indigo-500/20 md:w-full ${section === id ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {section === id && <ChevronRight className="ms-auto hidden h-4 w-4 md:block rtl:rotate-180" />}
              </button>
            ))}
          </nav>

          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
            {loading ? <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">{copy.loading}</div> : (
              <>
                {status && <div role="status" className={`mb-5 flex items-center gap-2 rounded-xl border px-3.5 py-3 text-sm ${status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'}`}><Check className="h-4 w-4 shrink-0" />{status.text}</div>}

                {section === 'profile' && <form onSubmit={saveProfile} className="space-y-5">
                  <div className={sectionClass}>
                    <div className="flex items-center gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
                      {avatarUrl ? <img src={avatarUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-black text-white">{(profileForm.displayName || 'C')[0].toUpperCase()}</div>}
                      <div className="min-w-0 flex-1"><h2 className="font-bold text-slate-950 dark:text-white">{isRtl ? 'هويتك العامة' : 'Your public identity'}</h2><p className="mt-1 text-sm text-slate-500">{isRtl ? 'هذه البيانات تظهر في موقعك العام.' : 'These details appear on your public site.'}</p></div>
                      <div className="flex shrink-0 gap-2"><label className="min-h-11 cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-200">{avatarBusy ? '…' : (isRtl ? 'تغيير الصورة' : 'Change photo')}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadAvatar} disabled={avatarBusy} /></label>{avatarUrl && <button type="button" onClick={removeAvatar} disabled={avatarBusy} className="min-h-11 rounded-xl border border-rose-200 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:text-rose-300">{isRtl ? 'إزالة' : 'Remove'}</button>}</div>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{isRtl ? 'الاسم الظاهر' : 'Display name'}<input className={`${inputClass} mt-2`} value={profileForm.displayName} onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })} maxLength={80} required /></label>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{isRtl ? 'المعرّف العام' : 'Public handle'}<input className={`${inputClass} mt-2 cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-900`} value={`@${profile?.handle || 'creator'}`} readOnly aria-describedby="handle-help" /><span id="handle-help" className="mt-1 block text-xs font-normal text-slate-500">{isRtl ? 'يُغيّر من خلال تدفق حجز المعرّف.' : 'Change it through the handle reservation flow.'}</span></label>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">{isRtl ? 'النبذة' : 'Bio'}<textarea className={`${inputClass} mt-2 min-h-28 py-3`} value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} maxLength={500} /></label>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{isRtl ? 'الضمائر' : 'Pronouns'}<input className={`${inputClass} mt-2`} value={profileForm.pronouns} onChange={(e) => setProfileForm({ ...profileForm, pronouns: e.target.value })} maxLength={60} /></label>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{isRtl ? 'الموقع' : 'Location'}<input className={`${inputClass} mt-2`} value={profileForm.location} onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })} maxLength={100} /></label>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{isRtl ? 'الموقع الإلكتروني' : 'Website'}<input className={`${inputClass} mt-2`} type="url" placeholder="https://" value={profileForm.website} onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })} /></label>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{isRtl ? 'اللغة' : 'Language'}<select className={`${inputClass} mt-2`} value={profileForm.locale} onChange={(e) => setProfileForm({ ...profileForm, locale: e.target.value as Locale })}><option value="en">English</option><option value="ar">العربية</option></select></label>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">{isRtl ? 'المنطقة الزمنية' : 'Time zone'}<input className={`${inputClass} mt-2`} value={profileForm.timeZone} onChange={(e) => setProfileForm({ ...profileForm, timeZone: e.target.value })} /></label>
                    </div>
                  </div>
                  <div className="flex justify-end"><button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-indigo-600 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-slate-950">{saving ? '…' : copy.save}</button></div>
                </form>}

                {section === 'security' && <div className="space-y-5"><div className={sectionClass}><h2 className="font-bold text-slate-950 dark:text-white">{copy.security}</h2><p className="mt-1 text-sm text-slate-500">{isRtl ? 'حافظ على وصولك آمناً.' : 'Keep access to your account secure.'}</p><div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800"><div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-semibold text-slate-900 dark:text-white">{isRtl ? 'البريد الإلكتروني' : 'Email address'}</p><p className="mt-1 text-sm text-slate-500">{auth.currentUser?.email || profile?.email || '—'}</p></div><span className="text-xs font-bold text-emerald-600">{auth.currentUser?.emailVerified ? (isRtl ? 'تم التحقق' : 'Verified') : (isRtl ? 'غير متحقق' : 'Unverified')}</span></div><div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-semibold text-slate-900 dark:text-white">{isRtl ? 'كلمة المرور' : 'Password'}</p><p className="mt-1 text-sm text-slate-500">{isRtl ? 'أرسل رابطاً آمناً لتغيير كلمة المرور.' : 'Send a secure link to change your password.'}</p></div><button type="button" onClick={sendResetEmail} disabled={saving} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-200">{isRtl ? 'إرسال الرابط' : 'Send reset link'}</button></div></div></div><div className={sectionClass}><h2 className="font-bold text-slate-950 dark:text-white">{isRtl ? 'جلسة هذا الجهاز' : 'Current session'}</h2><p className="mt-1 text-sm text-slate-500">{isRtl ? 'يمكنك تسجيل الخروج من هذا الجهاز الآن.' : 'You are currently signed in on this device.'}</p><button type="button" onClick={onSignOut} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"><LogOut className="h-4 w-4" />{isRtl ? 'تسجيل الخروج' : 'Sign out'}</button></div></div>}

                {section === 'security' && <div className="space-y-5"><div className={sectionClass}>{!auth.currentUser?.emailVerified && <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><span>{isRtl ? 'لم يتم التحقق من بريدك بعد.' : 'Your email is not verified yet.'}</span><button type="button" onClick={resendVerification} disabled={securityBusy} className="min-h-10 rounded-lg bg-amber-600 px-3 text-xs font-bold text-white disabled:opacity-60">{isRtl ? 'إرسال التحقق' : 'Resend verification'}</button></div>}<h2 className="font-bold text-slate-950 dark:text-white">{isRtl ? 'تحديث بيانات الدخول' : 'Update sign-in details'}</h2><p className="mt-1 text-sm text-slate-500">{isRtl ? 'يتطلب التغيير تأكيد كلمة المرور الحالية.' : 'Changes require your current password for account protection.'}</p><form onSubmit={changePassword} className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">{isRtl ? 'كلمة المرور الحالية' : 'Current password'}<input className={`${inputClass} mt-2`} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required /></label><label className="text-xs font-bold text-slate-600 dark:text-slate-300">{isRtl ? 'كلمة المرور الجديدة' : 'New password'}<input className={`${inputClass} mt-2`} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" minLength={6} required /></label><button type="submit" disabled={securityBusy} className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-60 dark:bg-white dark:text-slate-950 sm:col-span-2">{securityBusy ? '…' : (isRtl ? 'تغيير كلمة المرور' : 'Change password')}</button></form><form onSubmit={changeEmail} className="mt-6 grid gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">{isRtl ? 'البريد الجديد' : 'New email'}<input className={`${inputClass} mt-2`} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" required /></label><div className="flex items-end"><button type="submit" disabled={securityBusy} className="min-h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200">{isRtl ? 'إرسال رابط التحقق' : 'Verify new email'}</button></div></form></div></div>}

                {section === 'notifications' && <div className="space-y-5"><PreferenceSection title={copy.notifications} description={isRtl ? 'اختر ما تريد أن يصلك.' : 'Choose what RALOA should send you.'} items={[['productUpdates', isRtl ? 'تحديثات المنتج' : 'Product updates'], ['billing', isRtl ? 'الفوترة وفشل الدفع' : 'Billing and payment failures'], ['domains', isRtl ? 'النطاقات وSSL' : 'Domains and SSL'], ['bookings', isRtl ? 'طلبات الحجز' : 'Booking requests'], ['orders', isRtl ? 'تحديثات الطلبات' : 'Order updates'], ['referrals', isRtl ? 'الإحالات والمكافآت' : 'Referral rewards'], ['analyticsSummary', isRtl ? 'ملخص التحليلات الأسبوعي' : 'Weekly analytics summary'], ['security', isRtl ? 'تنبيهات الأمان' : 'Security alerts']]} values={preferences.notifications} onToggle={(key) => togglePreference('notifications', key)} onSave={savePreferences} saving={saving} saveLabel={copy.save} /><PreferenceSection title={isRtl ? 'قنوات الإشعار' : 'Notification channels'} description={isRtl ? 'اختر أين تريد استلام التنبيهات.' : 'Choose where you want to receive alerts.'} items={[[ 'email', isRtl ? 'البريد الإلكتروني' : 'Email' ], [ 'inApp', isRtl ? 'داخل التطبيق' : 'In-app' ]]} values={preferences.channels} onToggle={(key) => togglePreference('channels', key)} onSave={savePreferences} saving={saving} saveLabel={copy.save} /></div>}

                {section === 'privacy' && <PreferenceSection title={copy.privacy} description={isRtl ? 'تحكم في ظهور بياناتك واستخدامها.' : 'Control how your profile and analytics are used.'} items={[['profilePublished', isRtl ? 'موقعك منشور' : 'Public profile is published'], ['searchIndexing', isRtl ? 'السماح لمحركات البحث بالفهرسة' : 'Allow search engines to index my profile'], ['analyticsCollection', isRtl ? 'السماح بجمع تحليلات الزوار' : 'Allow visitor analytics collection']]} values={preferences.privacy} onToggle={(key) => togglePreference('privacy', key)} onSave={savePreferences} saving={saving} saveLabel={copy.save} />}

                {section === 'billing' && <div className="space-y-5"><div className={sectionClass}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-indigo-600">{isRtl ? 'الخطة الحالية' : 'Current plan'}</p><h2 className="mt-2 text-3xl font-black capitalize text-slate-950 dark:text-white">{billing?.plan || profile?.plan || 'free'}</h2><p className="mt-1 text-sm text-slate-500">{billing?.status || profile?.billingStatus || 'free'} · {billing?.interval || 'monthly'}</p></div><CreditCard className="h-6 w-6 text-indigo-600" /></div>{billing?.renewalDate && <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">{isRtl ? 'التجديد القادم: ' : 'Renews: '}{new Date(billing.renewalDate).toLocaleDateString(locale)}</p>}<button type="button" onClick={billing?.plan === 'free' ? onOpenPricing : onManageBilling} className="mt-5 min-h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-indigo-600 dark:bg-white dark:text-slate-950">{billing?.plan === 'free' ? (isRtl ? 'استعرض الخطط' : 'View plans') : (isRtl ? 'إدارة الفوترة' : 'Manage billing')}</button></div></div>}
                {section === 'billing' && billingDetails.paymentMethod && <div className={sectionClass}><h2 className="font-bold text-slate-950 dark:text-white">{isRtl ? 'وسيلة الدفع' : 'Payment method'}</h2><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{billingDetails.paymentMethod.brand.toUpperCase()} ···· {billingDetails.paymentMethod.last4} · {billingDetails.paymentMethod.expMonth}/{billingDetails.paymentMethod.expYear}</p></div>}
                {section === 'billing' && billingDetails.invoices.length > 0 && <div className={sectionClass}><h2 className="font-bold text-slate-950 dark:text-white">{isRtl ? 'الفواتير الأخيرة' : 'Recent invoices'}</h2><div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{billingDetails.invoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-slate-600 dark:text-slate-300">{invoice.number || invoice.id} · {new Date(invoice.created * 1000).toLocaleDateString(locale)}</span>{invoice.hostedInvoiceUrl ? <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="font-bold text-indigo-600 hover:text-indigo-700">{isRtl ? 'عرض' : 'View'}</a> : <span className="text-slate-400">{invoice.status || '—'}</span>}</div>)}</div></div>}

                {section === 'referrals' && <div className="space-y-5"><div className={sectionClass}><p className="text-xs font-bold uppercase tracking-[.14em] text-indigo-600">{isRtl ? 'مكافآتك' : 'Your rewards'}</p><h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{referrals?.qualifiedCount || 0} {isRtl ? 'إحالات مؤهلة' : 'qualified referrals'}</h2><p className="mt-1 text-sm text-slate-500">{referrals?.pendingCount || 0} {isRtl ? 'دعوات معلقة' : 'pending invitations'}</p><div className="mt-5 flex gap-2"><input className={`${inputClass} min-w-0`} value={referrals?.referralLink || ''} readOnly /><button type="button" onClick={() => referrals?.referralLink && navigator.clipboard.writeText(referrals.referralLink)} className="min-h-11 shrink-0 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700">{isRtl ? 'نسخ' : 'Copy'}</button></div></div><div className={sectionClass}><h2 className="font-bold text-slate-950 dark:text-white">{isRtl ? 'فتح المكافآت' : 'Unlocked benefits'}</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{[[Boolean(referrals?.rewards.verifiedBadgeUnlocked), isRtl ? 'شارة موثّق' : 'Verified badge'], [Boolean((referrals?.rewards.freeProMonthsEarned || 0) > 0), isRtl ? 'أشهر Pro مجانية' : 'Free Pro months'], [Boolean(referrals?.rewards.customDomainUnlocked), isRtl ? 'نطاق مخصص' : 'Custom domain']].map(([active, label]) => <div key={String(label)} className={`rounded-xl border p-3 text-sm font-semibold ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-slate-200 text-slate-400 dark:border-slate-800'}`}>{active ? '✓ ' : ''}{label}</div>)}</div></div></div>}

                {section === 'referrals' && <form onSubmit={sendReferralInvite} className={sectionClass}><h2 className="font-bold text-slate-950 dark:text-white">{isRtl ? 'دعوة صديق' : 'Invite a friend'}</h2><p className="mt-1 text-sm text-slate-500">{isRtl ? 'احفظ بريد صديق لمتابعة دعوته.' : 'Save a friend’s email to track the invitation.'}</p><div className="mt-4 flex gap-2"><input className={`${inputClass} min-w-0`} type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="friend@example.com" required /><button type="submit" disabled={inviteBusy} className="min-h-11 shrink-0 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-60 dark:bg-white dark:text-slate-950">{inviteBusy ? '…' : (isRtl ? 'حفظ الدعوة' : 'Save invite')}</button></div></form>}
                {section === 'referrals' && referralInvites.length > 0 && <div className={sectionClass}><h2 className="font-bold text-slate-950 dark:text-white">{isRtl ? 'سجل الدعوات' : 'Invitation history'}</h2><div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">{referralInvites.map((invite) => <div key={invite.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="truncate text-slate-600 dark:text-slate-300">{invite.email || '—'}</span><span className="shrink-0 text-xs font-bold capitalize text-slate-500">{invite.status}</span></div>)}</div>{referrals?.rewardExpiresAt && <p className="mt-4 text-xs text-slate-500">{isRtl ? 'تنتهي مكافأة Pro في ' : 'Pro reward expires '}{new Date(referrals.rewardExpiresAt).toLocaleDateString(locale)}.</p>}</div>}

                {section === 'connected' && <div className="space-y-5"><div className={sectionClass}><h2 className="font-bold text-slate-950 dark:text-white">{copy.connected}</h2><p className="mt-1 text-sm text-slate-500">{isRtl ? 'إدارة طرق تسجيل الدخول المرتبطة بحسابك.' : 'Manage the sign-in providers connected to your account.'}</p><ProviderRow name="Google" connected={Boolean(auth.currentUser?.providerData.some((provider) => provider.providerId === 'google.com'))} busy={providerBusy} onToggle={toggleGoogleProvider} isRtl={isRtl} /><ProviderRow name="Apple" connected={Boolean(auth.currentUser?.providerData.some((provider) => provider.providerId === 'apple.com'))} busy={providerBusy} onToggle={toggleAppleProvider} isRtl={isRtl} /><p className="mt-3 text-xs leading-5 text-slate-500">{isRtl ? 'لن تتمكن من إزالة آخر وسيلة دخول مرتبطة بالحساب.' : 'You cannot remove the last sign-in method from your account.'}</p></div></div>}

                {section === 'danger' && <div className="space-y-5"><div className={sectionClass}><h2 className="font-bold text-slate-950 dark:text-white">{isRtl ? 'نسخة من بياناتك' : 'A copy of your data'}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">{isRtl ? 'نزّل ملف JSON يحتوي على بيانات حسابك وموقعك وإحالاتك.' : 'Download a JSON copy of your account, site, and referral data.'}</p><button type="button" onClick={exportAccountData} disabled={saving} className="mt-5 min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">{isRtl ? 'تنزيل بياناتي' : 'Download my data'}</button></div><div className={`${sectionClass} border-rose-200 dark:border-rose-900`}><h2 className="font-bold text-rose-800 dark:text-rose-300">{isRtl ? 'طلب حذف الحساب' : 'Request account deletion'}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">{isRtl ? 'سنرسل طلبك إلى فريق الدعم للتأكد من الفوترة والبيانات قبل الحذف النهائي.' : 'We record your request so support can confirm billing and data requirements before permanent deletion.'}</p><button type="button" onClick={requestDeletion} disabled={saving || deleteRequested} className="mt-5 min-h-11 rounded-xl border border-rose-300 px-4 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300">{deleteRequested ? (isRtl ? 'تم تسجيل الطلب' : 'Request recorded') : (isRtl ? 'طلب حذف الحساب' : 'Request deletion')}</button></div></div>}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

const PreferenceSection: React.FC<{ title: string; description: string; items: Array<[string, string]>; values: Record<string, boolean>; onToggle: (key: string) => void; onSave: () => void; saving: boolean; saveLabel: string }> = ({ title, description, items, values, onToggle, onSave, saving, saveLabel }) => (
  <div className="space-y-5"><div className={sectionClass}><h2 className="font-bold text-slate-950 dark:text-white">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p><div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">{items.map(([key, label]) => <label key={key} className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3"><span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span><input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={Boolean(values[key])} onChange={() => onToggle(key)} /></label>)}</div></div><div className="flex justify-end"><button type="button" onClick={onSave} disabled={saving} className="min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-60 dark:bg-white dark:text-slate-950">{saving ? '…' : saveLabel}</button></div></div>
);

const ProviderRow: React.FC<{ name: string; connected: boolean; busy: boolean; onToggle: () => void; isRtl: boolean }> = ({ name, connected, busy, onToggle, isRtl }) => (
  <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
    <div><p className="text-sm font-bold text-slate-900 dark:text-white">{name}</p><p className="mt-1 text-xs text-slate-500">{connected ? (isRtl ? 'مرتبط' : 'Connected') : (isRtl ? 'غير مرتبط' : 'Not connected')}</p></div>
    <button type="button" onClick={onToggle} disabled={busy} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200">{busy ? '…' : connected ? (isRtl ? 'إزالة' : 'Disconnect') : (isRtl ? 'ربط' : 'Connect')}</button>
  </div>
);
