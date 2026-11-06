# Chester BI — logo kit

<img src="chester-horizontal.svg" alt="Chester BI" height="64" />

**The idea:** the C is a radial bar chart. It is your initial, drawn as data. Its three
bands get shorter toward the centre, standing for model, query and page.

## Files

| File | Use |
|---|---|
| `chester-symbol.svg` | Main mark, amber, on light backgrounds |
| `chester-symbol-dark.svg` | Gold, slightly thinner bands, for dark backgrounds |
| `chester-symbol-black.svg` / `-white.svg` | One-colour versions (the white one is thinned for reversal) |
| `chester-symbol-small.svg` | Small-size cut with two bands, for 16–23 px |
| `chester-horizontal*.svg` | Primary lockup: light, dark, black, white |
| `chester-stacked*.svg` | Stacked lockup for square spaces |
| `export/` | favicon.ico/svg, PNG icons, app icon, maskable icon, webmanifest, `<head>` snippet, PNG lockups |
| `presentation.html` | Presentation board with mockups (open in a browser) |

The app already uses this kit: `frontend/public/` (favicon set), `assets/logo.svg|png` (README)
and `frontend/src/components/CLogo.tsx`, which switches to the small cut below 24 px.

## Colour

| Role | HEX | RGB | CMYK (approx.) | Pantone (nearest, verify on a swatch book) |
|---|---|---|---|---|
| Amber, mark on light | `#D97706` | 217 119 6 | 0 45 97 15 | 1385 C |
| Gold, mark on dark | `#F59E0B` | 245 158 11 | 0 36 96 4 | 137 C |
| Ink, wordmark and dark backgrounds | `#1C1917` | 28 25 23 | 0 11 18 89 | Black 7 C |

Contrast: amber on white is 3.19:1, gold on ink is 8.14:1, so both pass the 3:1 minimum for
graphics. **Never put gold on white (2.15:1).** In the app, use `var(--brand-mark)`, which
switches between amber and gold with the theme.

## Typography

The wordmark is **Geist Sans** (SIL Open Font License, already the app font), outlined into
paths: "Chester" in SemiBold 600, "BI" in Regular 400 and a lighter colour. Don't retype the
wordmark from live text; use the SVG files.

## Clear space and minimum size

- **Clear space:** keep twice the band thickness (≈ 17 % of the symbol's height) free on every side.
- **Symbol:** 24 px or larger uses the full mark; 16–23 px uses `chester-symbol-small.svg`. In print, at least 6 mm.
- **Horizontal lockup:** at least 120 px or 30 mm wide. Below that, use the symbol alone.

## Backgrounds

✅ White, off-white and light greys → amber mark and ink wordmark
✅ Ink or near-black → gold mark and off-white wordmark (`-dark` files)
✅ Photos or busy surfaces → the one-colour white or black versions, or place the logo on an ink tile
❌ Amber or gold backgrounds (the mark disappears); mid-tone backgrounds under 3:1 contrast

## Don't

- Rotate, flip or skew the C. The open side always faces right.
- Change the band lengths or spacing, or add a fourth band.
- Add gradients, shadows, outlines or glows.
- Recolour the bands differently from one another.
- Rebuild the wordmark in another typeface, or change its size relative to the symbol.

## Open items

- Trademark and reverse-image search before public promotion. This kit has not been cleared.
- PDF/EPS masters are not included. Convert from the SVGs in Illustrator or Inkscape if print vendors need them.
