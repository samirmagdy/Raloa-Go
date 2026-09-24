# RALOA Design Taste Frontend Review

Date: 2026-09-24  
Scope: every routed page, marketing section, shared component, modal, public profile, authentication state, and Studio surface found under `src/`.

## Executive result

RALOA has a recognizable, coherent brand direction: a creator-focused split hero, strong ink typography, indigo-blue action color, branded phone preview, and a clear conversion path from handle claim to template selection. The existing system is worth preserving and refining rather than replacing.

The primary quality risk is not a lack of visual polish. It is that the same visual ambition is implemented through too many independent effects and layout assumptions. Scroll state is tracked in several places, the cursor adds a second pointer layer, hero decorations are positioned independently from the phone preview, and the Studio uses marketing-style rounded surfaces inside a dense editor. Those decisions can look good at one viewport and fail at another.

### Scores

| Area | Score | Assessment |
| --- | ---: | --- |
| Brand identity | 7.5/10 | Memorable and consistent enough to preserve. |
| Typography and hierarchy | 7/10 | Strong display treatment, but some pages overuse uppercase micro-labels and small text. |
| Layout and spacing | 6/10 | Good section rhythm in the main landing page, with several fixed-height and breakpoint risks. |
| Responsive behavior | 5.5/10 | Intent is present, but the implementation needs real device validation and overflow reduction. |
| Motion and interaction | 5/10 | Rich and expressive, but too many independent listeners and loops for mobile performance. |
| Accessibility | 6/10 | Good labels and focus rings in many places; dialog, target-size, reduced-motion, and selection issues remain. |
| Component consistency | 6/10 | Shared tokens exist, but radii, colors, shadows, and icon treatment drift. |
| Product UI quality | 6/10 | Studio is capable, but dense and visually too close to the marketing layer. |
| Overall release confidence | 6/10 | Strong foundation, not yet a final visual release pass. |

These scores are source-audit scores. A browser screenshot pass was not available because the repository has no Playwright or Puppeteer dependency installed in this environment.

## Design read and dials

Reading this as a design-led SaaS landing and creator product for creators, freelancers, and small businesses, with a confident blue-violet brand language leaning toward an asymmetric split hero, real product preview, and restrained editorial/product motion.

- `DESIGN_VARIANCE: 8`
- `MOTION_INTENSITY: 6`
- `VISUAL_DENSITY: 4`
- Mode: redesign preserve. Keep the logo, blue-violet brand, split hero, phone preview, template gallery, pricing, and creator-first voice.
- System: Tailwind v4 utilities, native CSS tokens, and Motion. Do not add a second component system for the marketing layer.

## Release blockers

### P0: Consolidate scroll state and remove continuous React scroll work

Evidence:

- `src/hooks/useScrollProgress.ts:47-82` attaches a scroll listener, reads `window.scrollY`, schedules a frame, and writes React state.
- `src/components/Header.tsx:103-139` adds separate scroll listeners for header state and dashboard section state.
- `src/components/HowItWorks.tsx:58-95` measures every step on every scroll and resize event.
- `src/components/ScrollSpyDots.tsx:84-113` repeats scroll-position logic.
- `src/components/BackToTop.tsx`, `ScrollProgressBar.tsx`, `TemplateGallery.tsx`, and other components add more listeners.

Why it matters: this creates multiple independent frame loops, duplicate geometry reads, and avoidable state updates on low-power mobile devices. It also makes section state disagree between the header, dots, and animation components.

Recommended fix:

1. Use one `IntersectionObserver` section registry for navigation and active-section state.
2. Use Motion `useScroll` only for scroll progress visualizations.
3. Keep threshold visibility in a shared hook rather than calculating `scrollY` in individual components.
4. Use CSS `scroll-behavior` and anchor targets for simple navigation.
5. Remove direct `window.scrollY`, `window.pageYOffset`, and scroll listeners from presentation components.

Acceptance check: one section-observer service, no direct scroll listener in marketing primitives, and no React state update on every scroll frame except a justified isolated progress value.

### P0: Remove the custom cursor

Evidence: `src/App.tsx:627-628` mounts `CustomCursor` on every non-Studio route. `src/components/CustomCursor.tsx:24-74` attaches global mouse, mouse-down, mouse-up, and document enter/leave listeners and updates Motion plus React state.

The component is hidden on touch devices, but it still changes pointer semantics on desktop, adds global listeners, and creates an accessibility and motion burden for no essential product value. The skill explicitly rejects custom cursors. Remove the mount and component, or limit it to a deliberately art-directed campaign page after user approval.

