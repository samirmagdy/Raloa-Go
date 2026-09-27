import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Loader2, Save, ShoppingBag } from 'lucide-react';
import { Locale } from '../../types';
import { auth } from '../../lib/firebase';

interface ProductDraft { id?: string; name: string; description: string; imageUrls: string; price: string; currency: string; active: boolean; inventory: string; }
interface StudioProductsSettingsProps { siteId: string; locale: Locale; }

const emptyDraft: ProductDraft = { name: '', description: '', imageUrls: '', price: '', currency: 'usd', active: true, inventory: '' };

export const StudioProductsSettings: React.FC<StudioProductsSettingsProps> = ({ siteId, locale }) => {
  const isRtl = locale === 'ar';
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const headers = useCallback(async (): Promise<Record<string, string>> => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const requestHeaders = await headers();
      const [response, ordersResponse] = await Promise.all([
        fetch(`/api/creator/products?siteId=${encodeURIComponent(siteId)}`, { headers: requestHeaders }),
        fetch(`/api/account/orders?siteId=${encodeURIComponent(siteId)}`, { headers: requestHeaders })
      ]);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Could not load products.');
      setProducts(Array.isArray(payload.products) ? payload.products : []);
      if (ordersResponse.ok) {
        const ordersPayload = await ordersResponse.json();
        setOrders(Array.isArray(ordersPayload.orders) ? ordersPayload.orders : []);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load products.');
    } finally { setLoading(false); }
  }, [headers, siteId]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError('');
    const body = { name: draft.name, description: draft.description, imageUrls: draft.imageUrls.split(',').map((value) => value.trim()).filter(Boolean), priceMinor: Math.round(Number(draft.price) * 100), currency: draft.currency, active: draft.active, inventory: draft.inventory.trim() === '' ? null : Number(draft.inventory) };
    try {
      const response = await fetch(draft.id ? `/api/creator/products/${encodeURIComponent(draft.id)}` : '/api/creator/products', { method: draft.id ? 'PATCH' : 'POST', headers: await headers(), body: JSON.stringify({ ...body, siteId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Could not save product.');
      setDraft(emptyDraft); await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save product.'); }
    finally { setSaving(false); }
  };

  const archive = async (id: string) => {
    setError('');
    try {
      const response = await fetch(`/api/creator/products/${encodeURIComponent(id)}?siteId=${encodeURIComponent(siteId)}`, { method: 'DELETE', headers: await headers() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Could not archive product.');
      await load();
    } catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : 'Could not archive product.'); }
  };

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/40" dir={isRtl ? 'rtl' : 'ltr'}>
    <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-indigo-600" /><div><h3 className="text-sm font-bold text-slate-900 dark:text-white">{isRtl ? 'منتجات المتجر' : 'Store products'}</h3><p className="text-xs text-slate-500">{isRtl ? 'الأسعار والمخزون محفوظان على الخادم.' : 'Prices and inventory are authoritative on the server.'}</p></div></div>
    <form onSubmit={save} className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
      <input required placeholder={isRtl ? 'اسم المنتج' : 'Product name'} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      <input required type="number" min="0.50" step="0.01" placeholder={isRtl ? 'السعر' : 'Price'} value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      <textarea placeholder={isRtl ? 'الوصف' : 'Description'} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:col-span-2" rows={2} />
      <input placeholder={isRtl ? 'روابط الصور مفصولة بفواصل' : 'Image URLs, comma separated'} value={draft.imageUrls} onChange={(event) => setDraft({ ...draft, imageUrls: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:col-span-2" />
      <select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="usd">USD</option><option value="eur">EUR</option><option value="gbp">GBP</option><option value="sar">SAR</option><option value="aed">AED</option><option value="cad">CAD</option><option value="aud">AUD</option></select>
      <input type="number" min="0" placeholder={isRtl ? 'المخزون فارغ = غير محدود' : 'Inventory (blank = unlimited)'} value={draft.inventory} onChange={(event) => setDraft({ ...draft, inventory: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />{isRtl ? 'نشط للبيع' : 'Active for sale'}</label>
      <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? (isRtl ? 'جارٍ الحفظ...' : 'Saving...') : draft.id ? (isRtl ? 'تحديث المنتج' : 'Update product') : (isRtl ? 'إضافة المنتج' : 'Add product')}</button>
      {draft.id && <button type="button" onClick={() => setDraft(emptyDraft)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">{isRtl ? 'إلغاء' : 'Cancel'}</button>}
    </form>
    {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
    {loading ? <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> : <><div className="space-y-2">{products.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{product.name}</p><p className="text-xs text-slate-500">{(product.priceMinor / 100).toFixed(2)} {String(product.currency).toUpperCase()} · {product.active ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'مؤرشف' : 'Archived')} · {product.inventory === null ? (isRtl ? 'غير محدود' : 'Unlimited') : `${product.availableQuantity ?? 0} available`}</p></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => setDraft({ id: product.id, name: product.name, description: product.description || '', imageUrls: (product.imageUrls || []).join(', '), price: (product.priceMinor / 100).toFixed(2), currency: product.currency, active: product.active, inventory: product.inventory === null ? '' : String(product.inventory) })} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold dark:border-slate-700">{isRtl ? 'تعديل' : 'Edit'}</button><button type="button" onClick={() => archive(product.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={isRtl ? 'أرشفة المنتج' : 'Archive product'}><Archive className="h-4 w-4" /></button></div></div>)}</div><div className="border-t border-slate-200 pt-4 dark:border-slate-700"><h4 className="text-sm font-bold text-slate-900 dark:text-white">{isRtl ? 'سجل الطلبات' : 'Order history'}</h4>{orders.length === 0 ? <p className="mt-2 text-xs text-slate-500">{isRtl ? 'لا توجد طلبات بعد.' : 'No orders yet.'}</p> : <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">{orders.map((order) => <div key={order.id} className="flex items-center justify-between gap-3 py-2 text-xs"><span className="truncate text-slate-600 dark:text-slate-300">{order.productName} × {order.quantity} · {order.customerEmail}</span><span className="shrink-0 font-bold capitalize text-slate-500">{String(order.status).replace('_', ' ')} / {String(order.fulfillmentStatus).replace('_', ' ')}</span></div>)}</div>}</div></>}
  </section>;
};
