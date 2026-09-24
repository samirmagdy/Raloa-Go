import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Plus,
  Sparkles,
  Link2,
  Download,
  CheckCircle2,
  Circle,
  ShoppingBag,
  Calendar,
  Video,
  Music,
  Mail,
  MessageSquare,
  Heading,
  Layers,
  X
} from 'lucide-react';
import { Locale } from '../../types';
import { SortableBlockList, StudioBlockItem } from './SortableBlockList';

interface StudioContentTabProps {
  displayName: string;
  onDisplayNameChange: (val: string) => void;
  username: string;
  onUsernameChange: (val: string) => void;
  role: string;
  onRoleChange: (val: string) => void;
  bio: string;
  onBioChange: (val: string) => void;
  avatar: string;
  onAvatarChange: (val: string) => void;
  links: StudioBlockItem[];
  onLinksChange: (links: StudioBlockItem[]) => void;
  onOpenLinktreeImport: () => void;
  locale: Locale;
}

export const StudioContentTab: React.FC<StudioContentTabProps> = ({
  displayName,
  onDisplayNameChange,
  username,
  onUsernameChange,
  role,
  onRoleChange,
  bio,
  onBioChange,
  avatar,
  onAvatarChange,
  links,
  onLinksChange,
  onOpenLinktreeImport,
  locale
}) => {
  const isRtl = locale === 'ar';
  const [activePage, setActivePage] = useState<'main' | 'shop' | 'portfolio'>('main');
  const [addBlockModalOpen, setAddBlockModalOpen] = useState(false);

  // New block form state
  const [newBlockType, setNewBlockType] = useState<string>('link');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');

  // Setup checklist calculation
  const hasHandle = Boolean(username && username.length > 2);
  const hasBio = Boolean(bio && bio.trim().length > 10);
  const hasLinks = links.length >= 3;
  const hasAvatar = Boolean(avatar);

  const completedCount = [hasHandle, hasBio, hasLinks, hasAvatar].filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 4) * 100);

  const handleCelebrate = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    const block: StudioBlockItem = {
      id: `block-${Date.now()}`,
      title: newTitle.trim(),
      url: newUrl.trim(),
      subtitle: newSubtitle.trim() || undefined,
      type: newBlockType
    };

    onLinksChange([...links, block]);
    setNewTitle('');
    setNewUrl('');
    setNewSubtitle('');
    setAddBlockModalOpen(false);

    if (links.length === 2) {
      handleCelebrate();
    }
  };


  const handleRemoveBlock = (id: string) => {
    onLinksChange(links.filter((b) => b.id !== id));
  };

  const blockTypes = [
    { type: 'link', label: isRtl ? 'رابط مخصص' : 'Custom Link', desc: isRtl ? 'رابط مباشر لأي موقع' : 'Direct link to any URL', icon: Link2, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60' },
    { type: 'header', label: isRtl ? 'عنوان فرعي' : 'Section Header', desc: isRtl ? 'فاصل نصي لتنظيم الروابط' : 'Text divider between blocks', icon: Heading, color: 'text-slate-700 bg-slate-100 dark:bg-slate-800' },
    { type: 'shop', label: isRtl ? 'منتج / متجر' : 'Shop / Product', desc: isRtl ? 'بيع المنتجات الرقمية' : 'Sell digital or physical goods', icon: ShoppingBag, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60' },
    { type: 'booking', label: isRtl ? 'حجز موعد' : 'Booking / Event', desc: isRtl ? 'ربط مع كالندلي أو كال' : 'Calendly, Cal.com or event', icon: Calendar, color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/60' },
    { type: 'video', label: isRtl ? 'فيديو مضمن' : 'Video Embed', desc: isRtl ? 'يوتيوب أو فيميو مباشر' : 'YouTube or Vimeo embed', icon: Video, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/60' },
    { type: 'music', label: isRtl ? 'موسيقى / صوت' : 'Music / Audio', desc: isRtl ? 'سبوتيفاي أو ساوندكلاود' : 'Spotify or SoundCloud track', icon: Music, color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/60' },
    { type: 'contact', label: isRtl ? 'نموذج تواصل' : 'Contact Lead Form', desc: isRtl ? 'جمع رسائل واستفسارات الزوار' : 'Collect visitor messages & leads', icon: MessageSquare, color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/60' },
    { type: 'newsletter', label: isRtl ? 'نشرة بريدية' : 'Newsletter Form', desc: isRtl ? 'جمع المشتركين في بريدك' : 'Collect subscriber emails', icon: Mail, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/60' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* 1. Setup Checklist Progress Widget */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-850 rounded-2xl border border-indigo-100/80 dark:border-indigo-900/50 shadow-2xs">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {isRtl ? 'قائمة تهيئة وإطلاق الموقع' : 'Launch Readiness Checklist'}
            </h4>
          </div>
          <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
            {progressPercent}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Tasks Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            {hasHandle ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />}
            <span className="truncate">{isRtl ? 'تحديد المعرف' : 'Claim handle'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            {hasAvatar ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />}
            <span className="truncate">{isRtl ? 'الصورة الشخصية' : 'Avatar'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            {hasBio ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />}
            <span className="truncate">{isRtl ? 'النبذة التعريفية' : 'Biography'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            {hasLinks ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />}
            <span className="truncate">{isRtl ? 'إضافة ٣ روابط' : '3+ blocks'}</span>
          </div>
        </div>
      </div>

      {/* 2. Creator Identity Section */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {isRtl ? 'هوية وبيانات صانع المحتوى' : 'Creator Identity'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'الاسم الظاهر' : 'Display Name'}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              placeholder="e.g. Alex Parks"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'المعرف الشخصي (@handle)' : 'Handle (@handle)'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-3 rtl:pl-0 rtl:pr-3 flex items-center pointer-events-none text-xs font-mono text-slate-400">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="username"
                className="w-full pl-7 rtl:pl-3.5 rtl:pr-7 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'المسمى / التخصص' : 'Role / Headline'}
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => onRoleChange(e.target.value)}
              placeholder="e.g. Product Designer & Indie Builder"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRtl ? 'رابط الصورة الشخصية' : 'Avatar Image URL'}
            </label>
            <input
              type="url"
              value={avatar}
              onChange={(e) => onAvatarChange(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {isRtl ? 'النبذة التعريفية (Bio)' : 'Bio / About'}
            </label>
            <span className="text-[10px] text-slate-400">
              {bio.length}/160
            </span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => onBioChange(e.target.value.slice(0, 160))}
            rows={2}
            placeholder={isRtl ? 'اكتب نبذة مختصرة عن نفسك وعملك...' : 'A brief description of who you are and what you do...'}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
      </div>

      {/* 3. Multi-Page Tabs & Import Linktree */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActivePage('main')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activePage === 'main'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            {isRtl ? 'الروابط الرئيسية' : 'Main Links'}
          </button>
          <button
            type="button"
            onClick={() => setActivePage('shop')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activePage === 'shop'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            {isRtl ? 'المتجر' : 'Shop'}
          </button>
          <button
            type="button"
            onClick={() => setActivePage('portfolio')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activePage === 'portfolio'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            {isRtl ? 'الأعمال' : 'Portfolio'}
          </button>
        </div>

        {/* Import Linktree Button */}
        <button
          type="button"
          onClick={onOpenLinktreeImport}
          className="px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>{isRtl ? 'استيراد Linktree' : 'Import Linktree'}</span>
        </button>
      </div>

      {/* 4. Add Blocks Action & Block List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {isRtl ? `الكتل والروابط (${links.length})` : `Blocks & Links (${links.length})`}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setAddBlockModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isRtl ? 'إضافة كتلة جديدة' : 'Add Block'}</span>
          </button>
        </div>

        {/* Sortable Block Items */}
        <SortableBlockList
          items={links}
          onChange={onLinksChange}
          onRemove={handleRemoveBlock}
          locale={locale}
        />
      </div>

      {/* Add Block Modal Picker */}
      {addBlockModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setAddBlockModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isRtl ? 'إضافة كتلة أو عنصر جديد' : 'Add New Block'}
              </h3>
              <button
                type="button"
                onClick={() => setAddBlockModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Block Type Selection Grid */}
            <div className="my-4 grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {blockTypes.map((b) => {
                const Icon = b.icon;
                const isSelected = newBlockType === b.type;
                return (
                  <button
                    key={b.type}
                    type="button"
                    onClick={() => setNewBlockType(b.type)}
                    className={`p-3 rounded-2xl border text-left rtl:text-right flex items-start gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${b.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {b.label}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {b.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Block Inputs Form */}
            <form onSubmit={handleCreateBlock} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'عنوان الكتلة' : 'Block Title'}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={isRtl ? 'مثال: بودكاست الحلقة ٤٢' : 'e.g. Listen to Podcast #42'}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'الرابط أو الوجهة' : 'Destination URL'}
                </label>
                <input
                  type="text"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isRtl ? 'نص فرعي توضيحي (اختياري)' : 'Subtitle (Optional)'}
                </label>
                <input
                  type="text"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  placeholder={isRtl ? 'مثال: حلقة مميزة مع مصممي واجهات' : 'e.g. 45 min deep dive'}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddBlockModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                >
                  {isRtl ? 'إضافة إلى الموقع' : 'Add to Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
