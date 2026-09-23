import React, { useState } from 'react';
import { X, ArrowRight, Check, Sparkles, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Locale } from '../../types';
import { RaloaMark } from '../brand/RaloaLogo';
import { useAuth } from '../../hooks/useAuth';
import { useModalA11y } from '../../hooks/useModalA11y';

interface AuthModalProps {
  initialMode?: 'signin' | 'signup';
  locale: Locale;
  onClose: () => void;
  onSuccess: (email: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'signin',
  locale,
  onClose,
  onSuccess
}) => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [resetSent, setResetSent] = useState(false);
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
    if (code === 'auth/invalid-email') {
      return isRtl ? 'عنوان البريد الإلكتروني غير صالح.' : 'Invalid email address format.';
    }
    return err?.message || (isRtl ? 'حدث خطأ أثناء المصادقة. يرجى المحاولة ثانية.' : 'Authentication error. Please try again.');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setLoading(true);

    try {
      if (mode === 'forgot') {
        await sendPasswordReset(email);
        setResetSent(true);
        setLoading(false);
        return;
      }

      if (!password) {
        setError(isRtl ? 'يرجى إدخال كلمة المرور.' : 'Please enter your password.');
        setLoading(false);
        return;
      }

      let user;
      if (mode === 'signup') {
        user = await signUpWithEmail(email, password);
      } else {
        user = await signInWithEmail(email, password);
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
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <RaloaMark size={24} />
              <span id="auth-dialog-title" className="text-xs font-bold text-slate-800">
              {mode === 'signin'
                ? isRtl ? 'تسجيل الدخول إلى رالوا' : 'Sign in to RALOA'
                : mode === 'signup'
                ? isRtl ? 'إنشاء حساب جديد' : 'Create your RALOA account'
                : isRtl ? 'استعادة كلمة المرور' : 'Reset your password'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isRtl ? 'إغلاق' : 'Close'}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {isRtl ? 'مرحباً بك مجدداً!' : 'Welcome back!'}
              </h3>
              <p className="text-xs text-slate-500">
                {isRtl ? 'تم تسجيل الدخول بنجاح عبر Firebase' : 'Authenticated securely with Firebase'}
              </p>
            </div>
          ) : resetSent ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full mx-auto flex items-center justify-center">
                <Mail className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {isRtl ? 'تم إرسال رابط الاستعادة' : 'Check your inbox'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
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
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
              >
                {isRtl ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Google OAuth Login Button */}
              {mode !== 'forgot' && (
                <>
                  <div>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2.5 transition-all shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                      )}
                      <span>
                        {mode === 'signup'
                          ? isRtl ? 'التسجيل بواسطة حساب Google' : 'Sign up with Google'
                          : isRtl ? 'متابعة بواسطة حساب Google' : 'Continue with Google'}
                      </span>
                    </button>
                  </div>

                  <div className="relative flex items-center justify-center">
                    <div className="border-t border-slate-200 w-full" />
                    <span className="bg-white px-3 text-[11px] text-slate-400 font-medium uppercase absolute">
                      {isRtl ? 'أو عبر البريد' : 'or email'}
                    </span>
                  </div>
                </>
              )}

              {mode === 'forgot' && (
                <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                  {isRtl
                    ? 'أدخل عنوان بريدك الإلكتروني المسجل وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.'
                    : 'Enter your registered email address and we will send you a secure link to reset your password.'}
                </p>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRtl ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 rtl:left-auto rtl:right-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {isRtl ? 'كلمة المرور' : 'Password'}
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
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
                      className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
                        : (isRtl ? 'إرسال رابط الاستعادة' : 'Send Reset Link')}
                    </span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </>
                )}
              </button>

              <div className="text-center pt-2 space-y-1">
                {mode === 'forgot' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('signin');
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
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
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
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
