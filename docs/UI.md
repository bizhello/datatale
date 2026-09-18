# UI and interaction contract

**Art direction:** an editorial analytics workspace: clear hierarchy, calm surfaces, one restrained cobalt accent, generous spacing and charts with minimal noise. HeroUI supplies primitives; deliberate typography, layout and state design make the product coherent.

## Theme and identity

- Support light, dark and system via next-themes and HeroUI semantic CSS tokens. Default to system unless a saved preference exists. Keep theme preference in localStorage; never put dataset/session secrets there.
- Use a consistent Lucide Sun/Moon/Monitor control with an accessible label describing the action or selected mode. The UI must work by keyboard and touch, not only tooltip hover.
- Animate icon changes with a short opacity/rotation transition (approximately 150–220 ms). Transition relevant surface/text colors, not every CSS property. Respect reduced motion and avoid full-screen flashes.
- Preserve pre-hydration theme application; avoid wrong-theme paint, layout shifts and broad suppression of hydration errors. Chart colors, tooltips, focus rings, empty states and Skeleton must all use theme tokens.
- The DataTale mark combines an open book and rising chart columns in white on the brand blue (#365EDB). Edit the vector source at `public/brand/datatale.svg`; regenerate `src/app/favicon.ico` with 16/32/48/64/128/256 px frames after changes. Keep the single Next.js favicon route. Verify small-size legibility on light and dark backgrounds.
- Use a consistent wordmark, header and metadata title, e.g. `DataTale — Turn data into a story`, with localized product copy if appropriate. Add description and share metadata when production URL is known. Do not expose private report content in publicly fetched social previews.

HeroUI v3 has no mandatory HeroUIProvider. A next-themes ThemeProvider has a separate purpose and is legitimate. Fetch version-matched APIs before implementation.

## Layout and responsiveness

| Element | Desktop | Mobile |
| --- | --- | --- |
| History | Side panel | Accessible drawer/sheet with focus restoration |
| Input | Dropzone, picker and text | Prominent file picker and text; dragging is not required |
| Hero | Wide narrative with adjacent metrics | First item in a single column; no clipped fixed-height text |
| Charts | Up to 2–3 columns when readable | One chart per row; useful height and readable labels |
| Chart details | Pointer and keyboard | Tap/select; important values do not depend on hover |
| Evidence | Table or adjacent panel | Dedicated section/sheet; scrolling contained within table |
| Chat | Below analysis | Below analysis; composer/last message remain visible above keyboard and safe area |

Check 360/390/768/1280/1440 CSS px, a 320px smoke, landscape and 200% zoom. The document must not overflow horizontally. Long filenames, Russian labels and large numbers must not break the layout. Resize the chart container, not just its outer card. Verify the mobile keyboard separately; desktop resizing is not enough.

## Loading, feedback and errors

Use HeroUI Skeleton shaped like the final hero/metric/chart cards to minimize layout shift. Skeletons are placeholders, not the completed layout with invented values. Announce the current stage once; do not repeatedly read decorative skeletons or every streamed token to screen readers.

Show named stages for unknown inference duration. Progress percentages require a measurable denominator. Make cancel/retry available where meaningful. Avoid artificial waiting to display an animation. Stable empty/error layouts explain the issue and next action without clearing a valid selected file unnecessarily.

Use restrained entrance transitions and button/dropzone feedback. Do not stagger large dashboards so long that content becomes slow to access. Reduced-motion mode must preserve all information without movement.

## Guided tour

Use Driver.js with a visible step count, Back/Next, Skip and close controls. Enable keyboard navigation and Escape dismissal. Use four stable demo targets: input, hero/evidence, charts and chat. Wait for the target to mount; if it is unavailable, end cleanly without blocking the page. Distinguish completion, explicit dismissal and lifecycle cleanup.

Style popovers with product tokens in both themes. Use brief spotlight/popover transitions; disable movement under reduced motion. Keep popovers inside the viewport at mobile widths and 200% zoom. Manage focus while open and restore it to the initiating control, or a stable workspace control, on exit. Verify keyboard behavior rather than assuming library defaults are sufficient.

Destroy the tour on unmount/navigation and restore scrolling. React Strict Mode must not create duplicate overlays. Preserve user input and the current report when replaying; show demo content in a temporary view and return to the prior workspace afterward. Persistence and trigger rules: PRODUCT.md.

## Accessibility and visual acceptance

Readable typography, visible focus, sufficient light/dark contrast, touch targets around 44px, semantic headings and labels. Color is not the only encoding. Provide textual/tabular equivalents to charts. Use accessible controls from HeroUI rather than hand-built clickable divs.

Acceptance requires screenshots of ready/loading/error/empty states in both themes and representative mobile/desktop layouts, plus keyboard/touch checks. A passing axe scan alone does not prove good UX or chart accessibility.

Sources: [HeroUI themes](https://heroui.com/docs/react/getting-started/theming), [Skeleton](https://heroui.com/docs/react/components/skeleton), [next-themes](https://github.com/pacocoursey/next-themes).
