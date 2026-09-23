import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Share2,
  Copy,
  ExternalLink,
  ArrowRight,
  ChevronLeft,
  Smartphone,
  Eye,
  Sliders,
  Globe,
  Upload,
  QrCode,
  Printer,
  Cloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Undo2,
  Redo2
} from 'lucide-react';
import { Locale, TemplateItem, MiniSiteUserConfig, BackgroundStyle } from '../../types';
import { templatesData } from '../../data/content';
import { PhoneMockup } from '../PhoneMockup';
import { RaloaMark } from '../brand/RaloaLogo';
import { fireSiteLaunchConfetti } from '../../utils/confetti';
import { SocialPreviewGenerator } from '../studio/SocialPreviewGenerator';
import { SortableBlockList, StudioBlockItem } from '../studio/SortableBlockList';
import { StudioTemplatePreview } from '../studio/StudioTemplatePreview';
import { useAuth } from '../../hooks/useAuth';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useHistoryState } from '../../hooks/useHistoryState';

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
}

interface StudioModalProps {
  initialUsername?: string;
  initialTemplate?: TemplateItem;
  locale: Locale;
  onClose: () => void;
}

export const StudioModal: React.FC<StudioModalProps> = ({
  initialUsername = 'creator',
  initialTemplate,
  locale,
  onClose
}) => {
  const { user, saveMiniSite, loadMiniSite } = useAuth();
  const isRtl = locale === 'ar';
  const dialogRef = useModalA11y<HTMLDivElement>();
  const defaultTemplate = initialTemplate || templatesData[0];

  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  const isInitialLoadDone = useRef(false);
  const lastTextEditRef = useRef<number>(0);

  // Undo/Redo state history stack for site configuration
  const {
    state: siteConfig,
    set: setSiteConfig,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory
  } = useHistoryState<StudioSiteConfig>(() => ({
    username: initialUsername || 'alex',
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
    isPublished: false
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
    isPublished
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

  // Text inputs (groups rapid typing within 700ms into a single undo step)
  const updateTextField = useCallback(
    (field: keyof StudioSiteConfig, value: string) => {
      const now = Date.now();
      const shouldOverwrite = now - lastTextEditRef.current < 700;
      lastTextEditRef.current = now;
      setSiteConfig((prev) => ({ ...prev, [field]: value }), {
        overwrite: shouldOverwrite
      });
    },
    [setSiteConfig]
  );

  const setUsername = useCallback((val: string) => updateTextField('username', val), [updateTextField]);
  const setDisplayName = useCallback((val: string) => updateTextField('displayName', val), [updateTextField]);
  const setRole = useCallback((val: string) => updateTextField('role', val), [updateTextField]);
  const setBio = useCallback((val: string) => updateTextField('bio', val), [updateTextField]);
  const setCoverImage = useCallback((val: string) => updateTextField('coverImage', val), [updateTextField]);
  const setAvatar = useCallback((val: string) => updateTextField('avatar', val), [updateTextField]);
  const setBgStyle = useCallback((val: BackgroundStyle) => updateSiteConfig({ bgStyle: val }), [updateSiteConfig]);
  const setThemeMode = useCallback((val: 'auto' | 'dark' | 'light') => updateSiteConfig({ themeMode: val }), [updateSiteConfig]);
  const setIsPublished = useCallback((val: boolean) => updateSiteConfig({ isPublished: val }), [updateSiteConfig]);
  const setLinks = useCallback((newLinks: StudioBlockItem[]) => updateSiteConfig({ links: newLinks }), [updateSiteConfig]);

  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newType, setNewType] = useState<'link' | 'gallery' | 'booking' | 'shop'>('link');

  const [activeTab, setActiveTab] = useState<'design' | 'content' | 'social' | 'share'>('design');
  const [previewMode, setPreviewMode] = useState<'phone' | 'social'>('phone');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Load existing user mini-site from Firestore when authenticated
  useEffect(() => {
    if (!user) {
      isInitialLoadDone.current = true;
      setSyncStatus('saved');
      return;
    }
    let isCancelled = false;

    async function loadData() {
      try {
        const savedSite = await loadMiniSite('default');
        if (savedSite && !isCancelled) {
          const loadedConfig: StudioSiteConfig = {
            username: savedSite.username || initialUsername || 'alex',
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
            links: savedSite.links && savedSite.links.length > 0 ? savedSite.links : defaultTemplate.sampleLinks.map((l) => ({
              id: l.id,
              title: isRtl ? l.titleAr : l.title,
              url: l.url,
              subtitle: (isRtl ? l.subtitleAr : l.subtitle) || '',
              type: l.type || 'link'
            })),
            isPublished: savedSite.isPublished ?? false
          };

          resetHistory(loadedConfig);
          setIsCloudSynced(true);
        }
        if (!isCancelled) {
          setSyncStatus('saved');
        }
      } catch (e) {
        console.error('Failed to fetch user site from Firestore:', e);
        if (!isCancelled) {
          setSyncStatus('error');
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
  }, [user]);

  // Persist current site configuration object to Firestore
  const persistSiteConfig = async (
    configToSave: StudioSiteConfig = siteConfig
  ) => {
    setSyncStatus('saving');
    setIsSavingCloud(true);

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
          isPublished: configToSave.isPublished
        });
      } else {
        // In guest mode, save to localStorage as fallback
        try {
          localStorage.setItem(
            `raloa_guest_site_${configToSave.username}`,
            JSON.stringify({
              ...configToSave,
              updatedAt: new Date().toISOString()
            })
          );
        } catch (err) {
          // Ignore localStorage quota errors
        }
        // Small delay so user visually sees saving feedback in guest mode
        await new Promise((r) => setTimeout(r, 250));
      }
      setSyncStatus('saved');
      setIsCloudSynced(true);
    } catch (e) {
      console.error('Failed to persist site configuration to Firestore:', e);
      setSyncStatus('error');
    } finally {
      setIsSavingCloud(false);
    }
  };

  // Auto-save site configuration to Firestore whenever siteConfig changes (including undo/redo)
  useEffect(() => {
    if (!isInitialLoadDone.current) return;

    const timer = setTimeout(() => {
      persistSiteConfig(siteConfig);
    }, 700);

    return () => clearTimeout(timer);
  }, [siteConfig]);

  // Undo / Redo user actions with immediate feedback
  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    undo();
  }, [undo, canUndo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    redo();
  }, [redo, canRedo]);

  // Global Undo / Redo keyboard shortcuts (Ctrl+Z / Cmd+Z, Ctrl+Shift+Z / Cmd+Shift+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      const key = e.key.toLowerCase();
      if (key === 'z') {
        if (e.shiftKey) {
          // Redo
          if (canRedo) {
            e.preventDefault();
            handleRedo();
          }
        } else {
          // Undo
          if (canUndo) {
            e.preventDefault();
            handleUndo();
          }
        }
      } else if (key === 'y') {
        // Redo (Ctrl+Y)
        if (canRedo) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, canUndo, canRedo]);

  // Trigger site launch with celebratory confetti explosion and cloud sync
  const handleStartOrPublishSite = async () => {
    updateSiteConfig({ isPublished: true });
    setActiveTab('share');
    fireSiteLaunchConfetti();
    if (user) {
      await persistSiteConfig({ ...siteConfig, isPublished: true });
    }
  };

  // Sync when template changes (pushed to history stack)
  const handleTemplateSwitch = (tmpl: TemplateItem) => {
    const newLinks = tmpl.sampleLinks.map((l) => ({
      id: l.id,
      title: isRtl ? l.titleAr : l.title,
      url: l.url,
      subtitle: (isRtl ? l.subtitleAr : l.subtitle) || '',
      type: l.type || 'link'
    }));

    updateSiteConfig({
      templateId: tmpl.id,
      displayName: tmpl.name,
      role: tmpl.role,
      bio: isRtl ? tmpl.bioAr : tmpl.bio,
      avatar: tmpl.avatar,
      coverImage: tmpl.coverImage,
      bgStyle: tmpl.backgroundStyle || 'signature',
      links: newLinks
    });
  };

  // Add component/link and persist to Firestore
  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    const newLinkItem: StudioBlockItem = {
      id: `link-${Date.now()}`,
      title: newTitle.trim(),
      url: newUrl.trim(),
      subtitle: newSubtitle.trim(),
      type: newType
    };
    const updatedLinks = [...links, newLinkItem];
    updateSiteConfig({ links: updatedLinks });
    setNewTitle('');
    setNewUrl('');
    setNewSubtitle('');

    // Instant save to Firestore
    await persistSiteConfig({ ...siteConfig, links: updatedLinks });
  };

  // Remove component/link and persist to Firestore
  const removeLink = async (id: string) => {
    const updatedLinks = links.filter((l) => l.id !== id);
    updateSiteConfig({ links: updatedLinks });

    // Instant save to Firestore
    await persistSiteConfig({ ...siteConfig, links: updatedLinks });
  };

  // Reorder components and persist to Firestore
  const handleReorderLinks = async (newItems: StudioBlockItem[]) => {
    updateSiteConfig({ links: newItems });

    // Instant save to Firestore
    await persistSiteConfig({ ...siteConfig, links: newItems });
  };

  const handleCopyLink = () => {
    const url = `https://raloa.app/@${username}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Preview template constructed from user state
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 raloa-studio-modal-container"
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-dialog-title"
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[860px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col raloa-studio-modal-card">
        
        {/* Studio Top Navigation Bar */}
        <div className="h-16 px-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0 print:border-b-2 print:border-slate-800">
          <div className="flex items-center gap-3">
            <RaloaMark size={34} />
            <div>
              <h2 id="studio-dialog-title" className="text-sm font-extrabold text-[#0F172A] leading-tight flex items-center gap-1.5">
                <span>RALOA Studio</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 print:hidden">
                  {isRtl ? 'مباشر' : 'Live Editor'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                raloa.app/@{username}
              </p>
            </div>
          </div>

          {/* Center Tabs */}
          <div className="hidden sm:flex items-center gap-1 p-1 bg-slate-100 rounded-xl print:hidden">
            <button
              onClick={() => setActiveTab('design')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'design'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isRtl ? 'القالب والمظهر' : 'Templates & Design'}
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'content'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isRtl ? 'الروابط والمحتوى' : 'Links & Bio'}
            </button>
            <button
              onClick={() => setActiveTab('social')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'social'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Share2 className="w-3 h-3 text-indigo-500" />
              <span>{isRtl ? 'المعاينة الاجتماعية' : 'Social Preview'}</span>
            </button>
            <button
              onClick={() => setActiveTab('share')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'share'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isRtl ? 'النشر والمشاركة' : 'Publish & Share'}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 print:hidden">
            {/* Undo / Redo buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  canUndo
                    ? 'bg-white text-slate-800 shadow-2xs hover:bg-slate-50 cursor-pointer active:scale-95'
                    : 'text-slate-300 cursor-not-allowed'
                }`}
                title={isRtl ? 'تراجع (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
                aria-label="Undo"
                data-testid="undo-button"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px] font-bold">{isRtl ? 'تراجع' : 'Undo'}</span>
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  canRedo
                    ? 'bg-white text-slate-800 shadow-2xs hover:bg-slate-50 cursor-pointer active:scale-95'
                    : 'text-slate-300 cursor-not-allowed'
                }`}
                title={isRtl ? 'إعادة (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
                aria-label="Redo"
                data-testid="redo-button"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px] font-bold">{isRtl ? 'إعادة' : 'Redo'}</span>
              </button>
            </div>

            {user ? (
              <button
                type="button"
                onClick={() => persistSiteConfig()}
                disabled={syncStatus === 'saving'}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                title={isRtl ? 'حفظ التغييرات في السحابة فورياً' : 'Save to Firestore Cloud'}
              >
                {syncStatus === 'saving' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                ) : syncStatus === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>
                  {syncStatus === 'saving'
                    ? (isRtl ? 'جاري الحفظ...' : 'Saving...')
                    : syncStatus === 'error'
                    ? (isRtl ? 'خطأ' : 'Error')
                    : (isRtl ? 'تم الحفظ' : 'Changes saved')}
                </span>
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <Cloud className="w-3 h-3 text-amber-600" />
                <span>{isRtl ? 'وضع الضيف' : 'Guest Mode'}</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              aria-label={isRtl ? 'طباعة معاينة الموقع' : 'Print Mini-Site Preview'}
              title={isRtl ? 'طباعة معاينة الموقع' : 'Print Mini-Site Preview'}
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={handleStartOrPublishSite}
              className="px-4 py-2 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isPublished ? (isRtl ? 'تم النشر بنجاح' : 'Live & Published') : (isRtl ? 'نشر وتفعيل الموقع' : 'Launch Site')}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close studio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Workspace: Split 2-Column (Left: Editor Panels, Right: Live Phone Screen) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-slate-50 print:bg-white print:block">
          
          {/* Left Column: Editor Controls (lg:col-span-7) */}
          <div className="lg:col-span-7 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-white border-r border-slate-200 studio-editor-sidebar print:hidden">
            
            {/* Mobile Tab Switcher */}
            <div className="sm:hidden flex items-center gap-1 p-1 bg-slate-100 rounded-xl mb-6">
              <button
                onClick={() => setActiveTab('design')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'design' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                {isRtl ? 'القالب' : 'Template'}
              </button>
              <button
                onClick={() => setActiveTab('content')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'content' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                {isRtl ? 'المحتوى' : 'Content'}
              </button>
              <button
                onClick={() => setActiveTab('social')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'social' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                {isRtl ? 'المعاينة' : 'Social'}
              </button>
              <button
                onClick={() => setActiveTab('share')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'share' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                {isRtl ? 'المشاركة' : 'Share'}
              </button>
            </div>

            {/* TAB 1: DESIGN & TEMPLATE SELECTION */}
            {activeTab === 'design' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 mb-1">
                    {isRtl ? 'اختر قالب التصميم الأساسي' : 'Select a Design Template'}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {isRtl
                      ? 'جميع القوالب مصممة باحترافية وتتكيف تلقائياً مع محتواك وروابطك.'
                      : 'All templates are crafted with responsive typography, curated colors and conversion-focused cards.'}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {templatesData.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => handleTemplateSwitch(tmpl)}
                        className={`p-2.5 rounded-2xl border text-left rtl:text-right transition-all flex flex-col items-center group cursor-pointer ${
                          selectedTemplate.id === tmpl.id
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/40 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <img
                          src={tmpl.avatar}
                          alt={tmpl.name}
                          className="w-14 h-14 rounded-full object-cover mb-2 border border-slate-200 group-hover:scale-105 transition-transform"
                        />
                        <span className="font-bold text-xs text-slate-900 text-center truncate w-full">
                          {tmpl.name}
                        </span>
                        <span className="text-[10px] text-slate-500 text-center truncate w-full">
                          {tmpl.category}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Background Style & Theme Controls */}
                  <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          {isRtl ? 'نمط خلفية القالب' : 'Template Background Style'}
                        </label>
                        <span className="text-[10px] font-medium text-slate-500">
                          {isRtl ? 'يتفاعل مباشرة في المعاينة' : 'Updates live in preview'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { id: 'signature', labelEn: 'Signature', labelAr: 'الأساسي' },
                          { id: 'immersive', labelEn: 'Wallpaper', labelAr: 'خلفية كاملة' },
                          { id: 'banner', labelEn: 'Banner', labelAr: 'بانر علوي' },
                          { id: 'gradient', labelEn: 'Gradient', labelAr: 'تدرج فني' },
                          { id: 'minimal', labelEn: 'Minimal', labelAr: 'بسيط' }
                        ].map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setBgStyle(b.id as BackgroundStyle)}
                            className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                              bgStyle === b.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {isRtl ? b.labelAr : b.labelEn}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cover Banner Image Setting */}
                    <div>
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                        {isRtl ? 'صورة الغلاف (Cover Banner)' : 'Cover Banner Image'}
                      </label>
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative w-full sm:w-28 h-16 rounded-xl overflow-hidden border border-slate-300 bg-slate-200 shrink-0">
                          <img
                            src={coverImage}
                            alt="Cover"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 w-full space-y-1.5">
                          <input
                            type="url"
                            value={coverImage}
                            onChange={(e) => setCoverImage(e.target.value)}
                            placeholder={isRtl ? 'رابط صورة الغلاف https://...' : 'Cover image URL https://...'}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-700"
                          />
                          {/* Quick presets */}
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[10px]">
                            <span className="text-slate-400 font-medium shrink-0">
                              {isRtl ? 'نماذج سريعة:' : 'Quick Presets:'}
                            </span>
                            {templatesData.slice(0, 5).map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setCoverImage(t.coverImage)}
                                className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 whitespace-nowrap cursor-pointer transition-colors"
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Color Tone Mode */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        {isRtl ? 'درجة الألوان (الوضع الداكن/الفاتح)' : 'Theme Tone'}
                      </span>
                      <div className="flex items-center gap-1 p-0.5 bg-slate-200/80 rounded-lg text-xs">
                        {[
                          { id: 'auto', labelEn: 'Auto', labelAr: 'تلقائي' },
                          { id: 'dark', labelEn: 'Dark', labelAr: 'داكن' },
                          { id: 'light', labelEn: 'Light', labelAr: 'فاتح' }
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setThemeMode(m.id as any)}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                              themeMode === m.id
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {isRtl ? m.labelAr : m.labelEn}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Handle & Username settings */}
                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                    {isRtl ? 'رابط الصفحة المخصص' : 'Your Page Handle'}
                  </h4>
                  <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white">
                    <span className="text-xs font-bold text-slate-400 select-none ltr:mr-1 rtl:ml-1">
                      raloa.app/@
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none w-full"
                    />
                  </div>

                  {/* Tab 1 Navigation & Launch Button */}
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('content')}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    >
                      {isRtl ? 'متابعة لتعديل الروابط ←' : 'Next: Edit Links →'}
                    </button>
                    <button
                      type="button"
                      onClick={handleStartOrPublishSite}
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isRtl ? 'بدء ونشر الموقع الآن' : 'Start & Launch Site'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CONTENT & LINKS MANAGER */}
            {activeTab === 'content' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 mb-1">
                    {isRtl ? 'الملف الشخصي والنبذة' : 'Profile & Bio'}
                  </h3>
                  <div className="space-y-3 mt-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {isRtl ? 'الاسم الظاهر' : 'Display Name'}
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {isRtl ? 'المسمى الوظيفي أو التخصص' : 'Role or Tagline'}
                      </label>
                      <input
                        type="text"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {isRtl ? 'النبذة التعريفية' : 'Bio description'}
                      </label>
                      <textarea
                        rows={2}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Add New Link Section */}
                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                    {isRtl ? 'إضافة رابط جديد أو خدمة' : 'Add New Link or Feature'}
                  </h4>

                  <form onSubmit={addLink} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                          {isRtl ? 'عنوان الرابط' : 'Link Title'}
                        </label>
                        <input
                          type="text"
                          placeholder={isRtl ? 'مثال: معرض أعمالي' : 'e.g. My Portfolio'}
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                          {isRtl ? 'الرابط URL' : 'Target URL'}
                        </label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={newUrl}
                          onChange={(e) => setNewUrl(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                          {isRtl ? 'الوصف الفرعي (اختياري)' : 'Subtitle (Optional)'}
                        </label>
                        <input
                          type="text"
                          placeholder={isRtl ? 'تفاصيل موجزة' : 'Short helper text'}
                          value={newSubtitle}
                          onChange={(e) => setNewSubtitle(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                          {isRtl ? 'نوع البطاقة' : 'Card Type'}
                        </label>
                        <select
                          value={newType}
                          onChange={(e) => setNewType(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="link">Regular Link</option>
                          <option value="booking">Calendar Booking</option>
                          <option value="shop">Product / Checkout</option>
                          <option value="gallery">Photo Gallery</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isRtl ? 'إضافة هذا الرابط' : 'Add to Mini-Site'}</span>
                    </button>
                  </form>

                  {/* Active Components & Links Reorderable List */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        {isRtl ? 'العناصر المضافة (اسحب للترتيب)' : 'Active Components (Drag to reorder)'}
                      </span>
                      {user && (
                        <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                          {syncStatus === 'saving' ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                              <span className="text-amber-600 font-semibold">{isRtl ? 'جاري الحفظ في Firestore...' : 'Saving to Firestore...'}</span>
                            </>
                          ) : syncStatus === 'error' ? (
                            <>
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              <span className="text-rose-600 font-semibold">{isRtl ? 'خطأ في الحفظ' : 'Error saving to Firestore'}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-semibold">{isRtl ? 'محفوظ تلقائياً في Firestore' : 'Auto-saved to Firestore'}</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <SortableBlockList
                      items={links}
                      onChange={handleReorderLinks}
                      onRemove={removeLink}
                      locale={locale}
                    />
                  </div>


                  {/* Tab 2 Navigation & Launch Button */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('design')}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      {isRtl ? '← العودة للقوالب' : '← Back to Templates'}
                    </button>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setActiveTab('social')}
                        className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{isRtl ? 'معاينة بطاقة المشاركة' : 'Social Preview'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleStartOrPublishSite}
                        className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'بدء ونشر الموقع الآن' : 'Start & Launch Site'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SOCIAL PREVIEW & OPENGRAPH GENERATOR */}
            {activeTab === 'social' && (
              <div className="space-y-6">
                <SocialPreviewGenerator
                  username={username}
                  displayName={displayName}
                  role={role}
                  bio={bio}
                  avatar={avatar}
                  linksCount={links.length}
                  locale={locale}
                />

                {/* Tab Navigation Controls */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('content')}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {isRtl ? '← العودة لتعديل الروابط' : '← Back to Links'}
                  </button>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setActiveTab('share')}
                      className="w-full sm:w-auto px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isRtl ? 'متابعة إلى النشر والمشاركة' : 'Continue to Publish'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PUBLISH & SHARE */}
            {activeTab === 'share' && (
              <div className="space-y-6 text-center sm:text-left rtl:sm:text-right">
                <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-3xl">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto sm:mx-0 mb-3 shadow-md">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-1">
                    {isRtl ? 'موقعك المصغر منشور ويعمل مباشرة!' : 'Your RALOA Mini-Site is Live!'}
                  </h3>
                  <p className="text-xs text-slate-600 max-w-md mb-4 leading-relaxed">
                    {isRtl
                      ? `تم حفظ ونشر جميع تعديلاتك على الرابط العالمي raloa.app/@${username}. يمكنك مشاركته فوراً في بايو انستغرام وتيك توك ولينكدإن.`
                      : `Your updates are published instantly to the global edge network at raloa.app/@${username}. Share your link anywhere.`}
                  </p>

                  {/* Share Link Box */}
                  <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex-1 px-3 py-1 text-xs font-mono text-slate-700 font-bold truncate">
                      https://raloa.app/@{username}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'نسخ الرابط' : 'Copy Link')}</span>
                    </button>
                  </div>
                </div>

                {/* Social OpenGraph Preview Quick-Jump Banner */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left rtl:text-right">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {isRtl ? 'معاينة بطاقة المشاركة الاجتماعية (OpenGraph)' : 'Social Share & OpenGraph Preview'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {isRtl
                          ? 'تحقق من كيفية ظهور بطاقة موقعك على تويتر، لينكدإن، ورسائل iMessage.'
                          : 'See exactly how your link appears on Twitter (X), LinkedIn, and messaging apps.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('social')}
                    className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-indigo-600 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-colors shrink-0 cursor-pointer text-center"
                  >
                    {isRtl ? 'تخصيص بطاقة المشاركة ←' : 'Open Social Preview →'}
                  </button>
                </div>

                {/* QR Code, Celebrate & Direct Actions */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <button
                    onClick={fireSiteLaunchConfetti}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>{isRtl ? 'احتفل بالنشر 🎉' : 'Celebrate Launch 🎉'}</span>
                  </button>

                  <button
                    onClick={() => setShowQr(!showQr)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex items-center gap-2"
                  >
                    <QrCode className="w-4 h-4 text-slate-600" />
                    <span>{showQr ? (isRtl ? 'إخفاء رمز QR' : 'Hide QR') : (isRtl ? 'عرض رمز QR' : 'View QR Code')}</span>
                  </button>

                  <a
                    href={`#live-demo`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleCopyLink();
                      alert(isRtl ? `تم نسخ الرابط raloa.app/@${username}` : `Link raloa.app/@${username} copied to clipboard!`);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-600" />
                    <span>{isRtl ? 'فتح في علامة تبويب جديدة' : 'Open in New Tab'}</span>
                  </a>
                </div>

                {showQr && (
                  <div className="p-6 bg-white border border-slate-200 rounded-2xl inline-flex flex-col items-center justify-center shadow-md animate-in fade-in">
                    {/* SVG Clean Vector QR Mockup */}
                    <div className="w-40 h-40 bg-slate-900 rounded-xl p-3 flex flex-col justify-between">
                      <div className="flex justify-between">
                        <div className="w-10 h-10 bg-white rounded-md p-1.5"><div className="w-full h-full bg-slate-900 rounded-xs" /></div>
                        <div className="w-10 h-10 bg-white rounded-md p-1.5"><div className="w-full h-full bg-slate-900 rounded-xs" /></div>
                      </div>
                      <div className="flex justify-center gap-1">
                        <div className="w-4 h-4 bg-white rounded-xs" />
                        <div className="w-4 h-4 bg-white rounded-xs" />
                        <div className="w-4 h-4 bg-white rounded-xs" />
                      </div>
                      <div className="flex justify-between">
                        <div className="w-10 h-10 bg-white rounded-md p-1.5"><div className="w-full h-full bg-slate-900 rounded-xs" /></div>
                        <div className="w-6 h-6 bg-white rounded-xs ml-auto" />
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 mt-2">
                      Scan to visit raloa.app/@{username}
                    </span>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right Column: Live Phone / Social Mockup Stage (lg:col-span-5) */}
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
          />

        </div>

        {/* Studio Modal Footer with Real-Time Sync Status Indicator & History Controls */}
        <footer className="h-14 px-4 sm:px-6 border-t border-slate-200 bg-white/95 backdrop-blur-xs flex items-center justify-between shrink-0 print:hidden text-xs">
          {/* Sync Status Feedback & History Actions */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hidden xs:inline">
              {isRtl ? 'حالة المزامنة:' : 'Sync Status:'}
            </span>
            <div
              className="sync-status-indicator inline-flex items-center gap-1.5"
              data-testid="sync-status"
              data-sync-status={syncStatus}
            >
              {syncStatus === 'saving' && (
                <div className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200/90 px-2.5 py-1 rounded-full text-xs font-semibold animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
                  <span className="sync-status-text">Saving...</span>
                  {isRtl && <span className="text-[10px] text-amber-600 font-normal"> (جاري الحفظ)</span>}
                </div>
              )}
              {syncStatus === 'saved' && (
                <div className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="sync-status-text">Changes saved</span>
                  {isRtl && <span className="text-[10px] text-emerald-600 font-normal"> (تم الحفظ)</span>}
                </div>
              )}
              {syncStatus === 'error' && (
                <div className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200/90 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="sync-status-text">Error</span>
                  {isRtl && <span className="text-[10px] text-rose-600 font-normal"> (خطأ في الحفظ)</span>}
                  <button
                    type="button"
                    onClick={() => persistSiteConfig(siteConfig)}
                    className="text-[11px] underline font-bold hover:text-rose-900 cursor-pointer ml-1 rtl:mr-1"
                  >
                    {isRtl ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                </div>
              )}
            </div>

            {/* Undo / Redo in Footer */}
            <div className="flex items-center gap-1 ltr:border-l rtl:border-r border-slate-200 ltr:pl-3 rtl:pr-3">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  canUndo
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer active:scale-95'
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                }`}
                title={isRtl ? 'تراجع عن التغيير (Ctrl+Z)' : 'Undo change (Ctrl+Z)'}
                data-testid="footer-undo-btn"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isRtl ? 'تراجع' : 'Undo'}</span>
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  canRedo
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer active:scale-95'
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                }`}
                title={isRtl ? 'إعادة التغيير (Ctrl+Y)' : 'Redo change (Ctrl+Y)'}
                data-testid="footer-redo-btn"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isRtl ? 'إعادة' : 'Redo'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Site link & Done action */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              <Globe className="w-3 h-3 text-slate-400" />
              <span>raloa.app/@{username}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              {isRtl ? 'إغلاق المحرر' : 'Close Studio'}
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
};
