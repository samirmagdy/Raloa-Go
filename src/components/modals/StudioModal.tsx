import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import {
  Layers,
  Palette,
  Users,
  BarChart3,
  Settings,
  Lock,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Locale, TemplateItem, BackgroundStyle, BookingConfig, ProfileSocialLink, UserMiniSite, UserMiniSiteSummary } from '../../types';
import { DEFAULT_DESIGN_TOKENS, DesignTokens, normalizeDesignTokens } from '../../utils/designTokens';
import { templatesData } from '../../data/content';
import { useAuth } from '../../hooks/useAuth';
import { useHistoryState } from '../../hooks/useHistoryState';
import { PremiumMark } from '../brand/PremiumMark';

// Modular Studio Subcomponents
import { StudioTopToolbar } from '../studio/StudioTopToolbar';
import type { PublicationState } from '../studio/StudioTopToolbar';
import { StudioContentTab } from '../studio/StudioContentTab';
import { StudioDesignTab, VISUAL_PRESETS } from '../studio/StudioDesignTab';
import { StudioAudienceTab } from '../studio/StudioAudienceTab';
import { StudioSettingsTab } from '../studio/StudioSettingsTab';
import { StudioMobileNav, StudioTab } from '../studio/StudioMobileNav';
import { StudioQrModal } from '../studio/StudioQrModal';
import { DEFAULT_BOOKING_CONFIG } from '../studio/StudioSchedulingSettings';
import { StudioTemplatePreview } from '../studio/StudioTemplatePreview';
import { StudioBlockItem } from '../studio/SortableBlockList';
import { getPlanCapabilities, isPremiumTemplate } from '../../lib/planCapabilities';
import { auth, hasAuthenticatedSession } from '../../lib/firebase';
import { normalizeSiteSlug } from '../../lib/siteSlug';
import { normalizeSiteContent, validateSiteContent } from '../../lib/contentSchema';

const StudioAnalyticsTab = lazy(() => import('../studio/StudioAnalyticsTab').then((module) => ({ default: module.StudioAnalyticsTab })));

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
  socials: ProfileSocialLink[];
  isPublished: boolean;

  // Visual Design & Geometry Tokens
  accentColor?: string;
  surfaceColor?: string;
  cardRadius?: 'sharp' | 'subtle' | 'rounded' | 'pill';
  cardShadow?: 'none' | 'subtle' | 'soft' | 'hard';
  borderStyle?: 'none' | 'thin' | 'bold' | 'dashed';
  designTokens: DesignTokens;

  // Site Settings, SEO & Integrations
  customDomain?: string;
  metaTitle?: string;
  metaDescription?: string;
  hidePoweredBy?: boolean;
  sensitiveWarning?: boolean;
  ga4Id?: string;
  metaPixelId?: string;
  webhookUrl?: string;
  bookingConfig?: BookingConfig;
}

export interface StudioModalProps {
  initialUsername?: string;
  initialTemplate?: TemplateItem;
  locale: Locale;
  onClose: () => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onOpenPricing?: () => void;
  onManageBilling?: () => void;
  onOpenAccountSettings?: () => void;
}

function studioConfigFromSite(savedSite: UserMiniSite, fallback: TemplateItem, resolvedHandle: string, isRtl: boolean): StudioSiteConfig {
  const canonical = normalizeSiteContent({
    ...savedSite,
    username: savedSite.username ?? resolvedHandle,
    templateId: savedSite.templateId ?? fallback.id,
    displayName: savedSite.displayName ?? fallback.name,
    role: savedSite.role ?? fallback.role,
    bio: savedSite.bio !== undefined ? savedSite.bio : (isRtl ? fallback.bioAr : fallback.bio),
    // Preserve persisted empty values. A published page consumes the
    // canonical site as-is; Studio must not silently substitute template
    // media and create preview/public drift.
    avatar: savedSite.avatar ?? fallback.avatar,
    coverImage: savedSite.coverImage ?? fallback.coverImage,
    links: Array.isArray(savedSite.links) ? savedSite.links : fallback.sampleLinks.map((link) => ({ id: link.id, title: isRtl ? link.titleAr : link.title, url: link.url, subtitle: (isRtl ? link.subtitleAr : link.subtitle) || '', type: link.type || 'link' })),
    socials: Array.isArray((savedSite as any).socials) ? (savedSite as any).socials : fallback.socials.map((social) => ({ ...social, enabled: true })),
    designTokens: savedSite.designTokens || DEFAULT_DESIGN_TOKENS,
    bookingConfig: savedSite.bookingConfig || DEFAULT_BOOKING_CONFIG
  });
  return {
    username: canonical.username,
    templateId: canonical.templateId,
    displayName: canonical.displayName,
    role: canonical.role,
    bio: canonical.bio,
    avatar: canonical.avatar,
    coverImage: canonical.coverImage,
    bgStyle: canonical.bgStyle,
    themeMode: canonical.themeMode,
    links: canonical.links as StudioBlockItem[],
    socials: canonical.socials,
    isPublished: canonical.isPublished,
    accentColor: canonical.designTokens.accentColor,
    surfaceColor: canonical.designTokens.surfaceColor,
    cardRadius: canonical.designTokens.cardRadius,
    cardShadow: canonical.designTokens.cardShadow,
    borderStyle: canonical.designTokens.borderStyle,
    designTokens: canonical.designTokens,
    customDomain: canonical.customDomain,
    metaTitle: canonical.metaTitle,
    metaDescription: canonical.metaDescription,
    hidePoweredBy: canonical.hidePoweredBy,
    sensitiveWarning: canonical.sensitiveWarning,
    ga4Id: canonical.ga4Id,
    metaPixelId: canonical.metaPixelId,
    webhookUrl: canonical.webhookUrl,
    bookingConfig: canonical.bookingConfig
  };
}

