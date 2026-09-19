# UI and interaction contract

**Art direction:** an editorial analytics workspace: clear hierarchy, calm surfaces, one restrained cobalt accent, generous spacing and charts with minimal noise. HeroUI supplies primitives; deliberate typography, layout and state design make the product coherent.

## Theme and identity

- Support light, dark and system via next-themes and HeroUI semantic CSS tokens. Default to system unless a saved preference exists. Keep theme preference in localStorage; never put dataset/session secrets there.
- Use a consistent Lucide Sun/Moon/Monitor control with an accessible label describing the action or selected mode. The UI must work by keyboard and touch, not only tooltip hover.
- Animate icon changes with a short opacity/rotation transition (approximately 150–220 ms). Transition relevant surface/text colors, not every CSS property. Respect reduced motion and avoid full-screen flashes.
- The theme control uses HeroUI toggle buttons with a native View Transition API circular reveal anchored to the pressed control when supported. It falls back to an immediate next-themes update when the API is unavailable or reduced motion is requested. The reveal is limited to the root view transition and does not block theme switching.
- Typography uses `Noto Sans` for interface copy and `Noto Serif Display` for the primary narrative heading through `next/font/google`, with Latin and Cyrillic subsets bundled by Next at build time and `display: swap`. This keeps Russian text readable without a runtime font request.
- Preserve pre-hydration theme application; avoid wrong-theme paint, layout shifts and broad suppression of hydration errors. Chart colors, tooltips, focus rings, empty states and Skeleton must all use theme tokens.
- The DataTale mark combines an open book and rising chart columns in white on the brand blue (#365EDB). Edit the vector source at `public/brand/datatale.svg`; regenerate `src/app/favicon.ico` with 16/32/48/64/128/256 px frames after changes. Keep the single Next.js favicon route. Verify small-size legibility on light and dark backgrounds.
- Use a consistent wordmark, header and metadata title, e.g. `DataTale — Turn data into a story`, with localized product copy if appropriate. Add description and share metadata when production URL is known. Do not expose private report content in publicly fetched social previews.

HeroUI v3 has no mandatory HeroUIProvider. A next-themes ThemeProvider has a separate purpose and is legitimate. Fetch version-matched APIs before implementation.

## Layout and responsiveness

| Element | Desktop | Mobile |
| --- | --- | --- |
| Input | Dropzone, picker and text | Prominent file picker and text; dragging is not required |
| Hero | Wide narrative with adjacent metrics | First item in a single column; no clipped fixed-height text |
| Charts | Up to 2–3 columns when readable | One chart per row; useful height and readable labels |
| Chart details | Pointer and keyboard | Tap/select; important values do not depend on hover |
| Evidence | Table or adjacent panel | Dedicated section/sheet; scrolling contained within table |
| Chat | Below analysis | Below analysis; composer/last message remain visible above keyboard and safe area |

Check 360/390/768/1280/1440 CSS px, a 320px smoke, landscape and 200% zoom. The document must not overflow horizontally. Long filenames, Russian labels and large numbers must not break the layout. Resize the chart container, not just its outer card. Verify the mobile keyboard separately; desktop resizing is not enough.

## Expanded chart view

Each chart card has a top-right Lucide expand button with an accessible label including the chart title and a tooltip. Keep it visible on touch devices and provide an approximately 44px hit target.

Open a large HeroUI modal on desktop and a full-screen dialog on mobile. Show the title, units, legend, interactive chart and access to its rationale/evidence. Resize the chart to the available container; do not enlarge a screenshot. Reuse the same renderer, computed data and controlled filter/legend state. Opening or closing must not trigger analysis, additional AI calls or duplicate report saves.

Provide a visible close button, Escape dismissal, focus containment/restoration and background scroll locking. Preserve the report's scroll position on close. Handle rotation, mobile safe areas, both themes, reduced motion and long labels without page overflow. No browser fullscreen permission or additional modal library is needed.

## Loading, feedback and errors

Use HeroUI Skeleton shaped like the final hero/metric/chart cards to minimize layout shift. Skeletons are placeholders, not the completed layout with invented values. Announce the current stage once; do not repeatedly read decorative skeletons or every streamed token to screen readers.

Show named stages for unknown inference duration. Measured progress percentages require a measurable denominator; an explicitly labeled estimate may use a provisional baseline when it is clearly described as approximate. Make cancel/retry available where meaningful. Avoid artificial waiting to display an animation. Stable empty/error layouts explain the issue and next action without clearing a valid selected file unnecessarily.

Analysis loading uses a determinate HeroUI `ProgressBar` with an explicitly approximate estimate based on provisional live-provider baselines: 22 seconds for tables and 20 seconds for text. A deterministic uneven checkpoint schedule advances from 0 to 95 and holds there when the response is late; after a validated report it presents 100 briefly as an authorized completion feedback beat, then renders the report. This 100% beat is a UI confirmation, not a measurement of server work. Label the percentage as an estimate, keep numeric ticks out of live announcements, and preserve the named session/setup, plan/validation, calculation, and narrative stages. Errors, cancellation, and source replacement must never show 100. Respect reduced motion by removing movement while retaining discrete, understandable state updates.

Use restrained entrance transitions and button/dropzone feedback. A brief completion acknowledgment after a validated response is intentional feedback, even though the percentage before it is only an estimate. Do not stagger large dashboards so long that content becomes slow to access. Reduced-motion mode must preserve all information without movement.

## Guided tour

Use Driver.js with a visible step count, Back/Next, Skip and close controls. Enable keyboard navigation and Escape dismissal. Use four stable demo targets: input, hero/evidence, charts and chat. Wait for the target to mount; if it is unavailable, end cleanly without blocking the page. Distinguish completion, explicit dismissal and lifecycle cleanup.

Style popovers with product tokens in both themes. Use brief spotlight/popover transitions; disable movement under reduced motion. Keep popovers inside the viewport at mobile widths and 200% zoom. Manage focus while open and restore it to the initiating control, or a stable workspace control, on exit. Verify keyboard behavior rather than assuming library defaults are sufficient.

Destroy the tour on unmount/navigation and restore scrolling. React Strict Mode must not create duplicate overlays. Preserve user input and the current report when replaying; show demo content in a temporary view and return to the prior workspace afterward. Persistence and trigger rules: PRODUCT.md.

## Accessibility and visual acceptance

Readable typography, visible focus, sufficient light/dark contrast, touch targets around 44px, semantic headings and labels. Color is not the only encoding. Provide textual/tabular equivalents to charts. Use accessible controls from HeroUI rather than hand-built clickable divs.

Acceptance requires screenshots of ready/loading/error/empty states in both themes and representative mobile/desktop layouts, plus keyboard/touch checks. A passing axe scan alone does not prove good UX or chart accessibility.

Sources: [HeroUI themes](https://heroui.com/docs/react/getting-started/theming), [Skeleton](https://heroui.com/docs/react/components/skeleton), [next-themes](https://github.com/pacocoursey/next-themes).