### P0: Replace mobile-unstable viewport shells

Evidence: `min-h-screen` appears in `ErrorBoundary.tsx:83`, `NotFound.tsx:73`, `InvalidSslFallback.tsx:53`, `PublicCreatorProfile.tsx:103`, `TemplatesPage.tsx:46`, `StudioModal.tsx:429` and `487`, `AuthenticatedHome.tsx:331`, and `App.tsx:625`.

`min-h-screen` can use a stale mobile viewport height while browser chrome expands or collapses. Replace full-page shells with `min-h-[100dvh]`, then validate the safe area on iOS. Do not globally replace every occurrence without checking whether the element is a true page shell.

### P0: Make the hero decoration anchor to the preview, not the viewport

`Hero.tsx` uses a large absolute hero artwork, a separately positioned ambient glow, Doodles, and a responsive grid. The design intent is good, but the decoration stack is independent from the mobile preview bounds. The user-provided screenshots already show doodles and callouts overlapping adjacent content at intermediate widths.

Recommended fix:

- Create one `relative` preview stage around the phone, annotations, and performance badge.
- Position each doodle relative to named preview anchors.
- Hide or simplify annotations below `md` rather than shifting the same absolute coordinates.
- Add `overflow: clip` to the stage only after verifying the callout does not need to escape it.
- Test 320, 375, 430, 768, and 1024 widths, especially the transition before `lg`.

### P0: Complete keyboard dialog behavior consistently

`useModalA11y` is used by most dialogs, including Auth, Referral, Plan Checkout, Contact, Legal, Template Preview, Command Palette, Project Stats, and Mini Site Demo. This is a good foundation. The coverage is not uniform, however, and `CommandPaletteModal` does not show the same `aria-labelledby` contract as the other dialogs in the source scan.

Audit every dialog for:

- focus moved into the dialog on open;
- focus trapped while open;
- focus returned to the invoking control on close;
- Escape closes the topmost dialog only;
- backdrop clicks do not close a destructive or in-progress flow accidentally;
- an accessible name exists for every `role="dialog"`;
- nested dialogs do not leave the background interactive.

## Brand system review

### What to preserve

- Ink text with soft slate supporting text.
- Indigo as the primary action color.
- Blue-violet energy as a brand expression, especially in the logo, selected states, and hero headline.
- Plus Jakarta Sans for display and Inter for UI body copy.
- Soft cards and pill CTAs, provided their radius rules are documented and consistently applied.
- The real phone preview and template-specific assets.
- Light and dark hero artwork switching.
- The light-mode pricing pattern, which belongs in the plans section rather than the hero.

### What to standardize

The tokens in `src/index.css` are a useful base, but components frequently use direct colors such as indigo, violet, pink, emerald, amber, teal, cyan, and rose. That makes the product feel like several visual systems sharing a logo.

Recommended page-level color lock:

- Brand accent: indigo-blue, with violet-blue gradient only for the hero wordmark treatment.
- Semantic success: emerald only for success and verification.
- Semantic warning/error: amber and rose only in status or error contexts.
- Do not use pink, teal, cyan, and amber as decorative feature-card accents.
- Keep backgrounds neutral and use the pattern only behind pricing.

The shape system is currently understandable but not explicitly documented: cards tend toward `rounded-2xl`, high-level panels use `rounded-3xl`, controls use pills or `rounded-xl`. Document this as cards 16px, major surfaces 24px, controls 12px, primary actions pill-shaped. Then remove exceptions.

### Typography

The display font is appropriate for a creator-facing brand. The main hero headline is memorable and stays within two lines at desktop. The main risks are:

- too many uppercase, letter-spaced labels competing with the headline;
- small Studio labels and controls that fall below comfortable reading size;
- text lengths that will wrap differently in Arabic and English;
- repeated bold text inside cards reducing hierarchy.

Use one clear hierarchy per section: eyebrow or label, heading, supporting copy, action. Avoid adding a second decorative status line when the section already has a heading and subtitle.

## Page and section review

### Home route

