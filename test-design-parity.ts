import assert from 'node:assert/strict';
import { designCardStyle, designTokensFromSite, normalizeDesignTokens } from './src/utils/designTokens';

const persistedSite = {
  bgStyle: 'gradient',
  coverImage: 'https://cdn.example/cover.jpg',
  accentColor: '#0F766E',
  surfaceColor: 'rgba(255,255,255,0.82)',
  cardRadius: 'subtle',
  cardShadow: 'hard',
  borderStyle: 'dashed',
  themeMode: 'light',
  designTokens: {
    accentColor: '#DB2777',
    surfaceColor: '#FFF7ED',
    cardRadius: 'pill',
    cardShadow: 'soft',
    borderStyle: 'bold',
    themeMode: 'dark',
    typography: { fontFamily: 'serif', headingScale: 'large', bodyScale: 'compact', headingWeight: 900, bodyWeight: 600 },
    background: { style: 'banner', coverImage: 'https://cdn.example/canonical-cover.jpg', coverPosition: 'top', overlay: 'strong' },
    layout: { contentWidth: 'wide', cardGap: 'spacious', sectionSpacing: 'tight', horizontalPadding: 'wide' }
  }
};

const previewTokens = designTokensFromSite(persistedSite);
const publicTokens = designTokensFromSite({ ...persistedSite });
assert.deepEqual(publicTokens, previewTokens, 'Studio preview and public renderer must consume the same canonical tokens');
assert.equal(previewTokens.background.coverImage, persistedSite.designTokens.background.coverImage);
assert.equal(previewTokens.typography.fontFamily, 'serif');
assert.equal(previewTokens.layout.contentWidth, 'wide');

const legacyTokens = designTokensFromSite({
  bgStyle: 'minimal',
  coverImage: 'legacy-cover',
  accentColor: '#111827',
  surfaceColor: '#FFFFFF',
  cardRadius: 'sharp',
  cardShadow: 'none',
  borderStyle: 'none',
  themeMode: 'light'
});
assert.equal(legacyTokens.background.style, 'minimal');
assert.equal(legacyTokens.background.coverImage, 'legacy-cover');
assert.equal(legacyTokens.cardRadius, 'sharp');
assert.equal(legacyTokens.cardShadow, 'none');
assert.equal(legacyTokens.borderStyle, 'none');

const previewCard = designCardStyle(previewTokens, false);
const publicCard = designCardStyle(publicTokens, false);
assert.deepEqual(publicCard, previewCard, 'Card geometry and surface styles must not drift between renderers');
assert.equal(normalizeDesignTokens({}).background.style, 'signature');

console.log('Design parity tests passed');
