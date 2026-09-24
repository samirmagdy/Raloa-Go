import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layers,
  Palette,
  Users,
  BarChart3,
  Settings,
  Lock,
  ArrowRight,
  Sparkles,
  Smartphone,
  Eye,
  Edit3,
  Globe,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Locale, TemplateItem, BackgroundStyle } from '../../types';
import { templatesData } from '../../data/content';
import { useAuth } from '../../hooks/useAuth';
import { useHistoryState } from '../../hooks/useHistoryState';
import { RaloaMark } from '../brand/RaloaLogo';
import { PremiumMark } from '../brand/PremiumMark';

// Modular Studio Subcomponents
import { StudioTopToolbar } from '../studio/StudioTopToolbar';
import { StudioContentTab } from '../studio/StudioContentTab';
import { StudioDesignTab, VISUAL_PRESETS } from '../studio/StudioDesignTab';
import { StudioAudienceTab } from '../studio/StudioAudienceTab';
import { StudioAnalyticsTab } from '../studio/StudioAnalyticsTab';
import { StudioSettingsTab } from '../studio/StudioSettingsTab';
import { StudioMobileNav, StudioTab } from '../studio/StudioMobileNav';
import { StudioQrModal } from '../studio/StudioQrModal';
import { StudioLinktreeImporter } from '../studio/StudioLinktreeImporter';
import { StudioTemplatePreview } from '../studio/StudioTemplatePreview';
import { StudioBlockItem } from '../studio/SortableBlockList';

export interface StudioSiteConfig {
  username: string;
  templateId: string;
  displayName: string;
  role: string;
  bio: string;
  avatar: string;
  coverImage: string;
  bgStyle: BackgroundStyle;
  themeMode: 'auto' | 'dark' | 'light';
  links: StudioBlockItem[];
  isPublished: boolean;

  // Visual Design & Geometry Tokens
  accentColor?: string;
  surfaceColor?: string;
  cardRadius?: 'sharp' | 'subtle' | 'rounded' | 'pill';
  cardShadow?: 'none' | 'subtle' | 'soft' | 'hard';
  borderStyle?: 'none' | 'thin' | 'bold' | 'dashed';

  // Site Settings, SEO & Integrations
  customDomain?: string;
  metaTitle?: string;
  metaDescription?: string;
  hidePoweredBy?: boolean;
  sensitiveWarning?: boolean;
  ga4Id?: string;
  metaPixelId?: string;
  webhookUrl?: string;
}

export interface StudioModalProps {
  initialUsername?: string;
  initialTemplate?: TemplateItem;
  locale: Locale;
  onClose: () => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onOpenPricing?: () => void;
}