| Surface | Finding | Priority |
| --- | --- | --- |
| `Header` | Strong brand placement and compact 64px height. At 1280px, the full desktop nav plus locale, sound, theme, auth, and CTA is likely to be crowded. Scroll and dashboard spies are separate listeners. | P0 |
| `Hero` | Strong asymmetric split direction and real visual asset. Top padding is `md:pt-[124px]`, exceeding the skill's 96px guidance and contributing to the large empty upper area seen in screenshots. The glow is another gradient layer over an already branded background. | P0 |
| `Hero` CTA | Good conversion pattern. Keep the handle field and CTA as one focal unit. Verify validation, focus, error, and keyboard submit states. | P1 |
| `Hero` proof row | Useful trust information, but it increases hero height and competes with the CTA. Move it into the trust section on mobile if the hero becomes vertically heavy. | P1 |
| `Hero` live canvas | A horizontally scrollable control is visually dense and can be mistaken for page overflow. Collapse to a compact select or two-row control on narrow screens. | P1 |
| `Doodles` | Brand-specific and useful when anchored to the mobile preview. Current absolute positioning needs an intermediate-width layout. | P0 |
| `TrustAndBenefits` | Good transition from promise to proof. Avoid repeating the same three benefits in the hero and immediately below it. | P1 |
| `TemplateGallery` | Real templates make the product credible. The hover and scroll state should not be coupled to global listeners. At 320px, use one-column cards or a controlled carousel with visible controls. | P1 |
| `HowItWorks` | Clear three-step story, but active reading state is implemented with per-scroll geometry reads. The state labels add density to an otherwise simple narrative. | P0 |
| `FeatureGrid` | The feature set is easy to scan, but eight similarly weighted cards and many accent colors create a generic grid. Group features into two or three capability bands with one dominant feature. | P1 |
| `Testimonials` | The quote cards are readable and human. Keep one quote per card, reduce repeated border/shadow treatment, and ensure images have local fallbacks. | P1 |
| `PricingTable` | Pattern placement is correct for the user's direction. Three equal cards weaken the upgrade path. Give Pro a clear visual lead, keep Free quieter, and make Studio's additional capabilities explicit. | P1 |
| `FAQAccordion` | Solid interaction model. Ensure only one accordion behavior is chosen, preserve keyboard focus, and reduce decorative separators and middle dots. | P1 |
| `Newsletter` | Good low-friction secondary conversion. Make error and success states occupy stable space so the page does not jump. | P1 |
| `FinalCTA` | Useful closing conversion, but it repeats the hero CTA. Use a shorter, more decisive close and keep the main action label consistent. | P1 |
| `Footer` | Clear four-column information architecture. On mobile, put brand content first, then two-column link groups, then legal. Validate logo lockup proportions against the official asset. | P1 |
| `BackToTop` | Helpful on a long landing page. Keep it hidden until the first meaningful scroll threshold and expose an accessible label. | P2 |
| `ScrollProgressBar` | Useful as a subtle progress cue, but its blue-to-purple gradient competes with the accent lock. Use a single indigo token. | P1 |
| `ScrollSpyDots` | The concept fits a long art-directed landing page, but the permanent vertical control adds clutter and duplicates navigation state. Keep desktop-only or remove after consolidating section navigation. | P1 |
| `VoiceTourToggle` | Interesting differentiator. It must be opt-in, pause cleanly, expose speaking state, and never start audio automatically. | P1 |
| `LoadingOverlay` | Branded but likely adds a perceptual delay before the landing page becomes useful. Use only when data is genuinely blocking, and provide a reduced-motion static state. | P1 |

### Templates route

`TemplatesPage.tsx` is a useful dedicated browsing surface, but the grid needs a narrow-device rule. A two-column template grid at 320px leaves each card with too little width for creator names, labels, and imagery. Use one column through a narrow breakpoint, then two columns when cards meet a minimum width. Keep the header action and filter controls in one row only when they fit.

The page currently uses a separate page shell and a 5-column large-screen grid. Validate the gap at 1024px and 1280px. Five columns can make the page feel like an asset catalog rather than a design gallery. A four-column maximum with larger previews would better support the premium visual direction.

### Public creator profile

`PublicCreatorProfile.tsx` has the right product promise: a focused, creator-owned page with a phone-like content hierarchy. The primary risks are `min-h-screen`, remote or user-controlled image URLs without a visible broken-image fallback, and profile data that can inherit inconsistent colors and radii from the marketing system.

Keep creator customization, but constrain it to a safe theme contract. Use local fallback art for avatar, cover, and link thumbnails. Provide meaningful alt text or mark purely decorative images empty. Verify long creator names, missing bios, Arabic RTL, and zero-link empty states.

### Authentication routes

Login, register, forgot password, and reset password are presented through `AuthModal` on the home shell. This keeps the brand context, but it also means auth URL states are visually coupled to the marketing page and inherit its scroll, loading, and cursor layers.

