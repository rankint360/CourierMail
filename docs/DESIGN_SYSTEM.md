# Zavrill design system 1.0

The visual identity is built around clarity, reliable communication, and a recognizable initial. Preview the interactive system at `/design-system` on the application host. It contains downloadable SVG logos, copyable color swatches, type specimens, buttons, statuses, forms, and a sample message row. The component form is a local demonstration and submits no data.

## Color roles

| Token | Color | Role |
| --- | --- | --- |
| `--z-ink` | `#172B46` | Headings, primary text, dark brand surfaces |
| `--z-primary` | `#3159D8` | Primary actions, selected navigation, brand recognition |
| `--z-primary-hover` | `#2344AA` | Primary hover state |
| `--z-primary-soft` | `#EDF2FF` | Selected rows and quiet emphasis |
| `--z-mint` | `#C1EFDF` | Logo fold and occasional brand accents |
| `--z-canvas` | `#F5F7FB` | Application background |
| `--z-surface` | `#FFFFFF` | Reading surfaces, forms, cards |
| `--z-muted` | `#52647B` | Supporting text and icons |
| `--z-border` | `#DCE3EE` | Decorative separators |
| `--z-input-border` | `#7B8CA6` | Visible form-control boundaries |

The main palette is navy, cobalt, and mint. Use neutral surfaces for most of the application so the content has priority. Mint is an accent, not a small-text color on white. Do not use the pale separator color as the sole boundary identifying an input.

Status colors are separate from the brand palette. Success uses `#176747` on `#E8F5EE`, warning uses `#865B0B` on `#FFF5DB`, and error uses `#B13737` on `#FFF0F0`. Include a label or icon with every status. Keep unread, selected, loading, and disabled states distinguishable through more than color alone.

## Logo

The folded Z is a continuous route through the initial, with a mint lower-corner fold inspired by correspondence. It is a brand symbol rather than an SMTP or delivery-status indicator. The symbol remains recognizable at small sizes and fits the safe area of maskable app icons.

| Asset | Use |
| --- | --- |
| `web/brand/mark.svg` | Primary cobalt icon |
| `web/brand/mark-inverse.svg` | Light-tile icon |
| `web/brand/mark-mono.svg` | Single-ink reproduction on white |
| `web/brand/wordmark.svg` | Primary symbol and outlined wordmark |
| `web/brand/wordmark-inverse.svg` | Light lettering for dark surfaces |
| `web/icon.svg` | Browser favicon |
| `web/icon-192.png`, `web/icon-512.png` | Full-bleed maskable installation icons |

Keep clear space of at least one quarter of the symbol width. Use the symbol at 24 px or larger and the complete wordmark at 140 px or larger. Never stretch, rotate, outline, recolor, or decorate the logo. Use the light wordmark on ink and the primary wordmark on white. The SVG wordmarks contain outlined lettering and do not depend on font availability. The standalone marks are transparent outside their rounded tiles. The PNG app icons intentionally extend cobalt to the image edges so the operating system can apply its own mask.

`scripts/export-brand-icons.ps1` regenerates the PNG icons and outlined wordmarks on Windows using built-in drawing APIs. Keep its geometry in sync with the SVG symbol when editing the artwork. Existing raster assets are committed, so Linux builds require no drawing dependency.

## Typography and layout

The application uses DM Sans with system fallbacks. Body text is 16 px, task labels and message subjects are at least 14 px, and timestamps or secondary metadata may use 12 px. Use regular 400 for reading, medium 500 for section headings, and bold 700 for unread content and emphasis. Display text is 48–64 px on wide layouts and 40–44 px on small screens. Product headings are 24–36 px. Body line height is 1.6–1.8.

Spacing follows a 4 px base with 8, 12, 16, 24, 32, and 48 px steps. Small controls use 6 px corners, primary controls 10 px, and larger brand cards 16 px. Primary controls have at least 44 px height. Shadows are reserved for floating UI. Thin neutral separators organize the inbox without competing with messages.

The shared source is `web/design-tokens.css`. Webmail, administration, and the reference page consume the same tokens. Existing organization color settings are retained through the legacy `--green` alias so a customer's chosen primary color remains available. Existing custom colors are not guaranteed to meet the default palette's contrast measurements.

## Components and accessibility

Use a single primary action per interaction area, outline styling for supporting actions, and visible labels for inputs. Invalid fields include specific error text. A 3 px focus ring and offset support keyboard use. Search highlights its container when focused. Reduced-motion preferences disable decorative transitions. Native form validation is retained in the reference component.

Measured default contrast ratios are 14.28:1 for ink on white, 6.06:1 for slate on white, 5.91:1 for white on cobalt, 11.34:1 for ink on mint, and 5.65:1 for slate on canvas. Input borders against white measure 3.42:1. These checks cover the listed color pairs and do not represent a complete accessibility audit of the application.

The default system is light. The inverse logo and dark brand panels are presentation variants; a full dark application theme is not included.

## Voice

Write with direct, calm language. Tell people what happened and what they can do next. Prefer “Domain verified,” “Save draft,” and “Try again” over technical server terminology. Acknowledge pending work, preserve the user's message, and avoid implying guaranteed delivery or security.


## Platform integration

Webmail and business administration use the outlined SVG wordmark. Dark sign-in panels use the inverse wordmark. Custom customer names retain their organization-specific display; default Zavrill organizations retain the Zavrill wordmark. All main HTML entrypoints include SVG, 32 px PNG, ICO, and 180 px Apple touch icons. The icons are versioned for browser cache refresh, and the service worker caches the platform wordmarks and favicon assets. Existing browser mail data remains intact.
