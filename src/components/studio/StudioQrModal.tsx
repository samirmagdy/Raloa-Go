import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Download, Copy, Check, Printer, ExternalLink, QrCode as QrIcon } from 'lucide-react';
import { Locale } from '../../types';

interface StudioQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  handle: string;
  locale: Locale;
}

export const StudioQrModal: React.FC<StudioQrModalProps> = ({
  isOpen,
  onClose,
  url,
  handle,
  locale
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const isRtl = locale === 'ar';

  useEffect(() => {
    if (!isOpen || !url) return;
    QRCode.toDataURL(url, {
      width: 360,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF'
      }
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [isOpen, url]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `raloa-${handle}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <QrIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isRtl ? 'رمز الاستجابة السريعة (QR)' : 'Creator QR Code'}
              </h3>
              <p className="text-xs text-slate-500">@{handle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Preview Card */}
        <div className="my-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col items-center justify-center">
          {qrDataUrl ? (
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200/60">
              <img
                src={qrDataUrl}
                alt={`QR code for ${url}`}
                className="w-52 h-52 object-contain"
              />
            </div>
          ) : (
            <div className="w-52 h-52 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <p className="mt-4 font-mono text-xs text-slate-600 dark:text-slate-300 font-medium text-center break-all px-2">
            {url}
          </p>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleDownload}
            className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isRtl ? 'تحميل صورة PNG' : 'Download PNG'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
            <span>{copied ? (isRtl ? 'تم النسخ!' : 'Copied!') : isRtl ? 'نسخ الرابط' : 'Copy Link'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="w-full mt-2.5 py-2 px-4 rounded-xl border border-slate-200/80 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{isRtl ? 'طباعة ملصق الرمز' : 'Print QR Standee'}</span>
        </button>
      </div>
    </div>
  );
};
