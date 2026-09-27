import type { CSSProperties } from 'react';
import type { BackgroundStyle } from '../types';

export type DesignThemeMode = 'auto' | 'dark' | 'light';
export type CardRadius = 'sharp' | 'subtle' | 'rounded' | 'pill';
export type CardShadow = 'none' | 'subtle' | 'soft' | 'hard';
export type BorderStyle = 'none' | 'thin' | 'bold' | 'dashed';

export interface DesignTypographyTokens {
  fontFamily: 'sans' | 'serif' | 'mono';
  headingScale: 'compact' | 'standard' | 'large';
  bodyScale: 'compact' | 'standard' | 'large';
  headingWeight: 700 | 800 | 900;
  bodyWeight: 400 | 500 | 600;
}

export interface DesignBackgroundTokens {
  style: BackgroundStyle;
  coverImage: string;
  coverPosition: 'center' | 'top' | 'bottom';
  overlay: 'none' | 'soft' | 'strong';
}

export interface DesignLayoutTokens {
  contentWidth: 'compact' | 'standard' | 'wide';
  cardGap: 'tight' | 'standard' | 'spacious';
  sectionSpacing: 'tight' | 'standard' | 'spacious';
  horizontalPadding: 'tight' | 'standard' | 'wide';
}

export interface DesignTokens {
  accentColor: string;
  surfaceColor: string;
  cardRadius: CardRadius;
  cardShadow: CardShadow;
  borderStyle: BorderStyle;
  themeMode: DesignThemeMode;
  typography: DesignTypographyTokens;
  background: DesignBackgroundTokens;
  layout: DesignLayoutTokens;
}

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  accentColor: '#4F46E5',
  surfaceColor: '#FFFFFF',
  cardRadius: 'rounded',
  cardShadow: 'subtle',
  borderStyle: 'thin',
  themeMode: 'auto',
  typography: {
    fontFamily: 'sans',
    headingScale: 'standard',
    bodyScale: 'standard',
    headingWeight: 800,
    bodyWeight: 400
  },
  background: {
    style: 'signature',
    coverImage: '',
    coverPosition: 'center',
    overlay: 'soft'
  },
  layout: {
    contentWidth: 'standard',
    cardGap: 'standard',
    sectionSpacing: 'standard',
    horizontalPadding: 'standard'
  }
};