Use a dedicated auth surface at narrow widths with a calm background and no unnecessary hero motion. Preserve the current fields and names for autofill. Validate error placement, password visibility, loading state, provider errors, and focus restoration. Never allow the loading overlay or a background modal layer to obscure an auth error.

### Studio route and editor

The design-taste skill is not intended for dense product UI, so this review evaluates Studio for visual consistency, responsive safety, and interaction clarity rather than applying landing-page composition rules literally.

| Surface | Finding | Priority |
| --- | --- | --- |
| `StudioModal` | Rich editor shell, but `min-h-screen`, large dark ambient backgrounds, and a split 56/44 layout need 100dvh and intermediate-width testing. Avoid `select-none` on the whole editor because users need to select and copy text. | P0 |
| `StudioTopToolbar` | Too many actions and status signals for a compact toolbar. Use a primary action, save/publish state, and an overflow menu. Guarantee no wrap at 320px. | P1 |
| `StudioMobileNav` | Good responsive concept. Add iOS safe-area padding, keep a minimum 44px target, and ensure the drawer does not cover its own trigger or editor content. | P1 |
| `StudioContentTab` | Logical content flow. The block picker and compact text controls are dense; make the block cards larger and keep form controls at least 44px tall. | P1 |
| `StudioDesignTab` | Powerful controls, but many small toggles and color inputs create a cockpit feeling. Group advanced controls under progressive disclosure. | P1 |
| `StudioAudienceTab` | Useful analytics and contacts surface. Tables need intentional empty, loading, and error states, not only a horizontal overflow fallback. | P1 |
| `StudioAnalyticsTab` | Charts use multiple semantic colors and filled comparison tracks. Use indigo for primary metrics and reserve emerald for positive status. Clearly label simulated or unavailable data. | P1 |
| `StudioSettingsTab` | Strong grouping, but many compact inputs and secondary actions need a consistent form rhythm and error summary. | P1 |
| `StudioTemplatePreview` | `min-h-[680px]` is likely to create excess space or overlap on mobile. Use a content-based height with a bounded preview stage and controlled scaling. | P0 |
| `SortableBlockList` | Drag and drop is powerful but must have a keyboard reorder alternative, visible drag state, and a non-drag editing path. | P0 |
| `SocialPreviewGenerator` | Valuable export feature. Check long names, Arabic, missing avatar, and image loading states. Avoid presenting generated preview claims as real social metadata. | P1 |
| `StudioLinktreeImporter` | Good utility modal. Show clear loading, parse error, duplicate, and cancel states. Keep the import operation reversible. | P1 |
| `StudioQrModal` | Keep the QR image framed with a download label, error state, and accessible alternative text. | P2 |

### Error and fallback pages

`NotFound`, `InvalidSslFallback`, and `ErrorBoundary` are visually branded and include useful recovery actions. They use several gradients and semantic colors at once, however, which makes them feel like a different product. Simplify them to a neutral base, one brand accent, and one state color. Replace `min-h-screen` with `min-h-[100dvh]` and test very short mobile viewports.

The 404 illustration is acceptable as a purposeful error visual. Keep it, but do not let the decorative artwork push the recovery CTA below the first viewport. Error details should be collapsible and never dominate the primary recovery action.

## Shared component audit

