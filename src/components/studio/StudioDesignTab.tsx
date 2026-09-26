import React from 'react';
import {
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { Locale, BackgroundStyle } from '../../types';

export interface VisualPreset {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  accentColor: string;
  surfaceColor: string;
  radius: 'sharp' | 'subtle' | 'rounded' | 'pill';
  shadow: 'none' | 'subtle' | 'soft' | 'hard';
  borderStyle: 'none' | 'thin' | 'bold' | 'dashed';
  bgStyle: BackgroundStyle;
  themeMode: 'auto' | 'dark' | 'light';
  previewGradient: string;
}

export const VISUAL_PRESETS: VisualPreset[] = [
  {
    id: 'minimalist',
    name: 'Minimalist Monochrome',
    nameAr: 'أبيض وأسود بسيط',
    description: 'Clean typography, high legibility, pure monochrome contrasts',
    descriptionAr: 'طباعة نقية وتباين عالٍ وأناقة أحادية اللون',
    accentColor: '#0F172A',
    surfaceColor: '#FFFFFF',
    radius: 'rounded',
    shadow: 'subtle',
    borderStyle: 'thin',
    bgStyle: 'minimal',
    themeMode: 'light',
    previewGradient: 'from-slate-900 to-slate-700'
  },
  {
    id: 'neon-cyber',
    name: 'Neon Cyberpunk',
    nameAr: 'سايبر بانك مشع',
    description: 'Vibrant electric cyan and ultraviolet ambient glow',
    descriptionAr: 'توهج أزرق وبنفسجي مشع لعالم الألعاب والتكنولوجيا',
    accentColor: '#06B6D4',
    surfaceColor: '#0F172A',
    radius: 'subtle',
    shadow: 'soft',
    borderStyle: 'thin',
    bgStyle: 'immersive',
    themeMode: 'dark',
    previewGradient: 'from-cyan-500 via-indigo-600 to-fuchsia-600'
  },
  {
    id: 'warm-editorial',
    name: 'Warm Editorial',
    nameAr: 'مجلة ثقافية دافئة',
    description: 'Earthy amber tones, editorial warmth, and premium tactile feel',
    descriptionAr: 'ألوان ترابية دافئة تناسب الكتّاب والمصممين',
    accentColor: '#D97706',
    surfaceColor: '#FFFBEB',
    radius: 'rounded',
    shadow: 'soft',
    borderStyle: 'thin',
    bgStyle: 'gradient',
    themeMode: 'light',
    previewGradient: 'from-amber-600 to-orange-700'
  },
  {
    id: 'neo-brutalist',
    name: 'Neo-Brutalist',
    nameAr: 'نيو-بروتاليزم جريء',
    description: 'High-contrast bold 2px borders and solid drop shadows',
    descriptionAr: 'حواف جريئة بظل صلب وألوان مشبعة عصرية',
    accentColor: '#4F46E5',
    surfaceColor: '#FFFFFF',
    radius: 'sharp',
    shadow: 'hard',
    borderStyle: 'bold',
    bgStyle: 'signature',
    themeMode: 'light',
    previewGradient: 'from-indigo-600 via-pink-500 to-yellow-400'
  },
  {
    id: 'glass-frost',
    name: 'Glassmorphic Frost',
    nameAr: 'زجاج شفاف ناعم',
    description: 'Translucent cards with dynamic backdrop blur and subtle frost',
    descriptionAr: 'بطاقات شبه شفافة مع تمويه خلفي ناعم وحديث',
    accentColor: '#3B82F6',
    surfaceColor: 'rgba(255, 255, 255, 0.75)',
    radius: 'pill',
    shadow: 'soft',
    borderStyle: 'thin',
    bgStyle: 'gradient',
    themeMode: 'auto',
    previewGradient: 'from-blue-400 via-indigo-400 to-purple-500'
  },
  {
    id: 'luxury-dark',
    name: 'Luxury Obsidian',
    nameAr: 'أسود فاخر بلمسات ذهبية',
    description: 'Deep midnight obsidian with delicate warm gold borders',
    descriptionAr: 'أسود داكن عميق مع حواف ذهبية أنيقة لصناع الفخامة',
    accentColor: '#F59E0B',
    surfaceColor: '#1E293B',
    radius: 'rounded',
    shadow: 'soft',
    borderStyle: 'thin',
    bgStyle: 'immersive',
    themeMode: 'dark',
    previewGradient: 'from-slate-950 via-amber-950 to-slate-900'
  }
];

interface StudioDesignTabProps {
  templateId: string;
  onTemplateIdChange: (val: string) => void;
  bgStyle: BackgroundStyle;
  onBgStyleChange: (val: BackgroundStyle) => void;
  themeMode: 'auto' | 'dark' | 'light';
  onThemeModeChange: (val: 'auto' | 'dark' | 'light') => void;
  accentColor: string;
  onAccentColorChange: (val: string) => void;
  surfaceColor: string;
  onSurfaceColorChange: (val: string) => void;
  cardRadius: 'sharp' | 'subtle' | 'rounded' | 'pill';
  onCardRadiusChange: (val: 'sharp' | 'subtle' | 'rounded' | 'pill') => void;
  cardShadow: 'none' | 'subtle' | 'soft' | 'hard';
  onCardShadowChange: (val: 'none' | 'subtle' | 'soft' | 'hard') => void;
  borderStyle: 'none' | 'thin' | 'bold' | 'dashed';
  onBorderStyleChange: (val: 'none' | 'thin' | 'bold' | 'dashed') => void;
  onApplyPreset?: (preset: VisualPreset) => void;
  onResetDefault: () => void;
  locale: Locale;
}

export const StudioDesignTab: React.FC<StudioDesignTabProps> = ({
  bgStyle,
  onBgStyleChange,
  themeMode,
  onThemeModeChange,
  accentColor,
  onAccentColorChange,
  surfaceColor,
  onSurfaceColorChange,
  cardRadius,
  onCardRadiusChange,
  cardShadow,
  onCardShadowChange,
  borderStyle,
  onBorderStyleChange,
  onApplyPreset,
  onResetDefault,
  locale
}) => {
  const isRtl = locale === 'ar';

  const curatedAccents = [
    '#4F46E5', // Indigo
    '#06B6D4', // Cyan
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#8B5CF6', // Purple
    '#0F172A', // Slate
    '#E11D48'  // Rose
  ];

  const handleApplyPreset = (p: VisualPreset) => {
    if (onApplyPreset) {
      onApplyPreset(p);
      return;
    }
    onAccentColorChange(p.accentColor);
    onSurfaceColorChange(p.surfaceColor);
    onCardRadiusChange(p.radius);
    onCardShadowChange(p.shadow);
    onBorderStyleChange(p.borderStyle);
    onBgStyleChange(p.bgStyle);
    onThemeModeChange(p.themeMode);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* 1. Visual Presets Showcase */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {isRtl ? 'الأنماط والتصاميم البصرية الجاهزة' : 'Visual Presets'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onResetDefault}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRtl ? 'استعادة الافتراضي' : 'Reset preset'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {VISUAL_PRESETS.map((p) => {
            const isPresetActive =
              accentColor.toLowerCase() === p.accentColor.toLowerCase() &&
              surfaceColor.toLowerCase() === p.surfaceColor.toLowerCase() &&
              bgStyle === p.bgStyle &&
              cardRadius === p.radius &&
              borderStyle === p.borderStyle;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`p-3 rounded-2xl border text-left rtl:text-right transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group flex flex-col justify-between ${
                  isPresetActive
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/60 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-6 h-6 rounded-full bg-gradient-to-tr ${p.previewGradient} ring-2 ring-white dark:ring-slate-900 shadow-2xs`} />
                  <span
                    className={`text-[10px] uppercase font-bold transition-colors ${
                      isPresetActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 group-hover:text-indigo-600'
                    }`}
                  >
                    {isPresetActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'تطبيق' : 'Apply')}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {isRtl ? p.nameAr : p.name}
                  </p>
                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                    {isRtl ? p.descriptionAr : p.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Card Geometry (Radius, Shadow, Border Style) */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {isRtl ? 'هندسة البطاقات والأزرار' : 'Card Geometry & Elevation'}
        </h3>

        {/* Border Radius */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            {isRtl ? 'انحناء الحواف (Border Radius)' : 'Border Radius'}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'sharp', label: isRtl ? 'حادة (0px)' : 'Sharp' },
              { id: 'subtle', label: isRtl ? 'بسيطة (8px)' : 'Subtle' },
              { id: 'rounded', label: isRtl ? 'دائرية (16px)' : 'Rounded' },
              { id: 'pill', label: isRtl ? 'كبسولة (Pill)' : 'Pill' }
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onCardRadiusChange(r.id as any)}
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                  cardRadius === r.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card Shadow */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            {isRtl ? 'مستوى الظل (Shadow / Elevation)' : 'Card Shadow'}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'none', label: isRtl ? 'بدون ظل' : 'Flat (None)' },
              { id: 'subtle', label: isRtl ? 'ظل خفيف' : 'Subtle' },
              { id: 'soft', label: isRtl ? 'ظل عائم' : 'Elevated' },
              { id: 'hard', label: isRtl ? 'ظل صلب' : 'Hard Edge' }
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onCardShadowChange(s.id as any)}
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                  cardShadow === s.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Border Style */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            {isRtl ? 'نمط حدود البطاقة' : 'Card Border Style'}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'none', label: isRtl ? 'بدون حدود' : 'None' },
              { id: 'thin', label: isRtl ? 'حد دقيق 1px' : 'Thin (1px)' },
              { id: 'bold', label: isRtl ? 'حد بارز 2px' : 'Bold (2px)' },
              { id: 'dashed', label: isRtl ? 'متقطع' : 'Dashed' }
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onBorderStyleChange(b.id as any)}
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                  borderStyle === b.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Colors: Accent & Surface */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {isRtl ? 'الألوان والخلفيات' : 'Palette & Surfaces'}
        </h3>

        {/* Accent Color */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            {isRtl ? 'لون التمييز الأساسي (Accent Color)' : 'Accent Color'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accentColor.startsWith('#') ? accentColor : '#4F46E5'}
              onChange={(e) => onAccentColorChange(e.target.value)}
              className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700 p-0.5 shrink-0"
            />
            <div className="flex flex-wrap gap-1.5 flex-1">
              {curatedAccents.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onAccentColorChange(hex)}
                  className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 cursor-pointer ${
                    accentColor.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-offset-2 ring-indigo-600 scale-105' : ''
                  }`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Surface / Card Color */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            {isRtl ? 'لون سطح البطاقات (Surface / Card Color)' : 'Surface / Card Color'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={surfaceColor.startsWith('#') ? surfaceColor : '#FFFFFF'}
              onChange={(e) => onSurfaceColorChange(e.target.value)}
              className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700 p-0.5 shrink-0"
            />
            <div className="flex flex-wrap gap-1.5 flex-1">
              {[
                { hex: '#FFFFFF', label: 'White' },
                { hex: '#F8FAFC', label: 'Slate 50' },
                { hex: '#FFFBEB', label: 'Amber 50' },
                { hex: '#1E293B', label: 'Slate 800' },
                { hex: '#0F172A', label: 'Slate 900' },
                { hex: 'rgba(255, 255, 255, 0.75)', label: 'Frost Glass' }
              ].map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => onSurfaceColorChange(swatch.hex)}
                  className={`w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 transition-transform hover:scale-110 cursor-pointer ${
                    surfaceColor.toLowerCase() === swatch.hex.toLowerCase() ? 'ring-2 ring-offset-2 ring-indigo-600 scale-105' : ''
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                  title={swatch.label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Background Style */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            {isRtl ? 'نمط خلفية الصفحة' : 'Page Background Style'}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[
              { id: 'signature', label: isRtl ? 'توقيع القالب' : 'Signature' },
              { id: 'gradient', label: isRtl ? 'تدرج لوني' : 'Gradient' },
              { id: 'minimal', label: isRtl ? 'بسيط مونو' : 'Minimal' },
              { id: 'immersive', label: isRtl ? 'توهج عميق' : 'Immersive' },
              { id: 'banner', label: isRtl ? 'صورة غلاف' : 'Cover Banner' }
            ].map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => onBgStyleChange(bg.id as any)}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                  bgStyle === bg.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                {bg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Mode Toggle (Auto / Dark / Light) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            {isRtl ? 'مظهر الإضاءة (Theme Mode)' : 'Appearance Mode'}
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onThemeModeChange('auto')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                themeMode === 'auto'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>{isRtl ? 'تلقائي' : 'Auto (System)'}</span>
            </button>
            <button
              type="button"
              onClick={() => onThemeModeChange('light')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                themeMode === 'light'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>{isRtl ? 'فاتح' : 'Light'}</span>
            </button>
            <button
              type="button"
              onClick={() => onThemeModeChange('dark')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                themeMode === 'dark'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>{isRtl ? 'داكن' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
