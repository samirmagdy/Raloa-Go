import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Check, ShoppingBag, Eye, Camera, Star, ArrowRight, Printer, Loader2 } from 'lucide-react';
import { Locale } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useAuth } from '../../hooks/useAuth';
import { saveBookingAppointment, saveStoreOrder } from '../../lib/firebase';
import { SafeImage } from '../SafeImage';

interface MiniSiteDemoModalProps {
  type: 'portfolio' | 'booking' | 'shop' | 'gear' | null;
  onClose: () => void;
  locale: Locale;
  onStartOwnPage?: (username?: string) => void;
}

export const MiniSiteDemoModal: React.FC<MiniSiteDemoModalProps> = ({
  type,
  onClose,
  locale,
  onStartOwnPage
}) => {
  const { user } = useAuth();
  const isRtl = locale === 'ar';
  const dialogRef = useModalA11y<HTMLDivElement>(Boolean(type));
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedTime, setSelectedTime] = useState('02:00 PM');
  const [bookingEmail, setBookingEmail] = useState(user?.email || 'creator@raloa.app');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderId, setOrderId] = useState('');
  const [cartSuccess, setCartSuccess] = useState(false);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingEmail.trim()) return;
    setBookingLoading(true);
    setBookingError('');
    try {
      await saveBookingAppointment({
        hostHandle: 'elena',
        date: selectedDate,
        timeSlot: selectedTime,
        clientEmail: bookingEmail.trim()
      });
      setBookingConfirmed(true);
    } catch (err) {
      console.error('Error saving booking appointment:', err);
      setBookingError(
        isRtl
          ? 'تعذر تأكيد الحجز. يرجى المحاولة مرة أخرى.'
          : 'Could not confirm booking. Please try again.'
      );
    } finally {
      setBookingLoading(false);
    }
  };

  const handleOrderPurchase = async () => {
    setOrderLoading(true);
    setOrderError('');
    try {
      const id = await saveStoreOrder({
        itemTitle: 'Brutalist Shadow Study #03',
        price: 140,
        currency: 'USD',
        buyerEmail: user?.email || 'collector@raloa.app'
      });
      setOrderId(id);
      setCartSuccess(true);
    } catch (err) {
      console.error('Error processing store order:', err);
      setOrderError(
        isRtl
          ? 'تعذر حفظ طلب الشراء. يرجى المحاولة مرة أخرى.'
          : 'Could not process order. Please try again.'
      );
    } finally {
      setOrderLoading(false);
    }
  };

  if (!type) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 raloa-minisite-modal-container"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mini-site-dialog-title"
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] raloa-minisite-modal-card transition-colors duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 print:border-b-2 print:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
              ER
            </div>
            <div>
              <h3 id="mini-site-dialog-title" className="font-bold text-[15px] text-slate-900 dark:text-white leading-tight">
                {type === 'portfolio' && (isRtl ? 'معرض الأعمال - إيلينا روستوفا' : 'Portfolio - Elena Rostova')}
                {type === 'booking' && (isRtl ? 'حجز جلسة استشارية أو تصوير' : 'Book a Session - Elena Rostova')}
                {type === 'shop' && (isRtl ? 'متجر المطبوعات الفنية' : 'Shop Limited Edition Prints')}
                {type === 'gear' && (isRtl ? 'معدات التصوير والإنتاج' : "Elena's Architectural Kit")}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">raloa.app/@elena</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              aria-label={isRtl ? 'طباعة هذه الصفحة المصغرة' : 'Print this mini-site'}
              title={isRtl ? 'طباعة هذه الصفحة المصغرة' : 'Print this mini-site'}
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              aria-label={isRtl ? 'إغلاق' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* 1. PORTFOLIO GALLERY */}
          {type === 'portfolio' && (
            <div className="space-y-4">
              <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {isRtl
                  ? 'مجموعة مختارة من المشاريع الهندسية والمعمارية في برلين وطوكيو ودبي.'
                  : 'Selected architectural and spatial studies documenting minimalist concrete, brutalist facades and natural morning light.'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
                    title: 'Concrete Villa Pavilion'
                  },
                  {
                    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
                    title: 'Minimalist Loft'
                  },
                  {
                    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80',
                    title: 'Metropolitan Glass Tower'
                  },
                  {
                    url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=400&q=80',
                    title: 'Brutalist Monolith'
                  }
                ].map((item, idx) => (
                  <div key={idx} className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    <SafeImage src={item.url} alt={item.title} className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-2.5">
                      <span className="text-[11px] font-medium text-white">{item.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. BOOKING CALENDAR */}
          {type === 'booking' && (
            <div>
              {bookingConfirmed ? (
                <div className="text-center py-8 space-y-3">
                  <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full mx-auto flex items-center justify-center">
                    <Check className="w-7 h-7 stroke-[3]" />
                  </div>
                  <h4 className="font-extrabold text-lg text-slate-900 dark:text-white">
                    {isRtl ? 'تم تأكيد موعدك بنجاح!' : 'Session Scheduled!'}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xs mx-auto">
                    {isRtl
                      ? `تم حفظ وتأكيد موعدك بتاريخ ${selectedDate} الساعة ${selectedTime}. أُرسلت التفاصيل إلى ${bookingEmail}.`
                      : `Confirmed for ${selectedDate} at ${selectedTime}. Appointment saved to database. Invite sent to ${bookingEmail}.`}
                  </p>
                  <button
                    onClick={() => {
                      setBookingConfirmed(false);
                      setBookingError('');
                    }}
                    className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    {isRtl ? 'حجز موعد آخر' : 'Book another slot'}
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleBookingSubmit}
                  className="space-y-4"
                >
                  <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200">
                    {isRtl
                      ? 'جلسة استشارية فنية لمدة ٦٠ دقيقة عبر جوجل ميت لمناقشة التوجيه الإبداعي والتصوير.'
                      : '60 min Architecture & Creative Direction Consultation via Google Meet.'}
                  </div>

                  <div>
                    <label htmlFor="booking-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isRtl ? 'اختر اليوم' : 'Select Date'}
                    </label>
                    <input
                      id="booking-date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="booking-time-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isRtl ? 'اختر الوقت' : 'Select Time Slot'}
                    </label>
                    <div id="booking-time-select" className="grid grid-cols-3 gap-2">
                      {['10:00 AM', '02:00 PM', '04:30 PM'].map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                            selectedTime === slot
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="booking-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isRtl ? 'بريدك الإلكتروني' : 'Your Email'}
                    </label>
                    <input
                      id="booking-email"
                      type="email"
                      placeholder="you@domain.com"
                      value={bookingEmail}
                      onChange={(e) => setBookingEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                      required
                    />
                  </div>

                  {bookingError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium" role="alert">
                      {bookingError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="w-full py-3 bg-[#0F172A] hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 disabled:opacity-60 text-white dark:text-slate-900 font-bold text-sm rounded-xl transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    {bookingLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isRtl ? 'جاري تأكيد الحجز...' : 'Confirming Booking...'}</span>
                      </>
                    ) : (
                      <span>{isRtl ? 'تأكيد الحجز الفوري' : 'Confirm Instant Booking'}</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 3. SHOP PRINTS */}
          {type === 'shop' && (
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative">
                <SafeImage
                  src="https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80"
                  alt="Minimal Shadow Study"
                  className="w-full h-44 object-cover"
                />
                <span className="absolute top-2 right-2 px-2.5 py-1 bg-black/75 text-white text-[10px] font-bold rounded-full">
                  Edition of 25
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {isRtl ? 'مطبوعة "دراسة الظل المعماري #٠٣"' : '"Brutalist Shadow Study #03"'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Hahnemühle Photo Rag 308gsm Archival Cotton
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white">$140</span>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{isRtl ? 'شحن مجاني' : 'Free Shipping'}</p>
                </div>
              </div>

              {cartSuccess ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold">{isRtl ? 'تم تسجيل وتأكيد الطلب بنجاح في قاعدة البيانات!' : 'Order recorded & confirmed in Firestore!'}</span>
                    {orderId && (
                      <span className="block text-[11px] opacity-80 font-mono mt-0.5">
                        {isRtl ? `معرّف الطلب: ${orderId}` : `Order ID: ${orderId}`}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {orderError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium" role="alert">
                      {orderError}
                    </p>
                  )}
                  <button
                    onClick={handleOrderPurchase}
                    disabled={orderLoading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    {orderLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isRtl ? 'جاري معالجة الطلب...' : 'Processing Order...'}</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>{isRtl ? 'طلب المطبوعة الآن ($١٤٠)' : 'Buy Archival Print ($140)'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. MY GEAR */}
          {type === 'gear' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {isRtl
                  ? 'الأجهزة والعدسات التي أستخدمها في تصوير العمارة والمساحات الضوئية:'
                  : 'The exact camera body, tilt-shift glass and carbon accessories Elena uses on location:'}
              </p>
              <div className="space-y-2">
                {[
                  { name: 'Sony A7R V (61MP Full Frame)', type: 'Camera Body', desc: 'Class-leading dynamic range' },
                  { name: 'Canon TS-E 24mm f/3.5L II (Tilt-Shift)', type: 'Lens', desc: 'Zero perspective distortion' },
                  { name: 'Gitzo Mountaineer Series 3 Tripod', type: 'Support', desc: 'Carbon fiber stability' },
                  { name: 'Profoto B10X Plus Monolight', type: 'Lighting', desc: 'High-speed sync wireless' }
                ].map((gear, i) => (
                  <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-xs text-slate-900 dark:text-white">{gear.name}</h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{gear.desc}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                      {gear.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Call to create your own */}
        <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-850/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 print:hidden">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            {isRtl
              ? 'أعجبك التفاعل؟ يمكنك إنشاء صفحة مطابقة لصفحتك الشخصية الآن.'
              : 'Love this layout? Build your own mini-site in under 60 seconds.'}
          </p>
          <button
            onClick={() => {
              onClose();
              if (onStartOwnPage) onStartOwnPage('elena');
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>{isRtl ? 'أنشئ صفحتك الآن' : 'Create yours'}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
};