function normalizeStudioConfig(config: StudioSiteConfig): StudioSiteConfig {
  const canonical = normalizeSiteContent(config);
  return {
    ...config,
    ...canonical,
    links: canonical.links as StudioBlockItem[],
    accentColor: canonical.designTokens.accentColor,
    surfaceColor: canonical.designTokens.surfaceColor,
    cardRadius: canonical.designTokens.cardRadius,
    cardShadow: canonical.designTokens.cardShadow,
    borderStyle: canonical.designTokens.borderStyle
  };
}

type LocalRecoveryEnvelope = { version: 1; siteId: string; updatedAt: string; config: StudioSiteConfig };
type SaveError = Error & { code?: string; status?: number; serverSite?: UserMiniSite };

const MAX_SAVE_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1000, 2000];

const waitForRetry = (delay: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, delay));

function isRetryableSaveError(error: unknown): boolean {
  const typed = error as SaveError;
  if (typed?.code === 'SITE_VERSION_CONFLICT' || typed?.code === 'AUTH_REQUIRED' || typed?.code === 'SITE_ID_REQUIRED') return false;
  if (typed?.code && !['SITE_SAVE_FAILED', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR', 'OFFLINE'].includes(typed.code)) return false;
  return typed?.code === 'OFFLINE' || typed?.code === 'NETWORK_ERROR' || typed?.status === 408 || typed?.status === 429 || Boolean(typed?.status && typed.status >= 500) || !typed?.code;
}

const configFingerprint = (config: StudioSiteConfig): string => JSON.stringify(config);
const localRecoveryKey = (userId: string, siteId: string): string => `raloa_studio_recovery_${userId}_${siteId}`;

function readLocalRecovery(userId: string, siteId: string): LocalRecoveryEnvelope | null {
  if (typeof window === 'undefined' || !userId || !siteId) return null;
  try {
    const raw = window.localStorage.getItem(localRecoveryKey(userId, siteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalRecoveryEnvelope;
    if (parsed?.version !== 1 || parsed.siteId !== siteId || !parsed.config || typeof parsed.config !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function writeLocalRecovery(userId: string, siteId: string, config: StudioSiteConfig): void {
  if (typeof window === 'undefined' || !userId || !siteId) return;
  try {
    window.localStorage.setItem(localRecoveryKey(userId, siteId), JSON.stringify({ version: 1, siteId, updatedAt: new Date().toISOString(), config } satisfies LocalRecoveryEnvelope));
  } catch (_) {}
}

function clearLocalRecovery(userId: string, siteId: string): void {
  if (typeof window === 'undefined' || !userId || !siteId) return;
  try { window.localStorage.removeItem(localRecoveryKey(userId, siteId)); } catch (_) {}
}

export const StudioModal: React.FC<StudioModalProps> = ({
  initialUsername = 'creator',
  initialTemplate,
  locale,
  onClose,
  onOpenAuth,
  onOpenPricing,
  onManageBilling,
  onOpenAccountSettings
}) => {
  const { user, profile, loading: authLoading, saveMiniSite, loadMiniSite, listMiniSites, createMiniSite, deleteMiniSite } = useAuth();
  const isRtl = locale === 'ar';
  const capabilities = getPlanCapabilities(profile);
  const defaultTemplate = initialTemplate && (!isPremiumTemplate(initialTemplate.id) || capabilities.premiumTemplates)
    ? initialTemplate
    : templatesData.find((template) => !isPremiumTemplate(template.id)) || templatesData[0];

  // Active top-level Tab State
  const [activeTab, setActiveTab] = useState<StudioTab>('content');

  // Mobile view toggle (Editor pane vs Live Phone canvas)
  const [mobileViewMode, setMobileViewMode] = useState<'editor' | 'preview'>('editor');

  // Preview Mode for Phone Mockup ('phone' | 'social')
  const [previewMode, setPreviewMode] = useState<'phone' | 'social'>('phone');

  // Secondary Modals
  const [showQrModal, setShowQrModal] = useState(false);

  // Persistence status is intentionally separate from publication status.
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | 'recovery'>('saving');
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [recoveryConfig, setRecoveryConfig] = useState<StudioSiteConfig | null>(null);
  const [conflictServerConfig, setConflictServerConfig] = useState<StudioSiteConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [publicationState, setPublicationState] = useState<PublicationState>('draft');
  const [entitlementMessage, setEntitlementMessage] = useState('');
  const [sites, setSites] = useState<UserMiniSiteSummary[]>([]);
  const [activeSiteId, setActiveSiteId] = useState('');

  const isInitialLoadDone = useRef(false);
  const lastTextEditRef = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skipNextAutosaveRef = useRef(false);
  const authoritativeBaselineRef = useRef('');
  const authoritativeRevisionRef = useRef<number | null>(null);
  const conflictRevisionRef = useRef<number | null>(null);
  const saveAttemptRef = useRef(0);

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
    socials: defaultTemplate.socials.map((social) => ({ ...social, enabled: true })),
    isPublished: false,
    accentColor: '#4F46E5',
    surfaceColor: '#FFFFFF',
    cardRadius: 'rounded',
    cardShadow: 'subtle',
    borderStyle: 'thin',
    designTokens: normalizeDesignTokens({ ...DEFAULT_DESIGN_TOKENS, background: { ...DEFAULT_DESIGN_TOKENS.background, style: defaultTemplate.backgroundStyle || 'signature', coverImage: defaultTemplate.coverImage } }),
    customDomain: '',
    metaTitle: '',
    metaDescription: '',
    hidePoweredBy: false,
    sensitiveWarning: false,
    ga4Id: '',
    metaPixelId: '',
    webhookUrl: '',
    bookingConfig: DEFAULT_BOOKING_CONFIG
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
    designTokens = DEFAULT_DESIGN_TOKENS,
    customDomain = '',
    metaTitle = '',
    metaDescription = '',
    hidePoweredBy = false,
    sensitiveWarning = false,
    ga4Id = '',
    metaPixelId = '',
    webhookUrl = '',
    bookingConfig = DEFAULT_BOOKING_CONFIG
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
        return normalizeStudioConfig(next);
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
      setSiteConfig((prev) => normalizeStudioConfig({ ...prev, [field]: value }), {
        overwrite: shouldOverwrite
      });
    },
    [setSiteConfig]
  );

  // Load existing user mini-site from Firestore when authenticated
  useEffect(() => {
    if (!user) {
      isInitialLoadDone.current = true;
      setSaveStatus('recovery');
      return;
    }
    let isCancelled = false;
    const userId = user.uid;

    async function loadData() {
      try {
        let availableSites = await listMiniSites();
        let selectedSiteId = typeof window !== 'undefined' ? localStorage.getItem(`raloa_active_site_${userId}`) || '' : '';
        if (!availableSites.some((site) => site.id === selectedSiteId)) selectedSiteId = availableSites[0]?.id || '';
        if (!selectedSiteId) {
          const created = await createMiniSite({
            username: resolvedHandle,
            templateId: defaultTemplate.id,
            displayName: defaultTemplate.name,
            role: defaultTemplate.role,
            bio: isRtl ? defaultTemplate.bioAr : defaultTemplate.bio,
            avatar: defaultTemplate.avatar,
            coverImage: defaultTemplate.coverImage,
            bgStyle: defaultTemplate.backgroundStyle || 'signature',
            themeMode: 'auto',
            links: defaultTemplate.sampleLinks.map((link) => ({ id: link.id, title: isRtl ? link.titleAr : link.title, url: link.url, subtitle: (isRtl ? link.subtitleAr : link.subtitle) || '', type: link.type || 'link' })),
            socials: defaultTemplate.socials.map((social) => ({ ...social, enabled: true })),
            isPublished: false,
            designTokens: normalizeDesignTokens({ ...DEFAULT_DESIGN_TOKENS, background: { ...DEFAULT_DESIGN_TOKENS.background, style: defaultTemplate.backgroundStyle || 'signature', coverImage: defaultTemplate.coverImage } })
          });
          selectedSiteId = String(created.id);
          availableSites = await listMiniSites();
        }
        if (!selectedSiteId) throw new Error('NO_SITE_SELECTED');
        setSites(availableSites);
        setActiveSiteId(selectedSiteId);
        try { localStorage.setItem(`raloa_active_site_${userId}`, selectedSiteId); } catch (_) {}
        const savedSite = await loadMiniSite(selectedSiteId);
        let loadedRecoveryAvailable = false;
        if (savedSite && !isCancelled) {
          const loadedConfig = studioConfigFromSite(savedSite, defaultTemplate, resolvedHandle, isRtl);
          authoritativeBaselineRef.current = configFingerprint(loadedConfig);
          authoritativeRevisionRef.current = typeof savedSite.revision === 'number' ? savedSite.revision : 0;
          setIsDirty(false);
          resetHistory(loadedConfig);
          const recovery = readLocalRecovery(userId, selectedSiteId);
          if (recovery && configFingerprint(recovery.config) !== authoritativeBaselineRef.current) {
            setRecoveryConfig(recovery.config);
            setRecoveryAvailable(true);
            loadedRecoveryAvailable = true;
          } else {
            clearLocalRecovery(userId, selectedSiteId);
            setRecoveryConfig(null);
            setRecoveryAvailable(false);
          }
        }
        if (!isCancelled) {
          setSaveStatus(hasAuthenticatedSession() ? (loadedRecoveryAvailable ? 'recovery' : 'saved') : 'recovery');
          setPublicationState(savedSite?.isPublished === true ? 'published' : 'draft');
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
  }, [user, resolvedHandle, listMiniSites, createMiniSite, loadMiniSite]);

  // Persist directly to live content in Firestore (Autosave directly to live content)
  const persistSiteConfig = useCallback(
    async (configToSave: StudioSiteConfig = siteConfig) => {
      const saveAttempt = saveAttemptRef.current + 1;
      saveAttemptRef.current = saveAttempt;
      const saveStartedAt = Date.now();
      setSaveStatus('saving');

      try {
        configToSave = normalizeStudioConfig(configToSave);
        const schema = validateSiteContent(configToSave);
        if (!schema.valid) throw new Error(`INVALID_SITE_CONTENT:${schema.issues[0]?.path || 'content'}`);
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const offlineError = new Error('You are offline. Changes are stored for recovery and will not be marked saved.') as SaveError;
          offlineError.code = 'OFFLINE';
          throw offlineError;
        }

        let persistedSite: UserMiniSite | void = undefined;
        if (user) {
          const payload = {
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
            socials: configToSave.socials.filter((social) => social.url.trim()),
            isPublished: configToSave.isPublished,
            ...(authoritativeRevisionRef.current !== null ? { expectedRevision: authoritativeRevisionRef.current } : {}),
            ...({
              designTokens: configToSave.designTokens,
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
              webhookUrl: configToSave.webhookUrl,
              bookingConfig: configToSave.bookingConfig
            } as any)
          };
          for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt += 1) {
            if (saveAttempt !== saveAttemptRef.current) return;
            try {
              persistedSite = await saveMiniSite(payload, activeSiteId);
              break;
            } catch (error) {
              const typed = error as SaveError;
              if (typed.code === 'SITE_VERSION_CONFLICT' || !isRetryableSaveError(error) || attempt === MAX_SAVE_RETRIES) throw error;
              await waitForRetry(RETRY_DELAYS_MS[attempt]);
              if (saveAttempt !== saveAttemptRef.current) return;
            }
          }
        } else {
          const authError = new Error('AUTH_REQUIRED') as SaveError;
          authError.code = 'AUTH_REQUIRED';
          throw authError;
        }

        const serverPersisted = Boolean(user && hasAuthenticatedSession());
        if (user) {
          try {
            setSites(await listMiniSites());
          } catch (siteListError) {
            console.warn('Site list refresh failed after a confirmed save:', siteListError);
          }
        }
        if (serverPersisted && user) {
          if (saveAttempt !== saveAttemptRef.current) return;
          if (persistedSite && typeof persistedSite.revision === 'number') authoritativeRevisionRef.current = persistedSite.revision;
          // This baseline is authoritative only after saveMiniSite resolved.
          authoritativeBaselineRef.current = configFingerprint(configToSave);
          setIsDirty(false);
          setConflictServerConfig(null);
          const recovery = readLocalRecovery(user.uid, activeSiteId);
          if (!recovery || configFingerprint(recovery.config) === configFingerprint(configToSave) || Date.parse(recovery.updatedAt) <= saveStartedAt) {
            clearLocalRecovery(user.uid, activeSiteId);
            setRecoveryConfig(null);
            setRecoveryAvailable(false);
          }
          setSaveStatus('saved');
        } else {
          if (saveAttempt !== saveAttemptRef.current) return;
          setSaveStatus('recovery');
        }
      } catch (err) {
        if (saveAttempt !== saveAttemptRef.current) throw err;
        console.error('Failed to autosave live site configuration:', err);
        if (user) {
          writeLocalRecovery(user.uid, activeSiteId, configToSave);
          setRecoveryConfig(configToSave);
          setRecoveryAvailable(true);
        }
        if ((err as SaveError)?.code === 'SITE_VERSION_CONFLICT' && (err as SaveError).serverSite) {
          const serverSite = (err as SaveError).serverSite as UserMiniSite;
          conflictRevisionRef.current = typeof serverSite.revision === 'number' ? serverSite.revision : 0;
          setConflictServerConfig(studioConfigFromSite(serverSite, defaultTemplate, resolvedHandle, isRtl));
        }
        setIsDirty(true);
        setSaveStatus('error');
        setEntitlementMessage(err instanceof Error ? err.message : 'This change is not included in your current plan.');
        throw err;
      }
    },
    [defaultTemplate, isRtl, user, saveMiniSite, siteConfig, activeSiteId, listMiniSites, resolvedHandle]
  );

  const switchSite = useCallback(async (nextSiteId: string) => {
    if (!nextSiteId || nextSiteId === activeSiteId) return;
    try {
      await persistSiteConfig(siteConfig);
      const savedSite = await loadMiniSite(nextSiteId);
      const summary = sites.find((site) => site.id === nextSiteId);
      if (!savedSite || !summary) throw new Error('SITE_NOT_FOUND');
      const loadedConfig = studioConfigFromSite(savedSite, defaultTemplate, resolvedHandle, isRtl);
      authoritativeBaselineRef.current = configFingerprint(loadedConfig);
      authoritativeRevisionRef.current = typeof savedSite.revision === 'number' ? savedSite.revision : 0;
      setIsDirty(false);
      resetHistory(loadedConfig);
      setActiveSiteId(nextSiteId);
      const recovery = readLocalRecovery(user?.uid || '', nextSiteId);
      if (recovery && configFingerprint(recovery.config) !== authoritativeBaselineRef.current) {
        setRecoveryConfig(recovery.config);
        setRecoveryAvailable(true);
      } else {
        clearLocalRecovery(user?.uid || '', nextSiteId);
        setRecoveryConfig(null);
        setRecoveryAvailable(false);
      }
      setPublicationState(savedSite.isPublished === true ? 'published' : 'draft');
      try { localStorage.setItem(`raloa_active_site_${user?.uid}`, nextSiteId); } catch (_) {}
      setEntitlementMessage('');
    } catch (error) {
      setSaveStatus('error');
      setEntitlementMessage(error instanceof Error ? error.message : 'Could not switch sites.');
    }
  }, [activeSiteId, defaultTemplate, isRtl, loadMiniSite, persistSiteConfig, resetHistory, resolvedHandle, siteConfig, sites, user?.uid]);

  const createNewSite = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const requestedHandle = window.prompt(isRtl ? 'أدخل معرف الموقع الجديد' : 'Enter the new site handle');
    const nextHandle = normalizeSiteSlug(requestedHandle);
    if (!nextHandle) return;
    const displayName = window.prompt(isRtl ? 'اسم الموقع' : 'Site display name', nextHandle) || nextHandle;
    try {
      const created = await createMiniSite({ ...siteConfig, username: nextHandle, displayName, isPublished: false });
      const nextSites = await listMiniSites();
      setSites(nextSites);
      await switchSite(String(created.id));
    } catch (error) {
      setEntitlementMessage(error instanceof Error ? error.message : 'Could not create the site.');
    }
  }, [createMiniSite, isRtl, listMiniSites, siteConfig, switchSite]);

  const deleteCurrentSite = useCallback(async () => {
    if (!activeSiteId || sites.length <= 1 || typeof window === 'undefined') return;
    if (!window.confirm(isRtl ? 'هل تريد حذف الموقع الحالي؟' : 'Delete the current site?')) return;
    try {
      await deleteMiniSite(activeSiteId);
      const nextSites = await listMiniSites();
      setSites(nextSites);
      const nextSite = nextSites[0];
      if (!nextSite) throw new Error('NO_SITE_REMAINS');
      const savedSite = await loadMiniSite(nextSite.id);
      if (!savedSite) throw new Error('SITE_NOT_FOUND');
      const loadedConfig = studioConfigFromSite(savedSite, defaultTemplate, resolvedHandle, isRtl);
      authoritativeBaselineRef.current = configFingerprint(loadedConfig);
      authoritativeRevisionRef.current = typeof savedSite.revision === 'number' ? savedSite.revision : 0;
      setIsDirty(false);
      resetHistory(loadedConfig);
      setActiveSiteId(nextSite.id);
      const recovery = readLocalRecovery(user?.uid || '', nextSite.id);
      if (recovery && configFingerprint(recovery.config) !== authoritativeBaselineRef.current) {
        setRecoveryConfig(recovery.config);
        setRecoveryAvailable(true);
      } else {
        clearLocalRecovery(user?.uid || '', nextSite.id);
        setRecoveryConfig(null);
        setRecoveryAvailable(false);
      }
      setPublicationState(savedSite.isPublished === true ? 'published' : 'draft');
      localStorage.setItem(`raloa_active_site_${user?.uid}`, nextSite.id);
    } catch (error) {
      setEntitlementMessage(error instanceof Error ? error.message : 'Could not delete the site.');
    }
  }, [activeSiteId, defaultTemplate, deleteMiniSite, isRtl, listMiniSites, loadMiniSite, resetHistory, resolvedHandle, sites.length, user?.uid]);

  const publishToggle = useCallback(async () => {
    if (publicationState === 'publishing' || publicationState === 'unpublishing') return;
    if (!hasAuthenticatedSession()) {
      setPublicationState('failed');
      setEntitlementMessage('A verified server session is required to publish this site.');
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const nextPublished = !siteConfig.isPublished;
    setPublicationState(nextPublished ? 'publishing' : 'unpublishing');
    try {
      const nextConfig = { ...siteConfig, isPublished: nextPublished };
      await persistSiteConfig(nextConfig);
      skipNextAutosaveRef.current = true;
      setSiteConfig(nextConfig, { overwrite: true });
      setPublicationState(nextPublished ? 'published' : 'draft');
      setEntitlementMessage('');
    } catch (error) {
      setPublicationState('failed');
      setEntitlementMessage(error instanceof Error ? error.message : 'Publishing failed. Please try again.');
    }
  }, [publicationState, persistSiteConfig, setSiteConfig, siteConfig]);

  // Debounced Autosave (700ms debounce)
  useEffect(() => {
    if (!isInitialLoadDone.current) return;

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');

    saveTimeoutRef.current = setTimeout(() => {
      void persistSiteConfig(siteConfig).catch(() => undefined);
    }, 700);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [siteConfig, persistSiteConfig]);

  // Keep an explicitly labelled recovery copy only while the editor differs
  // from the last server-confirmed baseline. This copy is never loaded
  // automatically and is removed only after a confirmed server save.
  useEffect(() => {
    if (!isInitialLoadDone.current || !activeSiteId || !user?.uid) return;
    const currentFingerprint = configFingerprint(siteConfig);
    if (authoritativeBaselineRef.current && currentFingerprint === authoritativeBaselineRef.current) {
      setIsDirty(false);
      const recovery = readLocalRecovery(user.uid, activeSiteId);
      if (recovery && configFingerprint(recovery.config) !== authoritativeBaselineRef.current) return;
      clearLocalRecovery(user.uid, activeSiteId);
      return;
    }
    setIsDirty(true);
    writeLocalRecovery(user.uid, activeSiteId, siteConfig);
  }, [activeSiteId, siteConfig, user?.uid]);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      if (isDirty && isInitialLoadDone.current) {
        void persistSiteConfig(siteConfig).catch(() => undefined);
      }
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [isDirty, persistSiteConfig, siteConfig]);

  const restoreLocalRecovery = useCallback(() => {
    if (!recoveryConfig) return;
    resetHistory(recoveryConfig);
    setIsDirty(true);
    setConflictServerConfig(null);
    setRecoveryConfig(null);
    setRecoveryAvailable(false);
    setSaveStatus('recovery');
    setEntitlementMessage('');
  }, [recoveryConfig, resetHistory]);

  const keepServerVersion = useCallback(() => {
    if (user?.uid && activeSiteId) clearLocalRecovery(user.uid, activeSiteId);
    setRecoveryConfig(null);
    setRecoveryAvailable(false);
    setIsDirty(false);
    setConflictServerConfig(null);
    setSaveStatus('saved');
  }, [activeSiteId, user?.uid]);

  const useServerConflictVersion = useCallback(() => {
    if (!conflictServerConfig) return;
    resetHistory(conflictServerConfig);
    authoritativeBaselineRef.current = configFingerprint(conflictServerConfig);
    authoritativeRevisionRef.current = conflictRevisionRef.current;
    conflictRevisionRef.current = null;
    setIsDirty(false);
    setConflictServerConfig(null);
    setRecoveryConfig(null);
    setRecoveryAvailable(false);
    if (user?.uid && activeSiteId) clearLocalRecovery(user.uid, activeSiteId);
    setSaveStatus('saved');
    setEntitlementMessage('');
  }, [activeSiteId, conflictServerConfig, resetHistory, user?.uid]);

  const keepLocalConflictVersion = useCallback(() => {
    setConflictServerConfig(null);
    setSaveStatus('recovery');
    setEntitlementMessage('Your local edits are preserved. Reload the server version before retrying if another editor owns the latest changes.');
  }, []);

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
  const canonicalPreview = normalizeSiteContent(siteConfig);
  const livePreviewTemplate: TemplateItem = {
    ...selectedTemplate,
    name: canonicalPreview.displayName,
    role: canonicalPreview.role,
    bio: canonicalPreview.bio,
    bioAr: canonicalPreview.bio,
    avatar: canonicalPreview.avatar,
    coverImage: canonicalPreview.coverImage,
    backgroundStyle: canonicalPreview.designTokens.background.style,
    designTokens: canonicalPreview.designTokens,
    sampleLinks: canonicalPreview.links.map((l) => ({
      id: l.id,
      title: l.title,
      titleAr: l.titleAr || l.title,
      subtitle: l.subtitle,
      subtitleAr: l.subtitleAr || l.subtitle,
      url: l.url,
      galleryItems: l.galleryItems,
      type: l.type as any
    })),
    socials: canonicalPreview.socials.filter((social) => social.enabled !== false && social.url.trim()) as TemplateItem['socials']
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
        isDirty={isDirty}
        isOffline={isOffline}
        publicationState={publicationState}
        isPublished={siteConfig.isPublished}
        onPublishToggle={publishToggle}
        onRetrySave={() => { void persistSiteConfig(siteConfig).catch(() => undefined); }}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onOpenQr={() => setShowQrModal(true)}
        onClose={onClose}
        locale={locale}
        sites={sites}
        activeSiteId={activeSiteId}
        onSiteSelect={(siteId) => { void switchSite(siteId); }}
        onCreateSite={() => { void createNewSite(); }}
        onDeleteSite={() => { void deleteCurrentSite(); }}
      />

      {recoveryAvailable && recoveryConfig && (
        <div role="alert" className="mx-3 mt-3 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100 sm:mx-6 sm:flex-row sm:items-center sm:justify-between lg:mx-8">
          <div>
            <p className="text-sm font-bold">{isRtl ? 'توجد نسخة استرداد محلية' : 'Local recovery is available'}</p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">{isRtl ? 'هذه التعديلات لم يؤكد الخادم حفظها. اختر الإجراء قبل استعادتها.' : 'These edits were not confirmed by the server. Choose what to do before restoring them.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={restoreLocalRecovery} className="min-h-11 rounded-xl bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600">{isRtl ? 'استعادة التعديلات' : 'Restore edits'}</button>
            <button type="button" onClick={keepServerVersion} className="min-h-11 rounded-xl border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-950/50">{isRtl ? 'الاحتفاظ بنسخة الخادم' : 'Keep server version'}</button>
          </div>
        </div>
      )}

      {conflictServerConfig && (
        <div role="alert" className="mx-3 mt-3 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 shadow-sm dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100 sm:mx-6 sm:flex-row sm:items-center sm:justify-between lg:mx-8">
          <div>
            <p className="text-sm font-bold">{isRtl ? 'تعارض في نسخة الموقع' : 'Site changed on the server'}</p>
            <p className="mt-1 text-xs text-rose-800 dark:text-rose-200">{isRtl ? 'لم نكتب فوق التعديلات الأحدث. اختر نسخة الخادم أو احتفظ بمسودتك المحلية.' : 'Your save was not allowed to overwrite newer server edits. Choose the server version or keep your local draft.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={useServerConflictVersion} className="min-h-11 rounded-xl bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600">{isRtl ? 'استخدام نسخة الخادم' : 'Use server version'}</button>
            <button type="button" onClick={keepLocalConflictVersion} className="min-h-11 rounded-xl border border-rose-300 px-3 py-2 text-xs font-bold text-rose-900 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 dark:border-rose-800 dark:text-rose-100 dark:hover:bg-rose-950/50">{isRtl ? 'الاحتفاظ بمسودتي' : 'Keep my draft'}</button>
          </div>
        </div>
      )}

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
            {entitlementMessage && (
              <div role="alert" className="mx-1 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {entitlementMessage}
                <button type="button" className="ml-2 underline" onClick={() => setEntitlementMessage('')}>Dismiss</button>
              </div>
            )}
            {activeTab === 'content' && (
              <StudioContentTab
                siteId={activeSiteId}
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
                allowedBlockTypes={capabilities.allowedBlockTypes}
                maxLinks={capabilities.maxLinks}
                onEntitlementError={setEntitlementMessage}
                locale={locale}
              />
            )}

            {activeTab === 'design' && (
              <StudioDesignTab
                siteId={activeSiteId}
                coverImage={coverImage}
                onCoverImageChange={(image) => updateSiteConfig((prev) => ({ ...prev, coverImage: image, designTokens: normalizeDesignTokens({ ...prev.designTokens, background: { ...prev.designTokens.background, coverImage: image } }) }))}
                templateId={templateId}
                onTemplateIdChange={(tId) => {
                  if (isPremiumTemplate(tId) && !capabilities.premiumTemplates) {
                    setEntitlementMessage('Premium templates require a Pro or Studio plan.');
                    return;
                  }
                  updateSiteConfig({ templateId: tId });
                }}
                bgStyle={bgStyle}
                onBgStyleChange={(style) => updateSiteConfig((prev) => ({ ...prev, bgStyle: style, designTokens: normalizeDesignTokens({ ...prev.designTokens, background: { ...prev.designTokens.background, style } }) }))}
                themeMode={themeMode}
                onThemeModeChange={(mode) => updateSiteConfig((prev) => ({ ...prev, themeMode: mode, designTokens: normalizeDesignTokens({ ...prev.designTokens, themeMode: mode }) }))}
                accentColor={accentColor}
                onAccentColorChange={(col) => updateSiteConfig((prev) => ({ ...prev, accentColor: col, designTokens: normalizeDesignTokens({ ...prev.designTokens, accentColor: col }) }))}
                surfaceColor={surfaceColor}
                onSurfaceColorChange={(surf) => updateSiteConfig((prev) => ({ ...prev, surfaceColor: surf, designTokens: normalizeDesignTokens({ ...prev.designTokens, surfaceColor: surf }) }))}
                cardRadius={cardRadius}
                onCardRadiusChange={(rad) => updateSiteConfig((prev) => ({ ...prev, cardRadius: rad, designTokens: normalizeDesignTokens({ ...prev.designTokens, cardRadius: rad }) }))}
                cardShadow={cardShadow}
                onCardShadowChange={(shd) => updateSiteConfig((prev) => ({ ...prev, cardShadow: shd, designTokens: normalizeDesignTokens({ ...prev.designTokens, cardShadow: shd }) }))}
                borderStyle={borderStyle}
                onBorderStyleChange={(bs) => updateSiteConfig((prev) => ({ ...prev, borderStyle: bs, designTokens: normalizeDesignTokens({ ...prev.designTokens, borderStyle: bs }) }))}
                onApplyPreset={(p) => {
                  updateSiteConfig((prev) => ({ ...prev,
                    accentColor: p.accentColor,
                    surfaceColor: p.surfaceColor,
                    cardRadius: p.radius,
                    cardShadow: p.shadow,
                    borderStyle: p.borderStyle,
                    bgStyle: p.bgStyle,
                    themeMode: p.themeMode,
                    designTokens: normalizeDesignTokens({ ...prev.designTokens, accentColor: p.accentColor, surfaceColor: p.surfaceColor, cardRadius: p.radius, cardShadow: p.shadow, borderStyle: p.borderStyle, themeMode: p.themeMode, background: { ...prev.designTokens.background, style: p.bgStyle } })
                  }));
                }}
                onResetDefault={() => {
                  const preset = VISUAL_PRESETS[0];
                  updateSiteConfig((prev) => ({ ...prev,
                    accentColor: preset.accentColor,
                    surfaceColor: preset.surfaceColor,
                    cardRadius: preset.radius,
                    cardShadow: preset.shadow,
                    borderStyle: preset.borderStyle,
                    bgStyle: preset.bgStyle,
                    themeMode: preset.themeMode,
                    designTokens: normalizeDesignTokens({ ...prev.designTokens, accentColor: preset.accentColor, surfaceColor: preset.surfaceColor, cardRadius: preset.radius, cardShadow: preset.shadow, borderStyle: preset.borderStyle, themeMode: preset.themeMode, background: { ...prev.designTokens.background, style: preset.bgStyle } })
                  }));
                }}
                allowedBackgroundStyles={capabilities.allowedBackgroundStyles}
                allowedDesignOptions={capabilities.allowedDesignOptions}
                onEntitlementError={setEntitlementMessage}
                locale={locale}
              />
            )}

            {activeTab === 'audience' && (
              <StudioAudienceTab siteId={activeSiteId} handle={username} locale={locale} />
            )}

            {activeTab === 'analytics' && (
              <Suspense fallback={<div role="status" className="flex min-h-48 items-center justify-center text-sm text-slate-500">{isRtl ? 'جارٍ تحميل التحليلات...' : 'Loading analytics…'}</div>}>
                <StudioAnalyticsTab siteId={activeSiteId} links={links} locale={locale} analyticsEnabled={capabilities.analytics} />
              </Suspense>
            )}

            {activeTab === 'settings' && (
              <StudioSettingsTab
                siteId={activeSiteId}
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
                socials={siteConfig.socials}
                onSocialsChange={(val) => updateSiteConfig({ socials: val })}
                bookingConfig={bookingConfig}
                onBookingConfigChange={(val) => updateSiteConfig({ bookingConfig: val })}
                onUpgradePlan={onOpenPricing}
                onManageBilling={onManageBilling}
                onOpenAccountSettings={onOpenAccountSettings}
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
              designTokens={designTokens}
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

    </main>
  );
};
