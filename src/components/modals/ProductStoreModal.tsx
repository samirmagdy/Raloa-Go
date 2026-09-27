import React, { useEffect, useState } from 'react';
import { Loader2, ShoppingBag, X } from 'lucide-react';
import { Locale } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';
import { SafeImage } from '../SafeImage';

interface ProductStoreModalProps {
  handle: string;
  locale: Locale;
  onClose: () => void;
}

interface PublicProduct {
  id: string;
  name: string;
  description: string;
  imageUrls: string[];
  priceMinor: number;
  currency: string;
  availableQuantity: number | null;
}

export const ProductStoreModal: React.FC<ProductStoreModalProps> = ({ handle, locale, onClose }) => {
  const isRtl = locale === 'ar';
  const dialogRef = useModalA11y<HTMLDivElement>(true);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [email, setEmail] = useState('');
  const [quantity, setQuantity] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/v1/public/products/${encodeURIComponent(handle)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Products are unavailable.');
        return payload;
      })
      .then((payload) => setProducts(Array.isArray(payload.products) ? payload.products : []))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Products are unavailable.'))
      .finally(() => setLoading(false));
  }, [handle]);

  const buy = async (product: PublicProduct) => {
    const selectedQuantity = Math.max(1, quantity[product.id] || 1);
    if (!email.trim()) {
      setError(isRtl ? 'أدخل بريدك الإلكتروني للمتابعة.' : 'Enter your email to continue.');
      return;
    }
    setSubmitting(product.id);
    setError('');
    try {
      const response = await fetch(`/api/v1/public/products/${encodeURIComponent(handle)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ productId: product.id, quantity: selectedQuantity, customerEmail: email.trim() })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Checkout is unavailable.');
      if (payload.url) window.location.assign(payload.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout is unavailable.');
    } finally {
      setSubmitting('');
    }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="product-store-title" dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-indigo-600" /><h2 id="product-store-title" className="font-bold text-slate-900 dark:text-white">{isRtl ? 'المتجر' : 'Shop products'}</h2></div>
          <button type="button" onClick={onClose} aria-label={isRtl ? 'إغلاق' : 'Close'} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-4 p-5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{isRtl ? 'بريدك الإلكتروني' : 'Email for your receipt'}<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="you@example.com" /></label>
          {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" /></div>}
          {!loading && products.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">{isRtl ? 'لا توجد منتجات متاحة حالياً.' : 'No products are currently available.'}</p>}
          {products.map((product) => {
            const soldOut = product.availableQuantity !== null && product.availableQuantity < 1;
            return <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              {product.imageUrls[0] && <SafeImage src={product.imageUrls[0]} alt={product.name} className="h-40 w-full object-cover" />}
              <div className="space-y-3 p-4"><div><h3 className="font-bold text-slate-900 dark:text-white">{product.name}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{product.description}</p></div><div className="flex items-center justify-between gap-3"><span className="font-extrabold text-slate-900 dark:text-white">{(product.priceMinor / 100).toFixed(2)} {product.currency.toUpperCase()}</span><div className="flex items-center gap-2"><input aria-label={`${product.name} quantity`} type="number" min={1} max={product.availableQuantity ?? 20} disabled={soldOut} value={quantity[product.id] || 1} onChange={(event) => setQuantity((current) => ({ ...current, [product.id]: Math.max(1, Number(event.target.value) || 1) }))} className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-center text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /><button type="button" disabled={soldOut || submitting === product.id} onClick={() => buy(product)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : soldOut ? (isRtl ? 'نفد' : 'Sold out') : (isRtl ? 'شراء' : 'Buy')}</button></div></div></div>
            </article>;
          })}
          {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
};
