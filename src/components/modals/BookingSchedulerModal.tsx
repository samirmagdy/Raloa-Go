import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Loader2, X } from 'lucide-react';
import { Locale } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';

interface BookingSchedulerModalProps {
  handle: string;
  locale: Locale;
  onClose: () => void;
}

type ScheduleConfig = { timezone: string; today: string; bookingWindowDays: number; services: Array<{ id: string; name: string; description?: string; durationMinutes: number }> };
type Slot = { start: string; end: string; localDate: string; localTime: string; serviceId: string };

export const BookingSchedulerModal: React.FC<BookingSchedulerModalProps> = ({ handle, locale, onClose }) => {
  const isRtl = locale === 'ar';
  const dialogRef = useModalA11y<HTMLDivElement>(true);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(today);
  const [minimumDate, setMinimumDate] = useState(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{ id: string; start: string; status: string } | null>(null);

  useEffect(() => {
    fetch(`/api/v1/public/scheduling/${encodeURIComponent(handle)}/config`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Scheduling is not available for this profile.');
        return response.json();
      })
      .then((payload) => {
        setConfig(payload);
        if (typeof payload.today === 'string') {
          setMinimumDate(payload.today);
          setDate((currentDate) => currentDate < payload.today ? payload.today : currentDate);
        }
        setServiceId(payload.services?.[0]?.id || '');
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Could not load scheduling.'))
      .finally(() => setLoading(false));
  }, [handle]);

  useEffect(() => {
    if (!serviceId || !config || confirmation) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    fetch(`/api/v1/public/scheduling/${encodeURIComponent(handle)}/availability?from=${date}&to=${date}&serviceId=${encodeURIComponent(serviceId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load available times.');
        return response.json();
      })
      .then((payload) => setSlots(Array.isArray(payload.slots) ? payload.slots : []))
      .catch((requestError) => {
        setSlots([]);
        setError(requestError instanceof Error ? requestError.message : 'Could not load available times.');
      })
      .finally(() => setSlotsLoading(false));
  }, [config, date, handle, serviceId, confirmation]);

  const selectedService = config?.services.find((service) => service.id === serviceId);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSlot || !selectedService) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/v1/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ hostHandle: handle, serviceId, slotStart: selectedSlot.start, customerName: name, customerEmail: email, notes })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Could not confirm booking.');
      setConfirmation({ id: payload.id, start: payload.slotStart || selectedSlot.start, status: payload.status || 'pending_confirmation' });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not confirm booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="booking-scheduler-title" ref={dialogRef} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"><div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-indigo-600" /><h2 id="booking-scheduler-title" className="font-bold text-slate-900 dark:text-white">{isRtl ? 'حجز موعد' : 'Book an appointment'}</h2></div><button type="button" onClick={onClose} aria-label={isRtl ? 'إغلاق' : 'Close'} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></header>
        <div className="space-y-5 p-5">
          {loading && <div className="flex items-center justify-center py-10 text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isRtl ? 'جارٍ تحميل المواعيد...' : 'Loading availability...'}</div>}
          {!loading && confirmation && <div className="space-y-3 py-8 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /><h3 className="text-xl font-extrabold text-slate-900 dark:text-white">{confirmation.status === 'confirmed' ? (isRtl ? 'تم تأكيد موعدك' : 'Booking confirmed') : (isRtl ? 'تم استلام طلبك' : 'Booking request received')}</h3><p className="text-sm text-slate-600 dark:text-slate-300">{confirmation.status === 'confirmed' ? (isRtl ? 'تم حفظ الموعد وإرسال إشعارات التأكيد.' : 'Your appointment is confirmed and notifications were queued.') : (isRtl ? 'تم حفظ طلبك. سيؤكده المنشئ ويرسل لك تحديثاً.' : 'Your request was saved. The creator will confirm it and send you an update.')}</p><p className="font-mono text-[11px] text-slate-400">#{confirmation.id}</p></div>}
          {!loading && !confirmation && config && <form onSubmit={submit} className="space-y-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'الخدمة' : 'Service'}<select value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">{config.services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} min</option>)}</select></label>
            {selectedService?.description && <p className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">{selectedService.description}</p>}
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'اليوم' : 'Date'}<input type="date" min={minimumDate} value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
            <div><p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'الوقت المتاح' : 'Available times'} <span className="font-normal text-slate-400">({config.timezone})</span></p>{slotsLoading ? <p className="text-xs text-slate-500">{isRtl ? 'جارٍ التحديث...' : 'Refreshing times...'}</p> : slots.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">{isRtl ? 'لا توجد أوقات متاحة لهذا اليوم.' : 'No times available for this date.'}</p> : <div className="grid grid-cols-3 gap-2">{slots.map((slot) => <button key={slot.start} type="button" onClick={() => setSelectedSlot(slot)} className={`rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${selectedSlot?.start === slot.start ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-slate-700 hover:border-indigo-400 dark:border-slate-700 dark:text-slate-200'}`}>{slot.localTime}</button>)}</div>}</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'الاسم' : 'Name'}<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label><label className="text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'البريد الإلكتروني' : 'Email'}<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label></div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'ملاحظات (اختياري)' : 'Notes (optional)'}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
            {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
            <button type="submit" disabled={!selectedSlot || submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{isRtl ? 'طلب الحجز' : 'Request booking'}</button>
          </form>}
          {!loading && !config && !confirmation && <p role="alert" className="py-8 text-center text-sm text-rose-600">{error || 'Scheduling is unavailable.'}</p>}
        </div>
      </div>
    </div>
  );
};
