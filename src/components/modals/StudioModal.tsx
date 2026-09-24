import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  X,
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
  ,LayoutTemplate
  ,Save
} from 'lucide-react';
import { PremiumMark } from '../brand/PremiumMark';
import { Locale, TemplateItem, MiniSiteUserConfig, BackgroundStyle } from '../../types';
import { templatesData } from '../../data/content';
import { PhoneMockup } from '../PhoneMockup';
import { RaloaMark } from '../brand/RaloaLogo';
import { fireSiteLaunchConfetti } from '../../utils/confetti';
import { SocialPreviewGenerator } from '../studio/SocialPreviewGenerator';
import { SortableBlockList, StudioBlockItem } from '../studio/SortableBlockList';
import { StudioTemplatePreview } from '../studio/StudioTemplatePreview';
import { useAuth } from '../../hooks/useAuth';
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

interface SavedUserTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  config: StudioSiteConfig;
}

const imageFileToDataUrl = (file: File, maxDimension = 1600): Promise<string> => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error('Only image files are supported.'));
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read the image.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('Could not decode the image.'));
    image.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Image processing is unavailable.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/webp', 0.84));
    };
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

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

  const handleAssetUpload = async (
    file: File | undefined,
    onSuccess: (dataUrl: string) => void,
    maxDimension = 1600
  ) => {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) {
        throw new Error(isRtl ? 'حجم الصورة يجب أن يكون أقل من 8 ميجابايت.' : 'Images must be smaller than 8 MB.');
      }
      const dataUrl = await imageFileToDataUrl(file, maxDimension);
      onSuccess(dataUrl);
      setValidationMessage('');
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : (isRtl ? 'تعذر رفع الصورة.' : 'Could not upload the image.'));
    }
  };

  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newThumbnail, setNewThumbnail] = useState('');
  const [newType, setNewType] = useState<'link' | 'gallery' | 'booking' | 'shop'>('link');

  const [activeTab, setActiveTab] = useState<'design' | 'content' | 'social' | 'share'>('design');
  const [previewMode, setPreviewMode] = useState<'phone' | 'social'>('phone');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<SavedUserTemplate[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [customDomainId, setCustomDomainId] = useState('');
  const [customDomainRecords, setCustomDomainRecords] = useState<Array<{ type: string; name: string; value: string }>>([]);
  const [customDomainStatus, setCustomDomainStatus] = useState('');
  const [isProvisioningDomain, setIsProvisioningDomain] = useState(false);

  const templateStorageKey = `raloa_custom_templates_${user?.uid || 'guest'}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(templateStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setSavedTemplates(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSavedTemplates([]);
    }
  }, [templateStorageKey]);

  const persistSavedTemplates = (nextTemplates: SavedUserTemplate[]) => {
    setSavedTemplates(nextTemplates);
    try {
      localStorage.setItem(templateStorageKey, JSON.stringify(nextTemplates));
    } catch {
      setValidationMessage(isRtl ? 'تعذر حفظ القالب على هذا الجهاز.' : 'Could not save the template on this device.');
    }
  };

  const handleSaveAsTemplate = () => {
    const cleanName = templateName.trim();
    if (!cleanName) {
      setValidationMessage(isRtl ? 'أدخل اسماً للقالب أولاً.' : 'Give your template a name first.');
      return;
    }

    const now = new Date().toISOString();
    const savedTemplate: SavedUserTemplate = {
      id: `custom-template-${Date.now()}`,
      name: cleanName,
      createdAt: now,
      updatedAt: now,
      config: {
        ...JSON.parse(JSON.stringify(siteConfig)),
        isPublished: false
      }
    };
    persistSavedTemplates([savedTemplate, ...savedTemplates]);
    setTemplateName('');
    setShowTemplateDialog(false);
    setValidationMessage('');
  };

  const handleApplySavedTemplate = (savedTemplate: SavedUserTemplate) => {
    resetHistory({
      ...JSON.parse(JSON.stringify(savedTemplate.config)),
      isPublished: false
    });
    setValidationMessage('');
    setActiveTab('design');
  };

  const handleDeleteSavedTemplate = (templateId: string) => {
    persistSavedTemplates(savedTemplates.filter((template) => template.id !== templateId));
  };

  const isValidMediaUrl = (value: string) => {
    if (!value.trim()) return true;
    if (value.startsWith('data:image/')) return true;
    try {
      const url = new URL(value.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const isValidLinkUrl = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.startsWith('#')) return trimmed.length > 1;
    if (trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) return true;
    try {
      const url = new URL(trimmed);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

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
    if (!username.trim() || username.trim().length < 3) {
      setValidationMessage(isRtl ? 'أدخل اسماً مميزاً لا يقل عن ٣ أحرف.' : 'Enter a unique handle with at least 3 characters.');
      setActiveTab('design');
      return;
    }
    if (!displayName.trim()) {
      setValidationMessage(isRtl ? 'أدخل الاسم الظاهر قبل النشر.' : 'Add a display name before publishing.');
      setActiveTab('content');
      return;
    }
    if (!isValidMediaUrl(avatar) || !isValidMediaUrl(coverImage)) {
      setValidationMessage(isRtl ? 'تحقق من روابط الصور قبل النشر.' : 'Check the avatar and cover image URLs before publishing.');
      setActiveTab('design');
      return;
    }
    setValidationMessage('');
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
    if (!newTitle.trim() || !newUrl.trim()) {
      setValidationMessage(isRtl ? 'أدخل عنوان الرابط والرابط نفسه.' : 'Add both a link title and URL.');
      return;
    }
    if (!isValidLinkUrl(newUrl)) {
      setValidationMessage(isRtl ? 'أدخل رابطاً صالحاً يبدأ بـ https:// أو رابطاً داخلياً مثل #portfolio.' : 'Enter a valid https:// URL or an internal link such as #portfolio.');
      return;
    }
    setValidationMessage('');

    const newLinkItem: StudioBlockItem = {
      id: `link-${Date.now()}`,
      title: newTitle.trim(),
      url: newUrl.trim(),
      subtitle: newSubtitle.trim(),
      type: newType,
      thumbnail: newThumbnail || undefined
    };
    const updatedLinks = [...links, newLinkItem];
    updateSiteConfig({ links: updatedLinks });
    setNewTitle('');
    setNewUrl('');
    setNewSubtitle('');
    setNewThumbnail('');

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

  const publicUrl = `https://raloa.app/@${username}`;

  useEffect(() => {
    if (!showQr || !username.trim()) {
      setQrCodeDataUrl('');
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: { dark: '#0f172a', light: '#ffffff' }
    }).then((dataUrl) => {
      if (!cancelled) setQrCodeDataUrl(dataUrl);
    }).catch(() => {
      if (!cancelled) setQrCodeDataUrl('');
    });

    return () => {
      cancelled = true;
    };
  }, [publicUrl, showQr]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setValidationMessage(isRtl ? 'تعذر نسخ الرابط.' : 'Could not copy the link.');
    }
  };

  const handleOpenPublicSite = () => {
    window.open(publicUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCustomDomain = async () => {
    if (!customDomain.trim()) return;
    setIsProvisioningDomain(true);
    setCustomDomainStatus('');
    try {
      const token = user ? await user.getIdToken() : '';
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      const provision = await fetch('/api/domains/provision', {
        method: 'POST',
        headers,
        body: JSON.stringify({ hostname: customDomain, siteId: username })
      });
      const provisionPayload = await provision.json();
      if (!provision.ok) throw new Error(provisionPayload.error || 'Could not provision domain');
      const domain = provisionPayload.domain;
      setCustomDomainId(domain.domainId);
      setCustomDomainRecords(provisionPayload.dnsRecords || domain.dnsRecords || []);

      const verify = await fetch('/api/domains/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ domainId: domain.domainId })
      });
      const verifyPayload = await verify.json();
      if (!verify.ok) throw new Error(verifyPayload.error || 'Could not verify domain');
      setCustomDomainStatus(verifyPayload.domain.verificationStatus === 'verified' ? 'active' : 'pending');
    } catch (error) {
      setCustomDomainStatus(error instanceof Error ? error.message : 'Could not connect domain');
    } finally {
      setIsProvisioningDomain(false);
    }
  };

  const handlePreviewAction = useCallback((_: 'portfolio' | 'booking' | 'shop' | 'gear', data?: { url?: string }) => {
    const target = data?.url?.trim();
    if (target && (target.startsWith('https://') || target.startsWith('http://') || target.startsWith('mailto:') || target.startsWith('tel:'))) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }
    setActiveTab('content');
  }, []);

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
    <main className="min-h-screen w-full bg-slate-100 text-slate-900 raloa-studio-page">
      <div className="relative min-h-screen w-full bg-white overflow-hidden flex flex-col raloa-studio-page-card">
        
        {/* Studio Top Navigation Bar */}
        <div className="sticky top-0 z-30 min-h-16 px-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0 print:border-b-2 print:border-slate-800">
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
              onClick={() => setShowTemplateDialog(true)}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-colors cursor-pointer"
              title={isRtl ? 'حفظ إعداداتك كقالب' : 'Save all current controls as a template'}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isRtl ? 'حفظ كقالب' : 'Save template'}</span>
            </button>

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
              <PremiumMark className="w-3.5 h-3.5 text-indigo-400" />
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
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-slate-50 print:bg-white print:block">
          
          {/* Left Column: Editor Controls (lg:col-span-7) */}
          <div className="lg:col-span-7 h-auto lg:h-full min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-white border-r border-slate-200 studio-editor-sidebar print:hidden">
            
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

            {validationMessage && (
              <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700" role="alert">
                {validationMessage}
              </p>
            )}

            {/* TAB 1: DESIGN & TEMPLATE SELECTION */}
            {activeTab === 'design' && (
              <div className="space-y-6">
                <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 shadow-2xs">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                        <LayoutTemplate className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {isRtl ? 'قوالبي الخاصة' : 'My templates'}
                        </h3>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                          {isRtl
                            ? 'احفظ كل إعدادات التصميم والمحتوى والروابط لإعادة استخدامها.'
                            : 'Save every design, content, link, and publishing setting for reuse.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTemplateDialog(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F172A] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isRtl ? 'إنشاء قالب' : 'Create template'}
                    </button>
                  </div>

                  {savedTemplates.length > 0 ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {savedTemplates.map((savedTemplate) => (
                        <div key={savedTemplate.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 p-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                            <LayoutTemplate className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-slate-900">{savedTemplate.name}</p>
                            <p className="text-[10px] text-slate-500">{isRtl ? 'قالب قابل للتعديل' : 'Fully editable preset'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplySavedTemplate(savedTemplate)}
                            className="rounded-lg bg-indigo-50 px-2 py-1.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                          >
                            {isRtl ? 'تطبيق' : 'Apply'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSavedTemplate(savedTemplate.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                            aria-label={isRtl ? `حذف ${savedTemplate.name}` : `Delete ${savedTemplate.name}`}
                            title={isRtl ? 'حذف القالب' : 'Delete template'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl border border-dashed border-indigo-200 bg-white/60 px-3 py-2 text-[11px] text-slate-500">
                      {isRtl ? 'لم تحفظ أي قوالب بعد. ابدأ من إعداداتك الحالية.' : 'No saved templates yet. Start with your current setup.'}
                    </p>
                  )}
                </section>

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

                  {/* Profile Avatar */}
                  <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                      {isRtl ? 'الصورة الشخصية' : 'Profile Avatar'}
                    </label>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <img
                        src={avatar || defaultTemplate.avatar}
                        alt={displayName || 'Profile avatar'}
                        onError={(event) => {
                          event.currentTarget.src = defaultTemplate.avatar;
                        }}
                        className="w-16 h-16 rounded-full object-cover border border-slate-300 bg-white shrink-0"
                      />
                      <input
                        type="url"
                        value={avatar}
                        onChange={(e) => setAvatar(e.target.value)}
                        placeholder={isRtl ? 'رابط الصورة https://...' : 'Avatar image URL https://...'}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-700"
                      />
                      <label className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        {isRtl ? 'رفع' : 'Upload'}
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => handleAssetUpload(e.target.files?.[0], setAvatar, 800)}
                        />
                      </label>
                    </div>
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
                            onError={(event) => {
                              event.currentTarget.src = defaultTemplate.coverImage;
                            }}
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
                          <label className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer">
                            <Upload className="h-3.5 w-3.5" />
                            {isRtl ? 'رفع صورة الغلاف' : 'Upload cover image'}
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => handleAssetUpload(e.target.files?.[0], setCoverImage, 1600)}
                            />
                          </label>
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
                            type="url"
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
                      <PremiumMark className="w-3.5 h-3.5" />
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

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        {isRtl ? 'صورة البطاقة (اختياري)' : 'Card image (Optional)'}
                      </label>
                      <div className="flex items-center gap-2">
                        {newThumbnail && (
                          <img src={newThumbnail} alt="" className="h-9 w-9 rounded-lg object-cover border border-slate-200" />
                        )}
                        <label className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer">
                          <Upload className="h-3.5 w-3.5" />
                          {newThumbnail ? (isRtl ? 'تغيير الصورة' : 'Change image') : (isRtl ? 'رفع صورة' : 'Upload image')}
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => handleAssetUpload(e.target.files?.[0], setNewThumbnail, 800)}
                          />
                        </label>
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
                              <span className="text-amber-600 font-semibold">{isRtl ? 'جاري الحفظ...' : 'Saving...'}</span>
                            </>
                          ) : syncStatus === 'error' ? (
                            <>
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              <span className="text-rose-600 font-semibold">{isRtl ? 'خطأ في الحفظ' : 'Error saving to Firestore'}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">{isRtl ? 'تم الحفظ تلقائياً' : 'Auto-saved'}</span>
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
                        <PremiumMark className="w-3.5 h-3.5" />
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

                <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs text-left rtl:text-right">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{isRtl ? 'ربط نطاقك الخاص' : 'Connect a custom domain'}</h4>
                      <p className="text-[11px] text-slate-500 mt-1">{isRtl ? 'متاح لمشتركي Pro وStudio مع SSL مُدار.' : 'Available on Pro and Studio with managed SSL.'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={customDomain}
                      onChange={(event) => {
                        setCustomDomain(event.target.value.toLowerCase().trim());
                        setCustomDomainStatus('');
                        setCustomDomainRecords([]);
                      }}
                      placeholder="www.yourdomain.com"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleCustomDomain}
                      disabled={isProvisioningDomain || !customDomain}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                    >
                      {isProvisioningDomain ? (isRtl ? 'جارٍ الربط...' : 'Connecting...') : (isRtl ? 'ربط النطاق' : 'Connect domain')}
                    </button>
                  </div>
                  {customDomainStatus && <p className="mt-3 text-xs font-semibold text-indigo-700">{customDomainStatus}</p>}
                  {customDomainRecords.length > 0 && (
                    <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1">
                      <p className="text-[11px] font-bold text-slate-700">{isRtl ? 'أضف سجلات DNS ثم أعد المحاولة:' : 'Add these DNS records, then try again:'}</p>
                      {customDomainRecords.map((record) => (
                        <p key={`${record.type}-${record.name}`} className="text-[10px] font-mono text-slate-600 break-all">{record.type} {record.name} → {record.value}</p>
                      ))}
                    </div>
                  )}
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
                    <PremiumMark variant="launch" className="w-4 h-4 text-amber-300" />
                    <span>{isRtl ? 'احتفل بالنشر' : 'Celebrate Launch'}</span>
                  </button>

                  <button
                    onClick={() => setShowQr(!showQr)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex items-center gap-2"
                  >
                    <QrCode className="w-4 h-4 text-slate-600" />
                    <span>{showQr ? (isRtl ? 'إخفاء رمز QR' : 'Hide QR') : (isRtl ? 'عرض رمز QR' : 'View QR Code')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenPublicSite}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-600" />
                    <span>{isRtl ? 'فتح في علامة تبويب جديدة' : 'Open in New Tab'}</span>
                  </button>
                </div>

                {showQr && (
                  <div className="p-6 bg-white border border-slate-200 rounded-2xl inline-flex flex-col items-center justify-center shadow-md animate-in fade-in">
                    {qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt={isRtl ? 'رمز QR لموقعك' : 'QR code for your site'} className="w-40 h-40" />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center text-center text-xs text-slate-500">
                        {isRtl ? 'جارٍ إنشاء رمز QR...' : 'Generating QR code...'}
                      </div>
                    )}
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
            onOpenPhoneAction={handlePreviewAction}
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

        {showTemplateDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="save-template-title">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="save-template-title" className="text-base font-extrabold text-slate-900">
                    {isRtl ? 'حفظ قالب مخصص' : 'Save custom template'}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {isRtl
                      ? 'سيتم حفظ كل ما عدلته: المظهر، الألوان، البطاقات، المحتوى، الروابط وإعدادات الصفحة.'
                      : 'This captures everything you edited: style, colors, cards, content, links, and page settings.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTemplateDialog(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                  aria-label={isRtl ? 'إغلاق' : 'Close'}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <label className="mt-5 block text-xs font-bold text-slate-700">
                {isRtl ? 'اسم القالب' : 'Template name'}
                <input
                  autoFocus
                  type="text"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSaveAsTemplate();
                  }}
                  placeholder={isRtl ? 'مثال: معرض أعمالي' : 'e.g. My portfolio layout'}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </label>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateDialog(false)}
                  className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsTemplate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isRtl ? 'حفظ القالب' : 'Save template'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
};
