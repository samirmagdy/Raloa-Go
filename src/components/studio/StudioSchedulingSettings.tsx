import React from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { BookingConfig, BookingServiceConfig, Locale } from '../../types';

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
  value: BookingConfig;
  onChange: (value: BookingConfig) => void;
  locale: Locale;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const StudioSchedulingSettings: React.FC<StudioSchedulingSettingsProps> = ({ value, onChange, locale }) => {
  const isRtl = locale === 'ar';
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

      <div><label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'تكامل التقويم' : 'Calendar integration'}</label><select value={value.calendarProvider || 'none'} onChange={(event) => update({ calendarProvider: event.target.value as BookingConfig['calendarProvider'] })} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="none">{isRtl ? 'بدون تكامل' : 'No calendar sync'}</option><option value="google">Google Calendar (connection architecture)</option><option value="outlook">Outlook Calendar (connection architecture)</option></select><p className="mt-1 text-[10px] text-slate-400">{isRtl ? 'سيتم وضع أحداث المواعيد في قائمة مزامنة آمنة.' : 'Bookings create a durable calendar sync job; OAuth provider connection is required to deliver events.'}</p></div>
    </div>
  );
};
