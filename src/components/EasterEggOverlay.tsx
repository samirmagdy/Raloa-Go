import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  PartyPopper,
  X,
  Zap,
  Crown,
  Share2,
  Check,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { Locale } from '../types';
import { fireSiteLaunchConfetti } from '../utils/confetti';
import { playCelebratoryFanfare } from '../utils/audio';
import { PremiumMark } from './brand/PremiumMark';

interface EasterEggOverlayProps {
  isOpen: boolean;
  sequenceName: string | null;
  locale: Locale;
  onClose: () => void;
}

export const EasterEggOverlay: React.FC<EasterEggOverlayProps> = ({
  isOpen,
  sequenceName = 'RALOA',
  locale,
  onClose
}) => {
  const isRtl = locale === 'ar';
  const [copied, setCopied] = useState(false);

  // Trigger initial fireworks & celebratory fanfare sound
  useEffect(() => {
    if (isOpen) {
      fireSiteLaunchConfetti();
      playCelebratoryFanfare();

      // Additional secondary burst for maximum celebration
      const timer = setTimeout(() => {
        fireSiteLaunchConfetti();
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleMoreConfetti = () => {
    fireSiteLaunchConfetti();
    playCelebratoryFanfare();
  };

  const handleShareSecret = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://raloa.me';
    const shareUrl = `${origin}/?egg=${encodeURIComponent(sequenceName?.toLowerCase() || 'raloa')}`;

    let succeeded = false;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        succeeded = true;
      } catch {
        succeeded = false;
      }
    }

    if (!succeeded && typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        succeeded = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        succeeded = false;
      }
    }

    if (succeeded) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="easter-egg-celebration-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="easter-egg-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl overflow-y-auto select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Radiant Background Aura */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-amber-500/20 via-indigo-600/25 to-pink-500/20 blur-[130px] rounded-full pointer-events-none animate-pulse duration-1000" />

          {/* Floating celebratory ambient particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[
              { top: '15%', left: '12%', delay: 0, variant: 'spark' as const },
              { top: '22%', right: '15%', delay: 0.4, variant: 'voucher' as const },
              { bottom: '20%', left: '18%', delay: 0.8, variant: 'launch' as const },
              { bottom: '25%', right: '12%', delay: 0.2, variant: 'links' as const },
              { top: '45%', left: '8%', delay: 1.1, variant: 'spark' as const },
              { top: '50%', right: '9%', delay: 0.6, variant: 'launch' as const }
            ].map((glyph, idx) => (
              <motion.div
                key={idx}
                initial={{ y: 20, opacity: 0 }}
                animate={{
                  y: [-10, 15, -10],
                  rotate: [-8, 8, -8],
                  opacity: [0.6, 1, 0.6]
                }}
                transition={{
                  duration: 4 + idx,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: glyph.delay
                }}
                style={{ position: 'absolute', top: glyph.top, left: glyph.left, right: glyph.right }}
                className="w-7 h-7 sm:w-8 sm:h-8 text-white/60 select-none"
              >
                <PremiumMark variant={glyph.variant} />
              </motion.div>
            ))}
          </div>

          {/* Main Card Modal */}
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-[0_0_60px_-15px_rgba(245,158,11,0.35)] overflow-hidden"
          >
            {/* Top gradient accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-pink-500 to-indigo-500" />

            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label={isRtl ? 'إغلاق المفاجأة' : 'Dismiss Easter Egg'}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700/60 z-20"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Glowing Trophy Icon with Rotating Halo */}
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-dashed border-amber-400/40"
              />
              <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-pink-500 blur-md opacity-70 animate-pulse" />
              <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-xl border-2 border-amber-200">
                <Trophy className="w-10 h-10 text-slate-950" />
              </div>
            </div>

            {/* Secret Unlocked Badge */}
            <div className="flex justify-center mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <PremiumMark className="w-3.5 h-3.5" />
                {isRtl ? 'مفاجأة سرية مكتشفة' : 'Secret Easter Egg Unlocked'}
              </span>
            </div>

            {/* Main Headline */}
            <h2
              id="easter-egg-title"
              className="text-2xl sm:text-3xl font-black text-center text-white tracking-tight mb-2"
            >
              {isRtl ? 'تهانينا! أنت من نخبة المبدعين' : 'You Found the Secret Code!'}
            </h2>

            {/* Sequence Details */}
            <p className="text-center text-sm text-slate-300 max-w-sm mx-auto mb-6 leading-relaxed">
              {isRtl ? (
                <>
                  لقد أدخلت الشفرة السرية بنجاح:{' '}
                  <span className="font-mono font-bold text-amber-300 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                    {sequenceName}
                  </span>
                  . تم فتح وضع الاحتفال والامتيازات الخفية لمنصة رالوا!
                </>
              ) : (
                <>
                  You entered the secret sequence:{' '}
                  <span className="font-mono font-bold text-amber-300 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                    {sequenceName}
                  </span>
                  . You have unlocked RALOA&apos;s hidden creator celebration perks!
                </>
              )}
            </p>

            {/* Secret Creator Perks Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6 text-left rtl:text-right">
              <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center sm:flex-col sm:items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {isRtl ? 'شارة VIP المميزة' : 'VIP Creator Badge'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isRtl ? 'توهج ذهبي مخصص' : 'Custom golden aura'}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center sm:flex-col sm:items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {isRtl ? 'سرعة قصوى 100%' : '100% Turbo Boost'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isRtl ? 'تحميل فائق السرعة' : 'Instant edge cache'}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center sm:flex-col sm:items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {isRtl ? 'إبداع غير محدود' : 'Endless Spark'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isRtl ? 'قوالب وميزات خاصة' : 'VIP theme access'}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Confetti Trigger */}
              <button
                type="button"
                onClick={handleMoreConfetti}
                className="w-full sm:flex-1 py-3 px-4 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-400 hover:via-orange-400 hover:to-pink-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <PartyPopper className="w-4 h-4" />
                <span>{isRtl ? 'إطلاق المزيد من الألعاب النارية' : 'Launch More Confetti'}</span>
              </button>

              {/* Share / Copy Code Trigger */}
              <button
                type="button"
                onClick={handleShareSecret}
                className="w-full sm:w-auto px-4 py-3 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">{isRtl ? 'تم نسخ الرابط!' : 'Link Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-indigo-400" />
                    <span>{isRtl ? 'مشاركة السر' : 'Share Secret'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Footer Dismiss Hint */}
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer underline-offset-4 hover:underline"
              >
                <span>{isRtl ? 'إغلاق ومتابعة التصفح (Esc)' : 'Dismiss and continue browsing (Esc)'}</span>
              </button>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
