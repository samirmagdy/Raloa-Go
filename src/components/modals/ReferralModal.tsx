import React, { useState, useEffect } from 'react';
import {
  X,
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Send,
  PartyPopper,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Locale } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';
import { PremiumMark } from '../brand/PremiumMark';

interface ReferralModalProps {
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
}

interface MockInvite {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  date: string;
  dateAr: string;
  status: 'completed' | 'pending';
}

const DEFAULT_INVITES: MockInvite[] = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    handle: '@sarah.design',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    date: '2 days ago',
    dateAr: 'منذ يومين',
    status: 'completed'
  },
  {
    id: '2',
    name: 'Tariq Al-Mansour',
    handle: '@tariq.media',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    date: 'Yesterday',
    dateAr: 'أمس',
    status: 'completed'
  }
];

const TARGET_INVITES = 3;
const REFERRAL_CODE = 'CREATOR-PRO99';
const REFERRAL_LINK = 'https://raloa.app/join?ref=CREATOR-PRO99';

export const ReferralModal: React.FC<ReferralModalProps> = ({
  isOpen,
  locale,
  onClose
}) => {
  const isRtl = locale === 'ar';
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen);

  const [invites, setInvites] = useState<MockInvite[]>(() => {
    try {
      const saved = localStorage.getItem('raloa_mock_referrals');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return DEFAULT_INVITES;
  });

  const [copied, setCopied] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Synchronize storage
  useEffect(() => {
    try {
      localStorage.setItem('raloa_mock_referrals', JSON.stringify(invites));
    } catch {
      // Ignore
    }
  }, [invites]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const completedCount = invites.filter((i) => i.status === 'completed').length;
  const progressPercent = Math.min(100, Math.round((completedCount / TARGET_INVITES) * 100));
  const remaining = Math.max(0, TARGET_INVITES - completedCount);
  const isGoalReached = completedCount >= TARGET_INVITES;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(REFERRAL_LINK);
      } else {
        const ta = document.createElement('textarea');
        ta.value = REFERRAL_LINK;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch (err) {
      console.error('Failed to copy referral link', err);
    }
  };

  const handleSimulateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendEmail.trim() || isGoalReached) return;

    setIsSimulating(true);
    setFeedbackMsg('');

    setTimeout(() => {
      const username = friendEmail.split('@')[0] || 'friend';
      const newInvite: MockInvite = {
        id: Date.now().toString(),
        name: username.charAt(0).toUpperCase() + username.slice(1),
        handle: `@${username.toLowerCase()}`,
        avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
        date: 'Just now',
        dateAr: 'الآن',
        status: 'completed'
      };

      const updated = [...invites, newInvite];
      setInvites(updated);
      setFriendEmail('');
      setIsSimulating(false);
      setFeedbackMsg(
        isRtl ? 'تم محاكاة انضمام صديق وتأكيد حسابه بنجاح!' : 'Friend joined & verified! +1 counted towards your Pro reward.'
      );

      // Trigger celebratory confetti if goal reached
      if (updated.filter((i) => i.status === 'completed').length >= TARGET_INVITES) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch {
          // ignore
        }
      }
    }, 600);
  };

  const handleResetProgress = () => {
    setInvites(DEFAULT_INVITES);
    setFeedbackMsg('');
    localStorage.removeItem('raloa_mock_referrals');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="referral-modal-title"
      ref={dialogRef}
    >
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-white p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={isRtl ? 'إغلاق' : 'Close'}
          className="absolute top-5 right-5 rtl:right-auto rtl:left-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/80 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-1">
              <PremiumMark className="w-3 h-3" />
              <span>{isRtl ? 'برنامج مكافآت رالوا' : 'RALOA Rewards Program'}</span>
            </div>
            <h2 id="referral-modal-title" className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {isRtl ? 'ادعُ أصدقاءك واحصل على شهر Pro مجاناً' : 'Refer Friends, Earn Free Pro'}
            </h2>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          {isRtl
            ? 'شارك رابط الإحالة الخاص بك مع صناع المحتوى أو زملائك. عندما ينشئ 3 أصدقاء مواقعهم على رالوا، ستحصل تلقائياً على شهر كامل من باقة Pro مجاناً!'
            : 'Share your personal referral link. When 3 friends launch their mini-site on RALOA, you will automatically unlock a free month of RALOA Pro.'}
        </p>

        {/* Progress Card */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 mb-6">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {isRtl ? 'التقدم نحو الشهر المجاني' : 'Progress to Free Pro Month'}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/60">
              {completedCount} / {TARGET_INVITES} {isRtl ? 'دعوات' : 'Invites'}
            </span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isGoalReached
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Milestone Status Message */}
          <div className="mt-3 flex items-center justify-between text-xs">
            {isGoalReached ? (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <PartyPopper className="w-4 h-4" />
                <span>
                  {isRtl
                    ? 'مبروك! حققت الهدف وشهرك المجاني مفعل جاهز للاستخدام.'
                    : 'Reward Unlocked! Free Pro Month activated on your account.'}
                </span>
              </div>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">
                {isRtl
                  ? `متبقي ${remaining} ${remaining === 1 ? 'صديق واحد' : 'أصدقاء'} فقط لتفعيل المكافأة!`
                  : `Only ${remaining} more friend${remaining === 1 ? '' : 's'} needed for a full month of Pro!`}
              </span>
            )}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Unique Referral Link Box */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            {isRtl ? 'رابط الإحالة المخصص لك' : 'Your Unique Referral Link'}
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                value={REFERRAL_LINK}
                className="w-full pl-3.5 pr-10 rtl:pl-10 rtl:pr-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs sm:text-sm text-slate-900 dark:text-slate-100 select-all focus:outline-none"
              />
              <span className="absolute inset-y-0 right-3 rtl:right-auto rtl:left-3 flex items-center text-slate-400 text-[10px] uppercase font-bold tracking-wider pointer-events-none">
                {REFERRAL_CODE}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>{isRtl ? 'تم النسخ!' : 'Copied!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>{isRtl ? 'نسخ الرابط' : 'Copy'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Invited Friends List */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            {isRtl ? 'سجل الدعوات الأخيرة' : 'Recent Invitation Activity'}
          </h3>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={inv.avatar}
                    alt={inv.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-300 dark:border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {inv.name}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {inv.handle} • {isRtl ? inv.dateAr : inv.date}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'مؤكد (+1)' : 'Joined (+1)'}</span>
                </div>
              </div>
            ))}

            {/* Empty slot placeholder if not yet 3 */}
            {!isGoalReached && (
              <div className="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300 block">
                      {isRtl ? 'المقعد الشاغر الأخير' : 'Pending Invite Slot'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {isRtl ? 'ادعُ صديقاً لإكمال الـ 3 دعوات' : 'Invite a creator to complete your goal'}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-indigo-500 font-medium">
                  {isRtl ? 'في الانتظار' : 'Pending'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Simulate Friend Signup (Interactive Demo Tool) */}
        {!isGoalReached && (
          <form
            onSubmit={handleSimulateInvite}
            className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/60 mb-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                {isRtl ? 'محاكاة دعوة صديق (تجربة تفاعلية)' : 'Simulate a Friend Invite (Interactive Demo)'}
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                {isRtl ? 'اختبر شريط التقدم' : 'Test progress bar'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder={isRtl ? 'بريد الصديق (مثال: noor@gmail.com)...' : 'Friend email (e.g. noor@gmail.com)...'}
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-850 border border-indigo-200 dark:border-indigo-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
              <button
                type="submit"
                disabled={isSimulating}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSimulating ? (isRtl ? 'جارٍ...' : 'Adding...') : (isRtl ? 'محاكاة' : 'Simulate')}</span>
              </button>
            </div>
            {feedbackMsg && (
              <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {feedbackMsg}
              </p>
            )}
          </form>
        )}

        {isGoalReached && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center mb-6">
            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200 mb-1">
              <span className="inline-flex items-center gap-1.5">
                <PremiumMark variant="voucher" className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                {isRtl ? 'كود قسيمة شهر Pro المجاني' : 'Your Free Pro Month Voucher Code'}
              </span>
            </h4>
            <div className="inline-block px-4 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/80 border border-emerald-300 dark:border-emerald-700 font-mono text-xs font-bold text-emerald-800 dark:text-emerald-200 my-2">
              PRO-30DAYS-FREE-BONUS
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
              {isRtl
                ? 'تم تطبيق الخصم 100% تلقائياً عند ترقية حسابك.'
                : 'Discount automatically applied at checkout for 100% off your next renewal.'}
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{isRtl ? 'دعوات آمنة وبدون قيود' : 'Fair use & no cap on rewards'}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetProgress}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px] cursor-pointer underline transition-colors"
            >
              {isRtl ? 'إعادة ضبط المحاكاة' : 'Reset demo'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer transition-colors"
            >
              {isRtl ? 'تم' : 'Done'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