| Component or group | Review outcome |
| --- | --- |
| `RaloaLogo` | Preserve official proportions. Centralize size variants and use the same lockup rules in Header, Footer, LoadingOverlay, and auth. |
| `Doodles` | Preserve the recognizable annotation language, but anchor to the preview stage and reduce at intermediate widths. |
| `PlatformIcon` | Keep one icon family and consistent stroke weight. |
| `PremiumMark` | Use as a semantic premium indicator, not as repeated decoration. |
| `FadeInSection` | Keep motion isolated and provide reduced-motion behavior. |
| `PhoneMockup` | Strong product proof. Add robust image fallback, `object-position` controls, and avoid forced minimum heights that crop content. |
| `TemplateSnapshotPopover` | Good desktop enhancement; ensure hover is not the only way to access it and prevent it from escaping the viewport. |
| `SocialProofMarquee` | Pause on hover and reduce or disable for reduced motion. Ensure duplicated content is hidden from assistive technology when used only for looping. |
| `ThemeToggle` | Good preference control. Verify contrast and focus in both themes. |
| `LanguageDropdown` | Ensure menu placement works in RTL and near viewport edges. Close on Escape and restore focus. |
| `SoundToggle` | Keep explicit opt-in and label state, not only an icon. |
| `Tooltip` | Tooltips must not be the only source of meaning. Avoid hover-only content on touch. |
| `ReadTimeBadge` | Useful for guides, but do not add it to general marketing cards as decoration. |
| `EasterEggOverlay` | Keep separate from core conversion and ensure it cannot trap focus or hijack Escape. |
| `ErrorBoundary` | Good recovery path. Add telemetry and keep technical details collapsed. |
| `AuthModal` | Strong form coverage; verify focus return, provider errors, and stable error space. |
| `CommandPaletteModal` | Powerful but high complexity. Add complete accessible naming and ensure it does not appear as a hidden navigation duplicate to screen readers. |
| `ContactModal` | Keep compact and use inline validation. |
| `KeyboardShortcutsModal` | Useful for power users; ensure shortcuts do not fire while typing in form controls. |
| `LegalModal` | Use a scrollable article region with a visible heading and close control. |
| `MiniSiteDemoModal` | Preserve real previews; provide loading and broken image fallbacks. |
| `PlanCheckoutModal` | Do not imply a plan is active until server billing synchronization confirms it. Keep the confirmation state visually distinct from checkout initiation. |
| `ProjectStatsModal` | Metrics need explicit data freshness and empty states. Avoid decorative precision when values are simulated. |
| `ReferralModal` | Keep the real reward progress, but separate semantic progress from decorative filled tracks. Protect reward qualification server-side. |
| `TemplatePreviewModal` | Good focused preview; test viewport-contained close controls and keyboard navigation. |
| `BackToTop` | Keep as a single floating utility with a real accessible label. |
| `ScrollProgressBar` | Single accent, no extra gradient. |
| `ScrollSpyDots` | Reduce or remove after shared observer work. |
| `LoadingOverlay` | Avoid blocking static content for a fixed delay. |
| `AuthenticatedHome` | Treat as a product dashboard, not a landing page. Apply a separate density and interaction audit. |

## Content and trust findings

The source contains em dashes and en-dash separators in visible and metadata copy. The design skill requires zero em dash and en dash separators. Normalize them to periods, commas, or regular hyphens. Evidence includes `src/data/content.ts`, `src/App.tsx`, `FinalCTA.tsx`, `TemplateGallery.tsx`, `PricingTable.tsx`, `FeatureGrid.tsx`, `FAQAccordion.tsx`, `PublicCreatorProfile.tsx`, and `src/hooks/useSEO.ts`.

The previous go-live scope explicitly reduced promises to verified capabilities. The marketing feature content still contains claims related to bookings, stores, integrations, and analytics that must be checked against the production capability matrix before being treated as visual copy. Unsupported claims are a design issue because they break trust and make the visual hierarchy sell capabilities the backend may not provide.

Review all creator and testimonial data for placeholder URLs, remote image availability, and consent. A broken thumbnail is not only a technical defect. It damages the perceived quality of the template and public-profile product.

## Accessibility and interaction checklist

- [ ] All primary and secondary buttons have visible focus rings in light and dark modes.
- [ ] All icon-only buttons have an accessible name.
- [ ] All dialogs have a unique accessible name and consistent focus trapping.
- [ ] Close buttons are at least 44 by 44 CSS pixels on mobile.
- [ ] Studio controls and block picker options meet the same target-size rule.
- [ ] Drag-and-drop has keyboard reorder support.
- [ ] Hover-only template previews have a click and keyboard equivalent.
- [ ] Motion uses `useReducedMotion` or an equivalent Motion-level fallback, not only a global CSS animation override.
- [ ] Marquee duplication is hidden from assistive technology.
- [ ] Form errors are associated with fields and announced without layout jumps.
- [ ] Arabic layout is tested for logical order, icon direction, truncation, and menu placement.
- [ ] No custom cursor is mounted.
- [ ] Text remains selectable in the Studio editor.

## Responsive release matrix

This is the minimum manual screenshot matrix before calling the visual pass complete.

| Width | Main checks |
| ---: | --- |
| 320 | One-column templates, no page overflow, readable hero CTA, no doodle collision, Studio toolbar and controls usable. |
| 375 | Auth modal, pricing card flow, testimonials, profile long names, bottom navigation safe area. |
| 430 | Hero preview scale, live-canvas control, FAQ width, footer columns, floating utilities. |
| 768 | Hero transition, doodle anchoring, template gallery, tablet navigation, Studio split behavior. |
| 1024 | Header transition, preview and text balance, pricing widths, Studio editor start state. |
| 1280 | Full header fit, hero top spacing, 4-column gallery, pricing upgrade hierarchy. |
| 1440 | Max-width alignment between header, hero text, sections, pricing, and footer. |

