import React, { useState } from 'react';
import { X, Send, Check, MessageSquare } from 'lucide-react';
import { Locale } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useModalA11y } from '../../hooks/useModalA11y';

interface ContactModalProps {
  locale: Locale;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ locale, onClose }) => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useModalA11y<HTMLDivElement>();
  const isRtl = locale === 'ar';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !message) return;
    setLoading(true);
    setError('');

    try {
      const resp = await fetch('/api/v1/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name || 'Anonymous',
          email,
          subject: 'General Inquiry',
          message
        })
      });

      if (resp.status === 429) {
        setError(isRtl ? 'تم تجاوز حد إرسال الرسائل (أقصى حد ٥ رسائل بالساعة).' : 'Rate limit exceeded: maximum 5 inquiries per hour per IP.');
        setLoading(false);
        return;
      }

      if (!resp.ok) {
        throw new Error('CONTACT_SUBMISSION_FAILED');
      }

      setSent(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error saving contact message:', err);
      setError(isRtl ? 'تعذر إرسال الرسالة. حاول مرة أخرى.' : 'We could not send your message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-dialog-title"
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
        
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span id="contact-dialog-title" className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isRtl ? 'تواصل مع فريق دعم رالوا' : 'Contact RALOA Support'}
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

        <div className="p-6">
          {sent ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full mx-auto flex items-center justify-center">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {isRtl ? 'تم إرسال رسالتك بنجاح!' : 'Message Received!'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRtl
                  ? 'سيقوم أحد أعضاء فريقنا بالرد على بريدك خلال ساعات قليلة.'
                  : 'Our dedicated creator support team will respond to your email shortly.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'الاسم' : 'Your Name'}
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isRtl ? 'سارة المنصوري' : 'Alex Rivera'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'كيف يمكننا مساعدتك؟' : 'How can we help?'}
                </label>
                <textarea
                  id="contact-message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={isRtl ? 'اكتب استفسارك هنا...' : 'Questions about custom domains, Arabic localization, or enterprise plans...'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  required
                />
              </div>

              {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isRtl ? 'إرسال الرسالة' : 'Send Inquiry'}</span>
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
