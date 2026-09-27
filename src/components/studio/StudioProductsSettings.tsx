import React, { useCallback, useEffect, useState } from 'react';
import { Archive, CheckCircle2, Clock3, Loader2, RefreshCw, Save, ShoppingBag, XCircle } from 'lucide-react';
import { Locale } from '../../types';
import { auth } from '../../lib/firebase';
import { uploadMedia } from '../../lib/mediaUpload';

interface ProductDraft { id?: string; name: string; description: string; imageUrls: string; price: string; currency: string; active: boolean; inventory: string; }
interface FulfillmentHistoryEntry { from: string; to: string; at: string; actorId?: string; }
interface CreatorOrder { id: string; productName: string; quantity: number; customerEmail: string; status: string; fulfillmentStatus: 'unfulfilled' | 'processing' | 'fulfilled' | 'cancelled'; totalMinor?: number; currency?: string; createdAt?: string; updatedAt?: string; fulfillmentHistory?: FulfillmentHistoryEntry[]; }
interface StudioProductsSettingsProps { siteId: string; locale: Locale; }

const emptyDraft: ProductDraft = { name: '', description: '', imageUrls: '', price: '', currency: 'usd', active: true, inventory: '' };
const statusLabel = (status: string, isRtl: boolean) => ({ unfulfilled: isRtl ? 'غير منفذ' : 'Unfulfilled', processing: isRtl ? 'قيد المعالجة' : 'Processing', fulfilled: isRtl ? 'تم التنفيذ' : 'Fulfilled', cancelled: isRtl ? 'ملغى' : 'Cancelled', pending_payment: isRtl ? 'بانتظار الدفع' : 'Pending payment', paid: isRtl ? 'مدفوع' : 'Paid', payment_failed: isRtl ? 'فشل الدفع' : 'Payment failed' }[status] || status);
const formatTimestamp = (value: string | undefined, locale: Locale) => { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(date); };

