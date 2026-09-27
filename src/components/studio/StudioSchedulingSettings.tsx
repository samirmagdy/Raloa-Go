import React, { useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, Loader2, Plus, Trash2 } from 'lucide-react';
import { BookingConfig, BookingServiceConfig, Locale } from '../../types';
import { auth } from '../../lib/firebase';

export const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  enabled: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  services: [{ id: 'consultation', name: 'Consultation', description: 'A focused session', durationMinutes: 60, bufferMinutes: 15 }],
  weeklyAvailability: {
    '0': { enabled: false, start: '09:00', end: '17:00' },
    '1': { enabled: true, start: '09:00', end: '17:00' },
    '2': { enabled: true, start: '09:00', end: '17:00' },
    '3': { enabled: true, start: '09:00', end: '17:00' },
    '4': { enabled: true, start: '09:00', end: '17:00' },
    '5': { enabled: true, start: '09:00', end: '17:00' },
    '6': { enabled: false, start: '09:00', end: '17:00' }
  },
  blackoutDates: [],
  minNoticeMinutes: 120,
  bookingWindowDays: 60,
  bufferMinutes: 15,
  maxBookingsPerDay: 20,
  calendarProvider: 'none'
};

interface StudioSchedulingSettingsProps {
  siteId: string;
  value: BookingConfig;
  onChange: (value: BookingConfig) => void;
  locale: Locale;
  allowCalendarIntegration?: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const StudioSchedulingSettings: React.FC<StudioSchedulingSettingsProps> = ({ siteId, value, onChange, locale, allowCalendarIntegration = true }) => {
  const isRtl = locale === 'ar';
  const [bookings, setBookings] = useState<Array<{ id: string; customerName?: string; customerEmail?: string; serviceName?: string; localDate?: string; localTime?: string; status?: string; delivery?: { state?: string; failed?: boolean } }>>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [bookingAction, setBookingAction] = useState('');
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsHasMore, setBookingsHasMore] = useState(false);
  const [bookingsCursor, setBookingsCursor] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState('');
  const [calendarError, setCalendarError] = useState('');
  useEffect(() => {
    let active = true;
    const loadBookings = async () => {
      setLoadingBookings(true); setBookingError('');
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        if (!token) throw new Error(isRtl ? 'يرجى تسجيل الدخول.' : 'Authentication is required.');
        const response = await fetch(`/api/creator/bookings?siteId=${encodeURIComponent(siteId)}&limit=50`, { headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || (isRtl ? 'تعذر تحميل الحجوزات.' : 'Could not load bookings.'));
        if (active) {
          setBookings(Array.isArray(payload.bookings) ? payload.bookings : []);
          setBookingsHasMore(Boolean(payload.hasMore));
          setBookingsCursor(payload.nextCursor || null);
        }
      } catch (error) { if (active) setBookingError(error instanceof Error ? error.message : (isRtl ? 'تعذر تحميل الحجوزات.' : 'Could not load bookings.')); }
      finally { if (active) setLoadingBookings(false); }
    };
    void loadBookings();
    return () => { active = false; };
  }, [isRtl, siteId]);
  const loadMoreBookings = async () => {
    if (!bookingsCursor || loadingBookings) return;
    setLoadingBookings(true); setBookingError('');
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      if (!token) throw new Error(isRtl ? 'يرجى تسجيل الدخول.' : 'Authentication is required.');
      const response = await fetch(`/api/creator/bookings?siteId=${encodeURIComponent(siteId)}&limit=50&cursor=${encodeURIComponent(bookingsCursor)}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || (isRtl ? 'تعذر تحميل المزيد من الحجوزات.' : 'Could not load more bookings.'));
      setBookings((current) => [...current, ...(Array.isArray(payload.bookings) ? payload.bookings : [])]);
      setBookingsHasMore(Boolean(payload.hasMore));
      setBookingsCursor(payload.nextCursor || null);
    } catch (error) { setBookingError(error instanceof Error ? error.message : (isRtl ? 'تعذر تحميل المزيد من الحجوزات.' : 'Could not load more bookings.')); }
    finally { setLoadingBookings(false); }
  };
  useEffect(() => {
    let active = true;
    const loadCalendar = async () => {
      setCalendarError('');
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        if (!token || value.calendarProvider === 'none') { if (active) setCalendarConnected(false); return; }
        const response = await fetch('/api/calendar/integrations', { headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || (isRtl ? 'تعذر تحميل حالة التقويم.' : 'Could not load calendar status.'));
        if (active) setCalendarConnected((payload.integrations || []).some((integration: { provider?: string; status?: string }) => integration.provider === value.calendarProvider && integration.status === 'connected'));
      } catch (error) { if (active) setCalendarError(error instanceof Error ? error.message : (isRtl ? 'تعذر تحميل حالة التقويم.' : 'Could not load calendar status.')); }
    };
    void loadCalendar();
    return () => { active = false; };
  }, [isRtl, value.calendarProvider]);
  const updateBooking = async (id: string, action: 'confirm' | 'cancel') => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    if (!token) return;
    setBookingAction(`${id}:${action}`);
    setBookingError('');
    try {
      const response = await fetch(`/api/creator/bookings/${encodeURIComponent(id)}/${action}?siteId=${encodeURIComponent(siteId)}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || (isRtl ? 'تعذر تحديث الحجز.' : 'Could not update booking.'));
      setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status: action === 'confirm' ? 'confirmed' : 'cancelled' } : booking));
    } catch (error) { setBookingError(error instanceof Error ? error.message : (isRtl ? 'تعذر تحديث الحجز.' : 'Could not update booking.')); }
    finally { setBookingAction(''); }
  };
  const connectCalendar = async () => {
    if (value.calendarProvider === 'none') return;
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    if (!token) return;
    setCalendarBusy(true); setCalendarError('');
    try {
      const response = await fetch(`/api/calendar/${value.calendarProvider}/start?format=json`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.url !== 'string') throw new Error(payload.message || payload.error || (isRtl ? 'تعذر بدء ربط التقويم.' : 'Could not start calendar connection.'));
      window.location.assign(payload.url);
    } catch (error) { setCalendarError(error instanceof Error ? error.message : (isRtl ? 'تعذر ربط التقويم.' : 'Could not connect calendar.')); }
    finally { setCalendarBusy(false); }
  };
  const disconnectCalendar = async () => {
    if (value.calendarProvider === 'none') return;
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    if (!token) return;
    setCalendarBusy(true); setCalendarError('');
    try {
      const response = await fetch(`/api/calendar/${value.calendarProvider}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || (isRtl ? 'تعذر فصل التقويم.' : 'Could not disconnect calendar.'));
      setCalendarConnected(false);
    } catch (error) { setCalendarError(error instanceof Error ? error.message : (isRtl ? 'تعذر فصل التقويم.' : 'Could not disconnect calendar.')); }
    finally { setCalendarBusy(false); }
  };
  const update = (patch: Partial<BookingConfig>) => onChange({ ...value, ...patch });
  const updateService = (index: number, patch: Partial<BookingServiceConfig>) => {
    const services = value.services.map((service, serviceIndex) => serviceIndex === index ? { ...service, ...patch } : service);
    update({ services });
  };
  const addService = () => update({ services: [...value.services, { id: `service-${Date.now()}`, name: '', description: '', durationMinutes: 30, bufferMinutes: 0 }] });
  const removeService = (index: number) => update({ services: value.services.filter((_, serviceIndex) => serviceIndex !== index) });
  const updateDay = (day: string, patch: Partial<{ enabled: boolean; start: string; end: string }>) => update({ weeklyAvailability: { ...value.weeklyAvailability, [day]: { ...value.weeklyAvailability[day], ...patch } } });

  return (
    <div className="space-y-5 border-t border-slate-200 pt-5 dark:border-slate-800" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <CalendarClock className="h-4 w-4 text-indigo-600" />
            {isRtl ? 'نظام الحجز الداخلي' : 'Built-in scheduling'}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{isRtl ? 'حدد الخدمات والأوقات المتاحة للحجز من صفحتك.' : 'Let visitors book directly from your public page.'}</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={value.enabled} onChange={(event) => update({ enabled: event.target.checked })} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" />
          {isRtl ? 'مفعل' : 'Enabled'}
        </label>
      </div>

      <div>
        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'المنطقة الزمنية' : 'Timezone'}</label>
        <input type="text" value={value.timezone} onChange={(event) => update({ timezone: event.target.value })} placeholder="Africa/Cairo" className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        <p className="mt-1 text-[10px] text-slate-400">{isRtl ? 'استخدم اسم IANA مثل Asia/Riyadh.' : 'Use an IANA timezone such as Asia/Riyadh.'}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{isRtl ? 'الخدمات' : 'Services'}</h4><button type="button" onClick={addService} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50"><Plus className="h-3.5 w-3.5" />{isRtl ? 'إضافة' : 'Add service'}</button></div>
        {value.services.map((service, index) => (
          <div key={service.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-[1fr_100px_32px]">
            <div className="space-y-2">
              <input aria-label="Service name" value={service.name} onChange={(event) => updateService(index, { name: event.target.value })} placeholder="Service name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              <input aria-label="Service description" value={service.description || ''} onChange={(event) => updateService(index, { description: event.target.value })} placeholder="Short description" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <label className="text-[10px] font-bold text-slate-500">{isRtl ? 'الدقائق' : 'Minutes'}<input type="number" min={15} max={480} step={15} value={service.durationMinutes} onChange={(event) => updateService(index, { durationMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
            <button type="button" onClick={() => removeService(index)} aria-label="Remove service" className="self-center rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      <div className="space-y-2"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{isRtl ? 'ساعات العمل الأسبوعية' : 'Weekly availability'}</h4>
        {DAYS.map((day, index) => {
          const window = value.weeklyAvailability[String(index)];
          return <div key={day} className="grid grid-cols-[1fr_88px_88px] items-center gap-2 text-xs"><label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300"><input type="checkbox" checked={window?.enabled || false} onChange={(event) => updateDay(String(index), { enabled: event.target.checked })} className="h-3.5 w-3.5 rounded text-indigo-600" />{isRtl ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][index] : day}</label><input type="time" value={window?.start || '09:00'} onChange={(event) => updateDay(String(index), { start: event.target.value })} disabled={!window?.enabled} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /><input type="time" value={window?.end || '17:00'} onChange={(event) => updateDay(String(index), { end: event.target.value })} disabled={!window?.enabled} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>;
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><label className="text-[10px] font-bold text-slate-500">{isRtl ? 'إشعار مسبق بالدقائق' : 'Min notice (min)'}<input type="number" min={0} max={10080} value={value.minNoticeMinutes} onChange={(event) => update({ minNoticeMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label><label className="text-[10px] font-bold text-slate-500">{isRtl ? 'نافذة الحجز بالأيام' : 'Booking window (days)'}<input type="number" min={1} max={365} value={value.bookingWindowDays} onChange={(event) => update({ bookingWindowDays: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label><label className="text-[10px] font-bold text-slate-500">{isRtl ? 'فاصل بالدقائق' : 'Buffer (min)'}<input type="number" min={0} max={120} value={value.bufferMinutes} onChange={(event) => update({ bufferMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label><label className="text-[10px] font-bold text-slate-500">{isRtl ? 'حد يومي' : 'Daily limit'}<input type="number" min={1} max={100} value={value.maxBookingsPerDay} onChange={(event) => update({ maxBookingsPerDay: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label></div>

      <div><label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'تواريخ الحجب' : 'Blackout dates'}</label><input value={value.blackoutDates.join(', ')} onChange={(event) => update({ blackoutDates: event.target.value.split(',').map((date) => date.trim()).filter(Boolean).slice(0, 366) })} placeholder="2026-12-25, 2026-12-31" className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white" /><p className="mt-1 text-[10px] text-slate-400">{isRtl ? 'افصل بين التواريخ بفاصلة.' : 'Comma-separated YYYY-MM-DD dates.'}</p></div>

      <div><label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'تكامل التقويم' : 'Calendar integration'}</label><select value={value.calendarProvider || 'none'} disabled={!allowCalendarIntegration} onChange={(event) => update({ calendarProvider: event.target.value as BookingConfig['calendarProvider'] })} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="none">{isRtl ? 'بدون تكامل' : 'No calendar sync'}</option><option value="google">Google Calendar (Studio)</option><option value="outlook">Outlook Calendar (Studio)</option></select><p className="mt-1 text-[10px] text-slate-400">{allowCalendarIntegration ? (isRtl ? 'سيتم وضع أحداث المواعيد في قائمة مزامنة آمنة.' : 'Bookings create a durable calendar sync job; OAuth provider connection is required to deliver events.') : (isRtl ? 'يتطلب تكامل التقويم باقة Studio.' : 'Calendar integrations require the Studio plan.')}</p>{allowCalendarIntegration && value.calendarProvider !== 'none' && <button type="button" disabled={calendarBusy} onClick={() => void (calendarConnected ? disconnectCalendar() : connectCalendar())} className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-[11px] font-bold text-indigo-700 disabled:opacity-50">{calendarBusy ? (isRtl ? 'جارٍ المعالجة...' : 'Working...') : calendarConnected ? (isRtl ? 'فصل التقويم' : 'Disconnect calendar') : (isRtl ? 'ربط التقويم' : `Connect ${value.calendarProvider === 'google' ? 'Google' : 'Outlook'} Calendar`)}</button>}</div>

      {(bookingError || calendarError) && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" /><span>{bookingError || calendarError}</span><button type="button" onClick={() => { setBookingError(''); setCalendarError(''); }} className="ml-auto underline">{isRtl ? 'إغلاق' : 'Dismiss'}</button></div>}
      {loadingBookings && <div className="flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800"><Loader2 className="h-4 w-4 animate-spin" />{isRtl ? 'جارٍ تحميل الحجوزات...' : 'Loading booking requests...'}</div>}
      {!loadingBookings && bookings.length === 0 && !bookingError && <div className="border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">{isRtl ? 'لا توجد حجوزات محفوظة.' : 'No booking requests have been recorded yet.'}</div>}
      {bookings.length > 0 && <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800"><div className="flex items-center justify-between"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{isRtl ? 'طلبات الحجز' : 'Booking requests'}</h4><span className="text-[10px] text-slate-400">{bookings.length}{bookingsHasMore ? '+' : ''}</span></div>{bookings.map((booking) => <div key={booking.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">{booking.customerName || booking.customerEmail || 'Guest'} · {booking.serviceName || 'Appointment'}</p><p className="text-[10px] text-slate-500">{booking.localDate} {booking.localTime} · <span className="font-semibold">{booking.status || 'pending_confirmation'}</span></p>{booking.delivery?.failed && <p role="alert" className="mt-1 text-[10px] font-bold text-rose-600">{isRtl ? 'فشل إرسال إشعار أو مزامنة التقويم.' : 'Notification or calendar delivery failed.'}</p>}{booking.delivery?.state === 'pending' && <p role="status" className="mt-1 text-[10px] font-semibold text-amber-600">{isRtl ? 'جاري إرسال الإشعارات والمزامنة.' : 'Notifications and calendar sync are pending.'}</p>}{booking.delivery?.state === 'unknown' && <p role="alert" className="mt-1 text-[10px] font-bold text-rose-600">{isRtl ? 'حالة التسليم غير معروفة.' : 'Delivery status is unavailable.'}</p>}</div>{booking.status !== 'cancelled' && <div className="flex shrink-0 gap-1"><button type="button" disabled={bookingAction !== '' || booking.status === 'confirmed'} onClick={() => void updateBooking(booking.id, 'confirm')} className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 disabled:opacity-50">{isRtl ? 'تأكيد' : 'Confirm'}</button><button type="button" disabled={bookingAction !== ''} onClick={() => void updateBooking(booking.id, 'cancel')} className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 disabled:opacity-50">{isRtl ? 'إلغاء' : 'Cancel'}</button></div>}</div>)}{bookingsHasMore && <button type="button" onClick={() => void loadMoreBookings()} disabled={loadingBookings} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"><Loader2 className={`h-4 w-4 ${loadingBookings ? 'animate-spin' : 'hidden'}`} />{loadingBookings ? (isRtl ? 'جار التحميل...' : 'Loading...') : (isRtl ? 'تحميل المزيد' : 'Load more bookings')}</button>}</div>}
    </div>
  );
};
