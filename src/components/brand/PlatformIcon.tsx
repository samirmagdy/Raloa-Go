import React from 'react';
import {
  siInstagram,
  siYoutube,
  siTiktok,
  siX,
  siGithub,
  siSpotify,
  siNotion,
  siSubstack,
  siShopify,
  siCalendly,
  siLinear,
  siVercel,
  siFigma,
  siStripe,
  siGoogle
} from 'simple-icons';

export type PlatformIconName =
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'x'
  | 'linkedin'
  | 'github'
  | 'spotify'
  | 'notion'
  | 'substack'
  | 'shopify'
  | 'calendly'
  | 'linear'
  | 'vercel'
  | 'figma'
  | 'stripe'
  | 'google';

type SimpleIconData = { path: string };

const ICONS: Partial<Record<PlatformIconName, SimpleIconData>> = {
  instagram: siInstagram,
  youtube: siYoutube,
  tiktok: siTiktok,
  x: siX,
  github: siGithub,
  spotify: siSpotify,
  notion: siNotion,
  substack: siSubstack,
  shopify: siShopify,
  calendly: siCalendly,
  linear: siLinear,
  vercel: siVercel,
  figma: siFigma,
  stripe: siStripe,
  google: siGoogle
};

// Simple Icons currently does not expose LinkedIn from its package entrypoint.
// This is the official LinkedIn mark path used by the platform's brand SVG.
const LINKEDIN_PATH = 'M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.64 1.64 0 1 0 0 3.27 1.64 1.64 0 0 0 0-3.27z';

interface PlatformIconProps {
  name: PlatformIconName;
  className?: string;
  title?: string;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({ name, className = '', title }) => {
  const icon = ICONS[name];
  const path = name === 'linkedin' ? LINKEDIN_PATH : icon?.path;

  if (!path) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={path} />
    </svg>
  );
};