type LegacyDesignInput = {
  accentColor?: unknown;
  surfaceColor?: unknown;
  cardRadius?: unknown;
  cardShadow?: unknown;
  borderStyle?: unknown;
  themeMode?: unknown;
  bgStyle?: unknown;
  coverImage?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';
const oneOf = <T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T =>
  (typeof value === 'string' || typeof value === 'number') && (allowed as readonly (string | number)[]).includes(value) ? value as T : fallback;
const color = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim().length <= 120 && value.trim() ? value.trim() : fallback;

export function normalizeDesignTokens(input: unknown, legacy: LegacyDesignInput = {}): DesignTokens {
  const source = isRecord(input) ? input : {};
  const typography = isRecord(source.typography) ? source.typography : {};
  const background = isRecord(source.background) ? source.background : {};
  const layout = isRecord(source.layout) ? source.layout : {};

  return {
    accentColor: color(source.accentColor ?? legacy.accentColor, DEFAULT_DESIGN_TOKENS.accentColor),
    surfaceColor: color(source.surfaceColor ?? legacy.surfaceColor, DEFAULT_DESIGN_TOKENS.surfaceColor),
    cardRadius: oneOf(source.cardRadius ?? legacy.cardRadius, ['sharp', 'subtle', 'rounded', 'pill'], DEFAULT_DESIGN_TOKENS.cardRadius),
    cardShadow: oneOf(source.cardShadow ?? legacy.cardShadow, ['none', 'subtle', 'soft', 'hard'], DEFAULT_DESIGN_TOKENS.cardShadow),
    borderStyle: oneOf(source.borderStyle ?? legacy.borderStyle, ['none', 'thin', 'bold', 'dashed'], DEFAULT_DESIGN_TOKENS.borderStyle),
    themeMode: oneOf(source.themeMode ?? legacy.themeMode, ['auto', 'dark', 'light'], DEFAULT_DESIGN_TOKENS.themeMode),
    typography: {
      fontFamily: oneOf(typography.fontFamily, ['sans', 'serif', 'mono'], DEFAULT_DESIGN_TOKENS.typography.fontFamily),
      headingScale: oneOf(typography.headingScale, ['compact', 'standard', 'large'], DEFAULT_DESIGN_TOKENS.typography.headingScale),
      bodyScale: oneOf(typography.bodyScale, ['compact', 'standard', 'large'], DEFAULT_DESIGN_TOKENS.typography.bodyScale),
      headingWeight: oneOf(typography.headingWeight, [700, 800, 900] as const, DEFAULT_DESIGN_TOKENS.typography.headingWeight),
      bodyWeight: oneOf(typography.bodyWeight, [400, 500, 600] as const, DEFAULT_DESIGN_TOKENS.typography.bodyWeight)
    },
    background: {
      style: oneOf(background.style ?? legacy.bgStyle, ['signature', 'banner', 'immersive', 'gradient', 'minimal'], DEFAULT_DESIGN_TOKENS.background.style),
      coverImage: color(background.coverImage ?? legacy.coverImage, DEFAULT_DESIGN_TOKENS.background.coverImage),
      coverPosition: oneOf(background.coverPosition, ['center', 'top', 'bottom'], DEFAULT_DESIGN_TOKENS.background.coverPosition),
      overlay: oneOf(background.overlay, ['none', 'soft', 'strong'], DEFAULT_DESIGN_TOKENS.background.overlay)
    },
    layout: {
      contentWidth: oneOf(layout.contentWidth, ['compact', 'standard', 'wide'], DEFAULT_DESIGN_TOKENS.layout.contentWidth),
      cardGap: oneOf(layout.cardGap, ['tight', 'standard', 'spacious'], DEFAULT_DESIGN_TOKENS.layout.cardGap),
      sectionSpacing: oneOf(layout.sectionSpacing, ['tight', 'standard', 'spacious'], DEFAULT_DESIGN_TOKENS.layout.sectionSpacing),
      horizontalPadding: oneOf(layout.horizontalPadding, ['tight', 'standard', 'wide'], DEFAULT_DESIGN_TOKENS.layout.horizontalPadding)
    }
  };
}

export function designTokensFromSite(site: unknown): DesignTokens {
  const record = isRecord(site) ? site : {};
  return normalizeDesignTokens(record.designTokens, record);
}

export function designTokensToLegacyFields(tokens: DesignTokens) {
  return {
    accentColor: tokens.accentColor,
    surfaceColor: tokens.surfaceColor,
    cardRadius: tokens.cardRadius,
    cardShadow: tokens.cardShadow,
    borderStyle: tokens.borderStyle,
    themeMode: tokens.themeMode,
    bgStyle: tokens.background.style,
    coverImage: tokens.background.coverImage
  };
}

export function designFontFamily(tokens: DesignTokens): string {
  return tokens.typography.fontFamily === 'serif' ? 'ui-serif, Georgia, serif' : tokens.typography.fontFamily === 'mono' ? 'ui-monospace, SFMono-Regular, monospace' : 'ui-sans-serif, system-ui, sans-serif';
}

export function designCardStyle(tokens: DesignTokens, isDark: boolean, accentColor = tokens.accentColor): CSSProperties {
  const borderColor = tokens.borderStyle === 'bold' ? accentColor : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
  const border = tokens.borderStyle === 'none' ? 'none' : `${tokens.borderStyle === 'bold' ? 2 : 1}px ${tokens.borderStyle === 'dashed' ? 'dashed' : 'solid'} ${borderColor}`;
  const radius = tokens.cardRadius === 'sharp' ? '0' : tokens.cardRadius === 'subtle' ? '0.5rem' : tokens.cardRadius === 'pill' ? '9999px' : '1rem';
  const shadow = tokens.cardShadow === 'none' ? 'none' : tokens.cardShadow === 'soft' ? (isDark ? '0 8px 20px rgba(0,0,0,.4)' : '0 8px 20px rgba(0,0,0,.08)') : tokens.cardShadow === 'hard' ? (isDark ? '3px 3px 0 rgba(255,255,255,.25)' : '3px 3px 0 #0F172A') : '0 1px 2px rgba(15,23,42,.08)';
  return { backgroundColor: tokens.surfaceColor, border, borderRadius: radius, boxShadow: shadow };
}

export function designLayoutStyle(tokens: DesignTokens): CSSProperties {
  return {
    fontFamily: designFontFamily(tokens),
    paddingLeft: tokens.layout.horizontalPadding === 'tight' ? '0.75rem' : tokens.layout.horizontalPadding === 'wide' ? '1.5rem' : '1rem'
  };
}

export function designContentWidth(tokens: DesignTokens): string {
  return tokens.layout.contentWidth === 'compact' ? '24rem' : tokens.layout.contentWidth === 'wide' ? '42rem' : '36rem';
}

export function designTypographyStyle(tokens: DesignTokens, kind: 'heading' | 'body'): CSSProperties {
  const scale = kind === 'heading' ? tokens.typography.headingScale : tokens.typography.bodyScale;
  const size = kind === 'heading' ? (scale === 'compact' ? '1rem' : scale === 'large' ? '1.75rem' : '1.25rem') : (scale === 'compact' ? '.75rem' : scale === 'large' ? '1rem' : '.875rem');
  return { fontSize: size, fontWeight: kind === 'heading' ? tokens.typography.headingWeight : tokens.typography.bodyWeight };
}

export function designCardGap(tokens: DesignTokens): string {
  return tokens.layout.cardGap === 'tight' ? '.5rem' : tokens.layout.cardGap === 'spacious' ? '1.25rem' : '.75rem';
}