export const StudioModal: React.FC<StudioModalProps> = ({
  initialUsername = 'creator',
  initialTemplate,
  locale,
  onClose,
  onOpenAuth,
  onOpenPricing
}) => {
  const { user, profile, loading: authLoading, saveMiniSite, loadMiniSite } = useAuth();
  const isRtl = locale === 'ar';
  const defaultTemplate = initialTemplate || templatesData[0];

  // Active top-level Tab State
  const [activeTab, setActiveTab] = useState<StudioTab>('content');

  // Mobile view toggle (Editor pane vs Live Phone canvas)
  const [mobileViewMode, setMobileViewMode] = useState<'editor' | 'preview'>('editor');

  // Preview Mode for Phone Mockup ('phone' | 'social')
  const [previewMode, setPreviewMode] = useState<'phone' | 'social'>('phone');

  // Secondary Modals
  const [showQrModal, setShowQrModal] = useState(false);
  const [showLinktreeImporter, setShowLinktreeImporter] = useState(false);

  // Real-time Save status: 'saving' | 'saved' | 'live' | 'error'
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'live' | 'error'>('live');

  const isInitialLoadDone = useRef(false);
  const lastTextEditRef = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve user handle safely
  const resolvedHandle =
    profile?.handle ||
    user?.displayName?.toLowerCase().replace(/\s+/g, '') ||
    user?.email?.split('@')[0] ||
    initialUsername ||
    'creator';

  // Undo / Redo state history stack for the Studio site configuration
  const {
    state: siteConfig,
    set: setSiteConfig,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory
  } = useHistoryState<StudioSiteConfig>(() => ({
    username: resolvedHandle,
    templateId: defaultTemplate.id,
    displayName: defaultTemplate.name,
    role: defaultTemplate.role,
    bio: isRtl ? defaultTemplate.bioAr : defaultTemplate.bio,
    avatar: defaultTemplate.avatar,
    coverImage: defaultTemplate.coverImage,
    bgStyle: defaultTemplate.backgroundStyle || 'signature',
    themeMode: 'auto',
    links: defaultTemplate.sampleLinks.map((l) => ({
      id: l.id,
      title: isRtl ? l.titleAr : l.title,
      url: l.url,
      subtitle: (isRtl ? l.subtitleAr : l.subtitle) || '',
      type: l.type || 'link'
    })),
    isPublished: true,
    accentColor: '#4F46E5',
    surfaceColor: '#FFFFFF',
    cardRadius: 'rounded',
    cardShadow: 'subtle',
    borderStyle: 'thin',
    customDomain: '',
    metaTitle: '',
    metaDescription: '',
    hidePoweredBy: false,
    sensitiveWarning: false,
    ga4Id: '',
    metaPixelId: '',
    webhookUrl: ''
  }));

  const {
    username,
    templateId,
    displayName,
    role,
    bio,
    avatar,
    coverImage,
    bgStyle,
    themeMode,
    links,
    accentColor = '#4F46E5',
    surfaceColor = '#FFFFFF',
    cardRadius = 'rounded',
    cardShadow = 'subtle',
    borderStyle = 'thin',
    customDomain = '',
    metaTitle = '',
    metaDescription = '',
    hidePoweredBy = false,
    sensitiveWarning = false,
    ga4Id = '',
    metaPixelId = '',
    webhookUrl = ''
  } = siteConfig;

  const selectedTemplate =
    templatesData.find((t) => t.id === templateId) || defaultTemplate;

  // Discrete structural change (creates new undo step in history)
  const updateSiteConfig = useCallback(
    (
      updater:
        | Partial<StudioSiteConfig>
        | ((prev: StudioSiteConfig) => StudioSiteConfig),
      options?: { overwrite?: boolean }
    ) => {
      lastTextEditRef.current = 0;
      setSiteConfig((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        return next;
      }, options);
    },
    [setSiteConfig]
  );

  // Group rapid typing within 700ms into a single undo step
  const updateTextField = useCallback(
    (field: keyof StudioSiteConfig, value: any) => {
      const now = Date.now();
      const shouldOverwrite = now - lastTextEditRef.current < 700;
      lastTextEditRef.current = now;
      setSiteConfig((prev) => ({ ...prev, [field]: value }), {
        overwrite: shouldOverwrite
      });
    },
    [setSiteConfig]
  );

  // Load existing user mini-site from Firestore when authenticated
  useEffect(() => {
    if (!user) {
      isInitialLoadDone.current = true;
      setSaveStatus('live');
      return;
    }
    let isCancelled = false;

    async function loadData() {
      try {
        const savedSite = await loadMiniSite('default');
        if (savedSite && !isCancelled) {
          const loadedConfig: StudioSiteConfig = {
            username: savedSite.username || resolvedHandle,
            templateId: savedSite.templateId || defaultTemplate.id,
            displayName: savedSite.displayName || defaultTemplate.name,
            role: savedSite.role || defaultTemplate.role,
            bio:
              savedSite.bio !== undefined
                ? savedSite.bio
                : isRtl
                ? defaultTemplate.bioAr
                : defaultTemplate.bio,
            avatar: savedSite.avatar || defaultTemplate.avatar,
            coverImage: savedSite.coverImage || defaultTemplate.coverImage,
            bgStyle: savedSite.bgStyle || 'signature',
            themeMode: savedSite.themeMode || 'auto',
            links:
              savedSite.links && savedSite.links.length > 0
                ? savedSite.links
                : defaultTemplate.sampleLinks.map((l) => ({
                    id: l.id,
                    title: isRtl ? l.titleAr : l.title,
                    url: l.url,
                    subtitle: (isRtl ? l.subtitleAr : l.subtitle) || '',
                    type: l.type || 'link'
                  })),
            isPublished: savedSite.isPublished ?? true,
            accentColor: (savedSite as any).accentColor || '#4F46E5',
            surfaceColor: (savedSite as any).surfaceColor || '#FFFFFF',
            cardRadius: (savedSite as any).cardRadius || 'rounded',
            cardShadow: (savedSite as any).cardShadow || 'subtle',
            borderStyle: (savedSite as any).borderStyle || 'thin',
            customDomain: (savedSite as any).customDomain || '',
            metaTitle: (savedSite as any).metaTitle || '',
            metaDescription: (savedSite as any).metaDescription || '',
            hidePoweredBy: (savedSite as any).hidePoweredBy ?? false,
            sensitiveWarning: (savedSite as any).sensitiveWarning ?? false,
            ga4Id: (savedSite as any).ga4Id || '',
            metaPixelId: (savedSite as any).metaPixelId || '',
            webhookUrl: (savedSite as any).webhookUrl || ''
          };

          resetHistory(loadedConfig);
        }
        if (!isCancelled) {
          setSaveStatus('live');
        }
      } catch (e) {
        console.error('Failed to load user mini-site from Firestore:', e);
        if (!isCancelled) {
          setSaveStatus('error');
        }
      } finally {
        if (!isCancelled) {
          isInitialLoadDone.current = true;
        }
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [user, resolvedHandle]);

  // Persist directly to live content in Firestore (Autosave directly to live content)
  const persistSiteConfig = useCallback(
    async (configToSave: StudioSiteConfig = siteConfig) => {
      setSaveStatus('saving');

      try {
        if (user) {
          await saveMiniSite({
            username: configToSave.username,
            displayName: configToSave.displayName,
            role: configToSave.role,
            bio: configToSave.bio,
            templateId: configToSave.templateId,
            avatar: configToSave.avatar,
            coverImage: configToSave.coverImage,
            bgStyle: configToSave.bgStyle,
            themeMode: configToSave.themeMode,
            links: configToSave.links,
            isPublished: true,
            ...({
              accentColor: configToSave.accentColor,
              surfaceColor: configToSave.surfaceColor,
              cardRadius: configToSave.cardRadius,
              cardShadow: configToSave.cardShadow,
              borderStyle: configToSave.borderStyle,
              customDomain: configToSave.customDomain,
              metaTitle: configToSave.metaTitle,
              metaDescription: configToSave.metaDescription,
              hidePoweredBy: configToSave.hidePoweredBy,
              sensitiveWarning: configToSave.sensitiveWarning,
              ga4Id: configToSave.ga4Id,
              metaPixelId: configToSave.metaPixelId,
              webhookUrl: configToSave.webhookUrl
            } as any)
          });
        } else {
          // Local fallback in case of unauthenticated preview mode
          try {
            localStorage.setItem(
              `raloa_studio_site_${configToSave.username}`,
              JSON.stringify(configToSave)
            );
          } catch (_) {}
          await new Promise((r) => setTimeout(r, 200));
        }

        // Step 1: Transition to 'saved'
        setSaveStatus('saved');
        // Step 2: Transition to 'live' after 600ms
        setTimeout(() => {
          setSaveStatus('live');
        }, 600);
      } catch (err) {
        console.error('Failed to autosave live site configuration:', err);
        setSaveStatus('error');
      }
    },
    [user, saveMiniSite, siteConfig]
  );

  // Debounced Autosave (700ms debounce)
  useEffect(() => {
    if (!isInitialLoadDone.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');

    saveTimeoutRef.current = setTimeout(() => {
      persistSiteConfig(siteConfig);
    }, 700);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [siteConfig, persistSiteConfig]);

  // Global Keyboard Shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (canRedo) {
            e.preventDefault();
            redo();
          }
        } else {
          if (canUndo) {
            e.preventDefault();
            undo();
          }
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  // Build live preview template object for the right-hand PhoneMockup
  const livePreviewTemplate: TemplateItem = {
    ...selectedTemplate,
    name: displayName,
    role: role,
    bio: bio,
    bioAr: bio,
    avatar: avatar,
    coverImage: coverImage,
    backgroundStyle: bgStyle,
    sampleLinks: links.map((l) => ({
      id: l.id,
      title: l.title,
      titleAr: l.title,
      subtitle: l.subtitle,
      subtitleAr: l.subtitle,
      url: l.url,
      type: l.type as any
    }))
  };

  // 1. Authenticated-Only Gate Screen
  if (!authLoading && !user) {
    return (
      <main className="min-h-[100dvh] w-full bg-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Ambient background styling */}
        <div className="absolute inset-0 bg-radial from-indigo-900/30 via-slate-950 to-slate-950 -z-10 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center relative z-10 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4">
            <PremiumMark className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isRtl ? 'استوديو رالوا' : 'RALOA Studio'}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
            {isRtl ? 'تسجيل الدخول مطلوب' : 'Creator Sign-In Required'}
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            {isRtl
              ? 'الوصول إلى استوديو البناء مخصص للمستخدمين المسجلين فقط. سجّل دخولك لإدارة موقعك وإحصائياتك ونشر محتواك الحي.'
              : 'Studio is reserved for authenticated creators. Please sign in or create your account to build, customize, and manage your live page.'}
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onOpenAuth?.('signin')}
              className="w-full py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <span>{isRtl ? 'تسجيل الدخول' : 'Sign In to Studio'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>

            <button
              type="button"
              onClick={() => onOpenAuth?.('signup')}
              className="w-full py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>{isRtl ? 'إنشاء حساب صانع جديد' : 'Create Creator Account'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {isRtl ? 'العودة للصفحة الرئيسية' : 'Return to Home'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 2. Main Studio / Editor Interface
  return (
    <main className="min-h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased">
      {/* Top Toolbar */}
      <StudioTopToolbar
        handle={username}
        plan={profile?.plan || 'free'}
        saveStatus={saveStatus}
        onRetrySave={() => persistSiteConfig(siteConfig)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onOpenQr={() => setShowQrModal(true)}
        onClose={onClose}
        locale={locale}
      />

      {/* Main Studio Body Workspace */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col lg:flex-row gap-6 xl:gap-8 overflow-hidden">
        
        {/* Left Column: Editor Controls & Tabs */}
        <section
          className={`w-full lg:w-[56%] xl:w-[58%] flex flex-col min-w-0 ${
            mobileViewMode === 'preview' ? 'hidden lg:flex' : 'flex'
          }`}
          aria-label="Editor controls"
        >
          {/* Desktop Navigation Tabs */}
          <div className="hidden lg:flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-900/80 rounded-2xl mb-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'content'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{isRtl ? 'المحتوى' : 'Content'}</span>
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] flex items-center justify-center text-slate-500 dark:text-slate-300">
                {links.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('design')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'design'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>{isRtl ? 'المظهر' : 'Design'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audience')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'audience'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{isRtl ? 'الجمهور' : 'Audience'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>{isRtl ? 'التحليلات' : 'Analytics'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>{isRtl ? 'الإعدادات' : 'Settings'}</span>
            </button>
          </div>

          {/* Tab Pane Active Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar pb-24 lg:pb-12">
            {activeTab === 'content' && (
              <StudioContentTab
                displayName={displayName}
                onDisplayNameChange={(val) => updateTextField('displayName', val)}
                username={username}
                onUsernameChange={(val) => updateTextField('username', val)}
                role={role}
                onRoleChange={(val) => updateTextField('role', val)}
                bio={bio}
                onBioChange={(val) => updateTextField('bio', val)}
                avatar={avatar}
                onAvatarChange={(val) => updateTextField('avatar', val)}
                links={links}
                onLinksChange={(newLinks) => updateSiteConfig({ links: newLinks })}
                onOpenLinktreeImport={() => setShowLinktreeImporter(true)}
                locale={locale}
              />
            )}

            {activeTab === 'design' && (
              <StudioDesignTab
                templateId={templateId}
                onTemplateIdChange={(tId) => updateSiteConfig({ templateId: tId })}
                bgStyle={bgStyle}
                onBgStyleChange={(style) => updateSiteConfig({ bgStyle: style })}
                themeMode={themeMode}
                onThemeModeChange={(mode) => updateSiteConfig({ themeMode: mode })}
                accentColor={accentColor}
                onAccentColorChange={(col) => updateSiteConfig({ accentColor: col })}
                surfaceColor={surfaceColor}
                onSurfaceColorChange={(surf) => updateSiteConfig({ surfaceColor: surf })}
                cardRadius={cardRadius}
                onCardRadiusChange={(rad) => updateSiteConfig({ cardRadius: rad })}
                cardShadow={cardShadow}
                onCardShadowChange={(shd) => updateSiteConfig({ cardShadow: shd })}
                borderStyle={borderStyle}
                onBorderStyleChange={(bs) => updateSiteConfig({ borderStyle: bs })}
                onApplyPreset={(p) => {
                  updateSiteConfig({
                    accentColor: p.accentColor,
                    surfaceColor: p.surfaceColor,
                    cardRadius: p.radius,
                    cardShadow: p.shadow,
                    borderStyle: p.borderStyle,
                    bgStyle: p.bgStyle,
                    themeMode: p.themeMode
                  });
                }}
                onResetDefault={() => {
                  const preset = VISUAL_PRESETS[0];
                  updateSiteConfig({
                    accentColor: preset.accentColor,
                    surfaceColor: preset.surfaceColor,
                    cardRadius: preset.radius,
                    cardShadow: preset.shadow,
                    borderStyle: preset.borderStyle,
                    bgStyle: preset.bgStyle,
                    themeMode: preset.themeMode
                  });
                }}
                locale={locale}
              />
            )}

            {activeTab === 'audience' && (
              <StudioAudienceTab handle={username} locale={locale} />
            )}

            {activeTab === 'analytics' && (
              <StudioAnalyticsTab links={links} locale={locale} />
            )}

            {activeTab === 'settings' && (
              <StudioSettingsTab
                handle={username}
                plan={profile?.plan || 'free'}
                customDomain={customDomain}
                onCustomDomainChange={(val) => updateTextField('customDomain', val)}
                metaTitle={metaTitle}
                onMetaTitleChange={(val) => updateTextField('metaTitle', val)}
                metaDescription={metaDescription}
                onMetaDescriptionChange={(val) => updateTextField('metaDescription', val)}
                hidePoweredBy={hidePoweredBy}
                onHidePoweredByChange={(val) => updateSiteConfig({ hidePoweredBy: val })}
                sensitiveWarning={sensitiveWarning}
                onSensitiveWarningChange={(val) => updateSiteConfig({ sensitiveWarning: val })}
                ga4Id={ga4Id}
                onGa4IdChange={(val) => updateTextField('ga4Id', val)}
                metaPixelId={metaPixelId}
                onMetaPixelIdChange={(val) => updateTextField('metaPixelId', val)}
                webhookUrl={webhookUrl}
                onWebhookUrlChange={(val) => updateTextField('webhookUrl', val)}
                onUpgradePlan={onOpenPricing}
                onExportJson={() => {
                  const blob = new Blob([JSON.stringify(siteConfig, null, 2)], {
                    type: 'application/json'
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `raloa-site-${username}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                onResetDefaults={() => {
                  if (confirm(isRtl ? 'هل تريد استعادة الإعدادات الافتراضية؟' : 'Reset site settings to defaults?')) {
                    updateSiteConfig({
                      accentColor: '#4F46E5',
                      surfaceColor: '#FFFFFF',
                      cardRadius: 'rounded',
                      cardShadow: 'subtle',
                      borderStyle: 'thin',
                      bgStyle: 'signature',
                      themeMode: 'auto'
                    });
                  }
                }}
                locale={locale}
              />
            )}
          </div>
        </section>

        {/* Right Column: Live Interactive Phone Canvas */}
        <aside
          className={`w-full lg:w-[44%] xl:w-[42%] flex flex-col items-center justify-start lg:sticky lg:top-20 self-start ${
            mobileViewMode === 'editor' ? 'hidden lg:flex' : 'flex'
          }`}
          aria-label="Live preview canvas"
        >
          <div className="w-full flex justify-center py-2 lg:py-0">
            <StudioTemplatePreview
              template={livePreviewTemplate}
              username={username}
              displayName={displayName}
              role={role}
              bio={bio}
              avatar={avatar}
              coverImage={coverImage}
              links={links}
              bgStyle={bgStyle}
              themeMode={themeMode}
              isRtl={isRtl}
              locale={locale}
              previewMode={previewMode}
              onPreviewModeChange={setPreviewMode}
              accentColor={accentColor}
              surfaceColor={surfaceColor}
              cardRadius={cardRadius}
              cardShadow={cardShadow}
              borderStyle={borderStyle}
              onOpenPhoneAction={(_action, data) => {
                if (data?.url) {
                  window.open(data.url, '_blank', 'noopener,noreferrer');
                }
              }}
            />
          </div>
        </aside>

      </div>

      {/* Mobile Bottom Navigation & Editor / Preview Toggle */}
      <StudioMobileNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setMobileViewMode('editor');
        }}
        mobileViewMode={mobileViewMode}
        onToggleMobileViewMode={() => {
          setMobileViewMode((prev) => (prev === 'editor' ? 'preview' : 'editor'));
        }}
        locale={locale}
      />

      {/* QR Code Modal */}
      <StudioQrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        url={`https://raloa.app/@${username}`}
        handle={username}
        locale={locale}
      />

      {/* Linktree Importer Modal */}
      <StudioLinktreeImporter
        isOpen={showLinktreeImporter}
        onClose={() => setShowLinktreeImporter(false)}
        onImport={(importedData) => {
          updateSiteConfig((prev) => ({
            ...prev,
            displayName: importedData.displayName || prev.displayName,
            bio: importedData.bio || prev.bio,
            links: [...prev.links, ...importedData.links]
          }));
        }}
        locale={locale}
      />
    </main>
  );
};