export const StudioProductsSettings: React.FC<StudioProductsSettingsProps> = ({ siteId, locale }) => {
  const isRtl = locale === 'ar';
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<CreatorOrder[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [orderBusy, setOrderBusy] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const headers = useCallback(async (): Promise<Record<string, string>> => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }, []);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(''); setOrderError('');
    try {
      const requestHeaders = await headers();
      const [response, ordersResponse] = await Promise.all([
        fetch(`/api/creator/products?siteId=${encodeURIComponent(siteId)}`, { headers: requestHeaders }),
        fetch(`/api/creator/orders?siteId=${encodeURIComponent(siteId)}`, { headers: requestHeaders })
      ]);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Could not load products.');
      const ordersPayload = await ordersResponse.json().catch(() => ({}));
      if (!ordersResponse.ok) throw new Error(ordersPayload.error?.message || ordersPayload.error || 'Could not load orders.');
      setProducts(Array.isArray(payload.products) ? payload.products : []);
      setOrders(Array.isArray(ordersPayload.orders) ? ordersPayload.orders : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load products and orders.');
    } finally { if (showLoading) setLoading(false); }
  }, [headers, siteId]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    const body = { name: draft.name, description: draft.description, imageUrls: draft.imageUrls.split(',').map((value) => value.trim()).filter(Boolean), priceMinor: Math.round(Number(draft.price) * 100), currency: draft.currency, active: draft.active, inventory: draft.inventory.trim() === '' ? null : Number(draft.inventory) };
    try {
      const response = await fetch(draft.id ? `/api/creator/products/${encodeURIComponent(draft.id)}` : '/api/creator/products', { method: draft.id ? 'PATCH' : 'POST', headers: await headers(), body: JSON.stringify({ ...body, siteId }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Could not save product.');
      setDraft(emptyDraft); await load(false);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save product.'); }
    finally { setSaving(false); }
  };

  const archive = async (id: string) => {
    if (!window.confirm(isRtl ? 'هل تريد أرشفة هذا المنتج؟' : 'Archive this product?')) return;
    setError('');
    try {
      const response = await fetch(`/api/creator/products/${encodeURIComponent(id)}?siteId=${encodeURIComponent(siteId)}`, { method: 'DELETE', headers: await headers() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Could not archive product.');
      await load(false);
    } catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : 'Could not archive product.'); }
  };

  const updateFulfillment = async (order: CreatorOrder, fulfillmentStatus: 'processing' | 'fulfilled' | 'cancelled') => {
    if (orderBusy) return;
    if (fulfillmentStatus === 'cancelled' && !window.confirm(isRtl ? 'إلغاء تنفيذ هذا الطلب وإعادة المخزون إن أمكن؟' : 'Cancel fulfillment for this order and reconcile inventory where applicable?')) return;
    setOrderBusy(order.id); setOrderError('');
    try {
      const response = await fetch(`/api/creator/orders/${encodeURIComponent(order.id)}/fulfillment`, { method: 'PATCH', headers: await headers(), body: JSON.stringify({ fulfillmentStatus, siteId }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Could not update fulfillment.');
      if (!payload.order) throw new Error('The server did not return the updated order.');
      setOrders((current) => current.map((item) => item.id === order.id ? payload.order : item));
      await load(false);
    } catch (updateError) { setOrderError(updateError instanceof Error ? updateError.message : 'Could not update fulfillment.'); }
    finally { setOrderBusy(''); }
  };

  const uploadProductImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setError('');
    try { const uploaded = await uploadMedia(file, siteId, 'product', setUploadProgress); setDraft((current) => ({ ...current, imageUrls: [current.imageUrls, uploaded.src].filter(Boolean).join(', ') })); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Product image upload failed.'); }
    finally { setUploadProgress(null); }
  };

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/40" dir={isRtl ? 'rtl' : 'ltr'}>
    <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-indigo-600" /><div><h3 className="text-sm font-bold text-slate-900 dark:text-white">{isRtl ? 'منتجات المتجر' : 'Store products'}</h3><p className="text-xs text-slate-500">{isRtl ? 'الأسعار والمخزون محفوظان على الخادم.' : 'Prices, inventory, and orders are authoritative on the server.'}</p></div></div>
    <form onSubmit={save} className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
      <input required placeholder={isRtl ? 'اسم المنتج' : 'Product name'} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      <input required type="number" min="0.50" step="0.01" placeholder={isRtl ? 'السعر' : 'Price'} value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      <textarea placeholder={isRtl ? 'الوصف' : 'Description'} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:col-span-2" rows={2} />
      <div className="flex gap-2 sm:col-span-2"><input placeholder={isRtl ? 'روابط الصور مفصولة بفواصل' : 'Image URLs, comma separated'} value={draft.imageUrls} onChange={(event) => setDraft({ ...draft, imageUrls: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /><label className="inline-flex cursor-pointer items-center rounded-lg border border-indigo-200 px-3 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300">{uploadProgress === null ? (isRtl ? 'رفع' : 'Upload') : `${uploadProgress}%`}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadProductImage} disabled={uploadProgress !== null} /></label></div>
      <select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="usd">USD</option><option value="eur">EUR</option><option value="gbp">GBP</option><option value="sar">SAR</option><option value="aed">AED</option><option value="cad">CAD</option><option value="aud">AUD</option></select>
      <input type="number" min="0" placeholder={isRtl ? 'المخزون فارغ = غير محدود' : 'Inventory (blank = unlimited)'} value={draft.inventory} onChange={(event) => setDraft({ ...draft, inventory: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />{isRtl ? 'نشط للبيع' : 'Active for sale'}</label>
      <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? (isRtl ? 'جارٍ الحفظ...' : 'Saving...') : draft.id ? (isRtl ? 'تحديث المنتج' : 'Update product') : (isRtl ? 'إضافة المنتج' : 'Add product')}</button>
      {draft.id && <button type="button" onClick={() => setDraft(emptyDraft)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">{isRtl ? 'إلغاء' : 'Cancel'}</button>}
    </form>
    {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
    {loading ? <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-label={isRtl ? 'جار التحميل' : 'Loading'} /> : <>
      <div className="space-y-2">{products.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{product.name}</p><p className="text-xs text-slate-500">{(product.priceMinor / 100).toFixed(2)} {String(product.currency).toUpperCase()} · {product.active ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'مؤرشف' : 'Archived')} · {product.inventory === null ? (isRtl ? 'غير محدود' : 'Unlimited') : `${product.availableQuantity ?? 0} available`}</p></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => setDraft({ id: product.id, name: product.name, description: product.description || '', imageUrls: (product.imageUrls || []).join(', '), price: (product.priceMinor / 100).toFixed(2), currency: product.currency, active: product.active, inventory: product.inventory === null ? '' : String(product.inventory) })} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold dark:border-slate-700">{isRtl ? 'تعديل' : 'Edit'}</button><button type="button" onClick={() => archive(product.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={isRtl ? 'أرشفة المنتج' : 'Archive product'}><Archive className="h-4 w-4" /></button></div></div>)}</div>
      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-bold text-slate-900 dark:text-white">{isRtl ? 'إدارة الطلبات' : 'Order fulfillment'}</h4><p className="mt-1 text-xs text-slate-500">{isRtl ? 'حدّث حالة التنفيذ من خلال الخادم.' : 'Update fulfillment through the server-authoritative order workflow.'}</p></div><button type="button" onClick={() => void load(false)} disabled={Boolean(orderBusy)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold dark:border-slate-700"><RefreshCw className="h-3.5 w-3.5" />{isRtl ? 'تحديث' : 'Refresh'}</button></div>
        {orderError && <p role="alert" className="mt-3 text-xs font-semibold text-rose-600">{orderError}</p>}
        {orders.length === 0 ? <p className="mt-3 text-xs text-slate-500">{isRtl ? 'لا توجد طلبات بعد.' : 'No orders yet.'}</p> : <div className="mt-3 space-y-3">{orders.map((order) => {
          const canProcess = order.fulfillmentStatus === 'unfulfilled' && order.status === 'paid';
          const canFulfill = order.fulfillmentStatus === 'processing';
          const canCancel = ['unfulfilled', 'processing'].includes(order.fulfillmentStatus);
          return <article key={order.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><p className="text-sm font-bold text-slate-900 dark:text-white">{order.productName} × {order.quantity}</p><p className="truncate text-xs text-slate-500">{order.customerEmail} · {order.totalMinor !== undefined ? `${(order.totalMinor / 100).toFixed(2)} ${String(order.currency || '').toUpperCase()}` : ''}</p><p className="mt-1 text-[11px] text-slate-400">{isRtl ? 'أنشئ في' : 'Created'} {formatTimestamp(order.createdAt, locale)} · {isRtl ? 'آخر تحديث' : 'Updated'} {formatTimestamp(order.updatedAt, locale)}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{statusLabel(order.status, isRtl)}</span><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${order.fulfillmentStatus === 'fulfilled' ? 'bg-emerald-100 text-emerald-700' : order.fulfillmentStatus === 'cancelled' ? 'bg-rose-100 text-rose-700' : order.fulfillmentStatus === 'processing' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>{statusLabel(order.fulfillmentStatus, isRtl)}</span></div></div>
            <div className="mt-3 flex flex-wrap gap-2">{canProcess && <button type="button" onClick={() => void updateFulfillment(order, 'processing')} disabled={Boolean(orderBusy)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Clock3 className="h-3.5 w-3.5" />{orderBusy === order.id ? '…' : (isRtl ? 'بدء المعالجة' : 'Start processing')}</button>}{canFulfill && <button type="button" onClick={() => void updateFulfillment(order, 'fulfilled')} disabled={Boolean(orderBusy)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" />{orderBusy === order.id ? '…' : (isRtl ? 'تم التنفيذ' : 'Mark fulfilled')}</button>}{canCancel && <button type="button" onClick={() => void updateFulfillment(order, 'cancelled')} disabled={Boolean(orderBusy)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" />{isRtl ? 'إلغاء' : 'Cancel'}</button>}</div>
            {order.fulfillmentHistory && order.fulfillmentHistory.length > 0 && <details className="mt-3 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60"><summary className="cursor-pointer font-bold text-slate-700 dark:text-slate-200">{isRtl ? 'سجل التنفيذ' : 'Fulfillment history'}</summary><ol className="mt-2 space-y-2 border-l border-slate-200 pl-3 dark:border-slate-700">{order.fulfillmentHistory.slice().reverse().map((entry, index) => <li key={`${entry.at}-${index}`} className="text-slate-500"><span className="font-semibold text-slate-700 dark:text-slate-300">{statusLabel(entry.from, isRtl)} → {statusLabel(entry.to, isRtl)}</span><br />{formatTimestamp(entry.at, locale)}</li>)}</ol></details>}
          </article>;
        })}</div>}
      </div>
    </>}
  </section>;
};