Also test: dark mode, Arabic RTL, reduced motion, keyboard only, slow network, missing remote images, signed-out state, signed-in state, and a narrow viewport with browser chrome visible.

## Pre-flight result

| Rule | Result | Notes |
| --- | --- | --- |
| Design read and dials declared | Pass | Preserve direction is clear. |
| One styling system | Pass | Tailwind and native CSS are coherent. |
| Existing brand assets respected | Pass | Real logo, hero artwork, templates, and phone preview are present. |
| Max one decorative accent per page | Fail | Multiple feature and state colors appear in marketing sections. |
| Shape consistency | Warn | Radius intent exists but is not documented or perfectly enforced. |
| Hero top padding under 96px | Fail | `Hero.tsx` uses 124px at md and above. |
| Hero headline at most two lines | Pass | Current English composition is two lines. Arabic needs viewport validation. |
| Hero body under 20 words | Warn | Localization and copy length need a rendered check. |
| No custom cursor | Fail | `CustomCursor` is mounted globally outside Studio. |
| No direct scroll listeners for visual primitives | Fail | Several components attach listeners and read scroll position. |
| Use `min-h-[100dvh]` for full-height shells | Fail | Multiple page shells use `min-h-screen`. |
| Reduced motion at Motion level | Warn | CSS handles some animation; Motion loops are not consistently gated. |
| Navigation fits one line | Warn | Likely crowded at 1280px with all right-side controls. |
| No horizontal overflow | Warn | `overflow-x-hidden` can conceal defects; hero controls and grids need device testing. |
| No decorative text strips | Warn | Live canvas and annotation strips add density; retain only when explanatory. |
| No generic equal-card grid | Fail | Feature grid and pricing are heavily uniform. |
| Robust image fallbacks | Fail | Multiple user/remote image paths lack visible error handling. |
| Accessible modal contract | Warn | Most dialogs use the hook, but consistency and naming need a full keyboard test. |

## Prioritized implementation plan

### First pass: release safety

1. Remove `CustomCursor` from `App.tsx`.
2. Replace full-page `min-h-screen` shells with `min-h-[100dvh]` where appropriate.
3. Build one shared section observer and remove duplicate scroll listeners from marketing components.
4. Re-anchor hero Doodles and performance callouts to the preview stage.
5. Add image fallback and loading behavior to phone, profile, template, testimonial, and demo assets.
6. Normalize visible em-dash and en-dash separators.
7. Complete the dialog focus, label, Escape, and focus-return audit.

### Second pass: responsive and hierarchy

1. Reduce hero top padding and remove the competing ambient glow where it obscures the approved hero artwork.
2. Simplify the live-canvas control on narrow screens.
3. Change narrow template browsing to one column until cards have a safe minimum width.
4. Recompose FeatureGrid into grouped asymmetric capabilities.
5. Give Pro or Studio a deliberate pricing emphasis while keeping Free visually quiet.
6. Add Studio safe-area padding, larger touch targets, and remove editor-wide `select-none`.
7. Reduce Header right-side controls at 1280px with a predictable overflow menu.

### Third pass: polish and performance

1. Gate Motion animations with `useReducedMotion`.
2. Replace decorative multi-color gradients with the documented brand accent system.
3. Lazy-load Studio, analytics, and export modules.
4. Remove the fixed-delay loading overlay where data is not blocking.
5. Standardize icon stroke width and interactive state treatment.
6. Run the responsive matrix and accessibility checklist with real screenshots.

## Validation commands and status

The repository's existing validation baseline is healthy:

- `npm run lint`: previously passing.
- `npm run build`: previously passing, with a warning about a large JavaScript chunk above 600 kB.
- Existing `tsx` test entrypoints: previously passing 16/16 and the module suite passing.
- Browser visual automation: not run in this environment because no Playwright or Puppeteer dependency is installed.

Before implementation begins, run the baseline again, then repeat it after each grouped change. Do not use `overflow-x-hidden` as proof that responsive behavior is fixed. Confirm the layout at each width with screenshots and keyboard interaction.

## Final verdict

RALOA has a strong visual foundation and should receive a targeted evolution, not a full visual rewrite. The most important work is architectural visual hygiene: one scroll model, one responsive preview stage, one modal accessibility contract, one controlled accent system, and real device validation. Once those are fixed, the existing brand assets and creator-focused composition can feel premium without adding more decoration.
