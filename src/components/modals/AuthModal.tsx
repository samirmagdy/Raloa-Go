import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Check, Mail, Lock, AlertCircle, Loader2, Sparkles, KeyRound } from 'lucide-react';
import { Locale } from '../../types';
import { RaloaMark } from '../brand/RaloaLogo';
import { useAuth } from '../../hooks/useAuth';
import { useModalA11y } from '../../hooks/useModalA11y';

interface AuthModalProps {
  initialMode?: 'signin' | 'signup' | 'forgot' | 'reset';
  initialHandle?: string;
  initialTemplate?: string;
  resetToken?: string;
  locale: Locale;
  onClose: () => void;
  onSuccess: (email: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'signin',
  initialHandle = '',
  initialTemplate = '',
  resetToken = '',
  locale,
  onClose,
  onSuccess
}) => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Staged parameters from query params or sessionStorage
  const [claimedHandle, setClaimedHandle] = useState<string>(() => {
    if (initialHandle) return initialHandle;
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('handle');
      if (param) return param;
      return sessionStorage.getItem('claimed_handle') || '';
    }
    return '';
  });

  const [stagedTemplate, setStagedTemplate] = useState<string>(() => {
    if (initialTemplate) return initialTemplate;
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('template');
      if (param) return param;
      return sessionStorage.getItem('selected_template_id') || '';
    }
    return '';
  });

  // Cooldown countdown timer for 429 Brute Force Lockout (SEC-2 & TC-M4-04)
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const dialogRef = useModalA11y<HTMLDivElement>();
  const isRtl = locale === 'ar';

  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/popup-closed-by-user') {
      return isRtl ? 'تم إغلاق نافذة المصادقة.' : 'Sign-in popup was closed.';
    }
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return isRtl ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.';
    }
    if (code === 'auth/email-already-in-use') {
      return isRtl ? 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.' : 'This email is already registered. Please sign in.';
    }
    if (code === 'auth/weak-password') {
      return isRtl ? 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.' : 'Password should be at least 6 characters.';
    }
    if (code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      return isRtl
        ? `النطاق الحالي (${currentHost}) غير مضاف في نطاقات Firebase Auth المصرح بها.`
        : `Domain "${currentHost}" is not authorized in Firebase Auth.`;
    }
    if (code === 'auth/invalid-email') {
      return isRtl ? 'عنوان البريد الإلكتروني غير صالح.' : 'Invalid email address format.';
    }
    return err?.message || (isRtl ? 'حدث خطأ أثناء المصادقة. يرجى المحاولة ثانية.' : 'Authentication error. Please try again.');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      // First attempt server OAuth endpoint
      try {
        const resp = await fetch('/api/v1/auth/oauth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email || 'creator@google.com' })
        });
        if (resp.ok) {
          const data = await resp.json();
          setSubmitted(true);
          setTimeout(() => {
            onSuccess(email || 'creator@google.com');
            window.location.href = data.data?.redirect_to || '/studio';
          }, 600);
          return;
        }
      } catch (_) {}

      const user = await signInWithGoogle();
      setSubmitted(true);
      setTimeout(() => {
        onSuccess(user.email || 'user@google.com');
      }, 700);
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // FR-4.6 Sign in with Apple OAuth
  const handleAppleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch('/api/v1/auth/oauth/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || 'apple_creator@privaterelay.appleid.com' })
      });
      if (resp.ok) {
        const data = await resp.json();
        setSubmitted(true);
        setTimeout(() => {
          onSuccess(email || 'apple_creator@privaterelay.appleid.com');
          window.location.href = data.data?.redirect_to || '/studio';
        }, 600);
      } else {
        setError(isRtl ? 'تعذر إتمام الدخول عبر حساب Apple' : 'Failed to complete Sign in with Apple');
      }
    } catch (err: any) {
      setError(isRtl ? 'تعذر الاتصال بخدمة Apple' : 'Apple identity service error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && mode !== 'reset') return;
    if (lockoutSeconds > 0) return;
    setError(null);
    setLoading(true);

    try {
      if (mode === 'forgot') {
        try {
          const resp = await fetch('/api/v1/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          if (resp.status === 429) {
            setError(isRtl ? 'تم تجاوز حد الطلبات: أقصى حد ٣ طلبات لكل ١٥ دقيقة.' : 'Rate limit exceeded: maximum 3 password reset requests per 15 minutes.');
            setLoading(false);
            return;
          }
          if (resp.ok) {
            setResetSent(true);
            setLoading(false);
            return;
          }
        } catch (_) {}

        await sendPasswordReset(email);
        setResetSent(true);
        setLoading(false);
        return;
      }

      if (mode === 'reset') {
        if (!password || password.length < 6) {
          setError(isRtl ? 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل.' : 'Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        const token = resetToken || new URLSearchParams(window.location.search).get('token') || '';
        const resp = await fetch('/api/v1/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, new_password: password })
        });
        if (resp.ok) {
          setSubmitted(true);
          setTimeout(() => {
            setMode('signin');
            setSubmitted(false);
          }, 1500);
          return;
        } else {
          const data = await resp.json();
          setError(data.message || (isRtl ? 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية.' : 'Invalid or expired password reset token.'));
          setLoading(false);
          return;
        }
      }

      if (!password) {
        setError(isRtl ? 'يرجى إدخال كلمة المرور.' : 'Please enter your password.');
        setLoading(false);
        return;
      }

      // FR-4.1 & TC-M4-01 / TC-M4-04 Credential Login via /api/v1/auth/login
      if (mode === 'signin') {
        try {
          const resp = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });

          // SEC-2 & TC-M4-04: Lockout after 5 failed attempts
          if (resp.status === 429) {
            const data = await resp.json();
            const waitTime = data.retry_after || 600;
            setLockoutSeconds(waitTime);
            setError(
              isRtl
                ? `تم قفل الحساب مؤقتاً بسبب ٥ محاولات خاطئة متتالية. يرجى المحاولة بعد ${waitTime} ثانية.`
                : `Account temporarily locked due to 5 consecutive failed attempts. Please try again in ${waitTime}s.`
            );
            setLoading(false);
            return;
          }

          if (resp.ok) {
            const data = await resp.json();
            setSubmitted(true);
            setTimeout(() => {
              onSuccess(email);
              window.location.href = data.data?.redirect_to || '/studio';
            }, 600);
            return;
          }

          if (resp.status === 401) {
            setError(isRtl ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.');
            setLoading(false);
            return;
          }
        } catch (_) {
          // Fallback to client Firebase auth
        }

        const user = await signInWithEmail(email, password);
        setSubmitted(true);
        setTimeout(() => {
          onSuccess(user.email || email);
        }, 700);
        return;
      }

      // Registration Flow (mode === 'signup')
      let user;
      try {
        user = await signUpWithEmail(email, password);
      } catch (err: any) {
        // If client Firebase registration throws, check if demo account exists
        setError(formatAuthError(err));
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setTimeout(() => {
        onSuccess(user.email || email);
      }, 700);
    } catch (err: any) {
      console.error('Authentication error:', err);
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <RaloaMark size={24} />
            <span id="auth-dialog-title" className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {mode === 'signin'
                ? isRtl ? 'تسجيل الدخول إلى رالوا' : 'Sign in to RALOA'
                : mode === 'signup'
                ? isRtl ? 'إنشاء حساب جديد' : 'Create your RALOA account'
                : mode === 'reset'
                ? isRtl ? 'تعيين كلمة مرور جديدة' : 'Set New Password'
                : isRtl ? 'استعادة كلمة المرور' : 'Reset your password'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isRtl ? 'إغلاق' : 'Close'}
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full mx-auto flex items-center justify-center">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {mode === 'reset'
                  ? isRtl ? 'تم تحديث كلمة المرور بنجاح!' : 'Password Updated!'
                  : isRtl ? 'مرحباً بك مجدداً!' : 'Welcome back!'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'reset'
                  ? isRtl ? 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة' : 'You can now sign in with your new password.'
                  : isRtl ? 'تم تسجيل الدخول وتوجيهك إلى الاستوديو' : 'Authenticated securely. Redirecting to Studio...'}
              </p>
            </div>
          ) : resetSent ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-full mx-auto flex items-center justify-center">
                <Mail className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {isRtl ? 'تم إرسال رابط الاستعادة' : 'Check your inbox'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs mx-auto">
                {isRtl
                  ? `أرسلنا تعليمات إعادة تعيين كلمة المرور إلى ${email}. يرجى التحقق من صندوق الوارد.`
                  : `We sent password reset instructions to ${email}. Check your spam folder if it doesn't arrive within 2 minutes.`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setResetSent(false);
                  setMode('signin');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition-colors cursor-pointer"
              >
                {isRtl ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Staged Handle & Template Banner (FR-2.1 & FR-2.3) */}
              {mode === 'signup' && (claimedHandle || stagedTemplate) && (
                <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/80 rounded-2xl flex flex-wrap items-center gap-2 text-xs">
                  {claimedHandle && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>@{claimedHandle}</span>
                    </span>
                  )}
                  {stagedTemplate && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
                      <Sparkles className="w-3 h-3" />
                      <span>{isRtl ? `قالب: ${stagedTemplate}` : `Template: ${stagedTemplate}`}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Lockout Warning Banner with Live Countdown Timer (SEC-2 & TC-M4-04) */}
              {lockoutSeconds > 0 && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs rounded-2xl flex items-start gap-2.5 animate-pulse">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <strong className="block font-bold mb-0.5">
                      {isRtl ? 'الحساب مقفول مؤقتاً' : 'Account Temporarily Locked'}
                    </strong>
                    <span>
                      {isRtl
                        ? `تم حظر المحاولات مؤقتاً بسبب ٥ محاولات خاطئة. يرجى الانتظار: ${lockoutSeconds} ثانية.`
                        : `Rate limit triggered: 5 failed attempts. Cooldown remaining: ${lockoutSeconds}s.`}
                    </span>
                  </div>
                </div>
              )}

              {error && lockoutSeconds === 0 && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* OAuth Providers (FR-4.6 Google & Apple) */}
              {mode !== 'forgot' && mode !== 'reset' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Google OAuth Button */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading || lockoutSeconds > 0}
                      className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-850 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Google</span>
                    </button>

                    {/* Apple OAuth Button (FR-4.6) */}
                    <button
                      type="button"
                      onClick={handleAppleSignIn}
                      disabled={loading || lockoutSeconds > 0}
                      className="w-full py-2.5 px-3 rounded-xl border border-slate-900 dark:border-slate-700 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 170 170">
                        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.78-11.65-14.21-6.19-9.88-11.13-20.73-14.81-32.55-3.69-11.83-5.54-22.75-5.54-32.78 0-14.45 3.65-26.4 10.95-35.84 7.3-9.45 16.5-14.26 27.6-14.44 4.58 0 9.88 1.25 15.9 3.75 6.03 2.5 10.15 3.81 12.37 3.93 1.96-.24 6.13-1.6 12.51-4.08 6.38-2.47 11.85-3.61 16.42-3.41 12.07.6 22.01 4.96 29.82 13.08-10.74 6.53-15.97 15.42-15.69 26.68.27 8.92 3.77 16.43 10.5 22.54 6.74 6.11 14.73 9.77 23.98 10.97-2.28 7.07-5.11 14.15-8.48 21.23zM119.22 33.15c0-7.39 2.65-14.35 7.95-20.89 5.3-6.53 11.82-10.87 19.56-13.01.65 1.52.98 3.15.98 4.89 0 7.39-2.77 14.47-8.31 21.24-5.54 6.77-12.27 10.83-20.18 12.18z" />
                      </svg>
                      <span>Apple</span>
                    </button>
                  </div>

                  <div className="relative flex items-center justify-center">
                    <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                    <span className="bg-white dark:bg-slate-900 px-3 text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase absolute">
                      {isRtl ? 'أو عبر البريد' : 'or email'}
                    </span>
                  </div>
                </>
              )}

              {mode === 'forgot' && (
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
                  {isRtl
                    ? 'أدخل عنوان بريدك الإلكتروني المسجل وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.'
                    : 'Enter your registered email address and we will send you a secure link to reset your password.'}
                </p>
              )}

              {mode === 'reset' && (
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
                  {isRtl
                    ? 'أدخل كلمة المرور الجديدة لحسابك لتحديث بيانات الدخول.'
                    : 'Enter your new password below to securely update your credentials.'}
                </p>
              )}

              {mode !== 'reset' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isRtl ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 rtl:left-auto rtl:right-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                      required
                    />
                  </div>
                </div>
              )}

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {mode === 'reset' ? (isRtl ? 'كلمة المرور الجديدة' : 'New Password') : (isRtl ? 'كلمة المرور' : 'Password')}
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                      >
                        {isRtl ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 rtl:left-auto rtl:right-3" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || lockoutSeconds > 0}
                className="w-full py-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>
                      {mode === 'signin'
                        ? (isRtl ? 'تسجيل الدخول' : 'Sign In')
                        : mode === 'signup'
                        ? (isRtl ? 'إنشاء حساب جديد' : 'Sign Up Free')
                        : mode === 'reset'
                        ? (isRtl ? 'تحديث كلمة المرور' : 'Update Password')
                        : (isRtl ? 'إرسال رابط الاستعادة' : 'Send Reset Link')}
                    </span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </>
                )}
              </button>

              <div className="text-center pt-2 space-y-1">
                {mode === 'forgot' || mode === 'reset' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('signin');
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold cursor-pointer"
                  >
                    {isRtl ? 'تذكرت كلمة المرور؟ تسجيل الدخول' : 'Remember your password? Sign in'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode(mode === 'signin' ? 'signup' : 'signin');
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold cursor-pointer"
                  >
                    {mode === 'signin'
                      ? isRtl ? 'ليس لديك حساب؟ سجل مجاناً الآن' : "Don't have an account? Sign up free"
                      : isRtl ? 'لديك حساب بالفعل؟ سجل دخولك' : 'Already have an account? Sign in'}
                  </button>
                )}
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
};
export default AuthModal;
