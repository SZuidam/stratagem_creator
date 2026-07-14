# Stratagem Creator

A single-page, zero-dependency web app for designing custom **Warhammer 40,000** stratagem
cards and printing them on an A4 sheet (or saving as PDF). Everything runs client-side in the
browser — no build step, no server, no frameworks.

## Purpose

Users create card-style stratagems that mimic the look of official 40k stratagem cards
(coloured rail, CP diamond, WHEN / TARGET / EFFECT sections) and lay them out in a clean
two-column A4 print layout. Content is edited inline directly on the cards.

## Tech stack

- **Plain HTML + CSS + vanilla JS** (ES5-style, IIFE, `"use strict"`). No dependencies, no
  bundler, no package.json.
- **Persistence:** browser `localStorage` (cards under `stratagem-creator/v1`; the detachment
  header under `stratagem-creator/meta/v1`).
- **Portability:** JSON import/export of the full card set.
- **Printing:** native `window.print()` with a dedicated `@media print` stylesheet.

## Files

| File          | Role                                                                        |
|---------------|-----------------------------------------------------------------------------|
| `index.html`  | Structure — toolbar, A4 `.page`, and the `<template id="cardTemplate">` used to clone each card. |
| `app.js`      | All logic — model, rendering, event wiring, persistence, import/export.     |
| `styles.css`  | Screen editing UI + A4 preview, three colour themes, and the print layout.  |

> Note: `bash.exe.stackdump` in the root is an unrelated crash artifact, not part of the app.
> The repo has a `.git` folder but no commits yet.

## Data model

The app holds an in-memory `model` — an array of stratagem objects. Each object:

```js
{
  id:       "s1",      // runtime-only, reassigned on load/import
  color:    "green",   // one of: "red" | "green" | "blue"
  cp:       1,         // command points (integer >= 0)
  title:    "",
  subtitle: "",        // e.g. "FACTION — STRATAGEM TYPE"
  lore:     "",        // italic flavour text
  when:     "",
  target:   "",
  effect:   ""
}
```

Editable text fields are defined once in `FIELDS = ["title","subtitle","lore","when","target","effect"]`.

Separately, a `meta` object holds the sheet header — `{ detachment: "", image: "" }` — where
`detachment` is the editable title text and `image` is an uploaded image stored as a data URL.
It is persisted independently under `stratagem-creator/meta/v1`.

## How it works (app.js)

- **Init** (`init`, on `DOMContentLoaded`): loads from localStorage; if empty, seeds one
  `sampleStratagem()` ("Shock Bombardment"). Reassigns fresh ids and sanitises `color`/`cp`.
- **Rendering** (`createCard`/`renderAll`): clones the `<template>`, fills `[data-field]`
  elements, applies the `theme-<color>` class, sets the CP diamond, marks the active swatch,
  and wires events.
- **Editing** (`wireCard`): `contenteditable` fields sync to the model on `input`; paste is
  forced to plain text via `execCommand("insertText")`. Colour swatches, the CP number input,
  and a per-card **Remove** button all update the model and save.
- **Detachment header** (`renderHeader`/`wireHeader`): an editable `contenteditable` title
  and an image centred between two lines (`—— <image> ——`). The upload button reads the file
  as a data URL (`readHeaderImage`) into `meta.image`; a Remove button clears it. Both the
  title and image persist via `saveMeta` (debounced) and are hidden-controls in print.
- **Persistence** (`save`): debounced (200 ms) write of `model` to localStorage.
- **Toolbar actions**: `+ Add stratagem`, `Print / Save as PDF`, `Export JSON`
  (downloads `stratagems.json`), `Import JSON` (validates array, remaps fields).

## Styling (styles.css)

- **Themes** via CSS custom properties: `.theme-red/green/blue` set `--c-main`, `--c-dark`,
  `--c-soft`.
- **Card anatomy:** left `.rail` (coloured band) with a rotated `.diamond-cp` showing `CP`;
  `.body` with title / subtitle / italic lore / WHEN·TARGET·EFFECT sections separated by
  solid and dotted `.rule` dividers.
- **A4 metrics** as variables (`--page-w: 210mm`, `--page-pad`, `--col-gap`); cards flow in a
  2-column layout using `column-count: 2` with `break-inside: avoid`.
- **Print** (`@media print`): hides all `.no-print` UI, strips page shadow/margins, forces
  colour with `print-color-adjust: exact`, keeps the two-column layout.

## Running

Open `index.html` directly in a browser — no server or build needed. Edit cards inline,
then use **Print / Save as PDF**.

## Possible extensions

- Multi-page / page-break handling for large card sets.
- More themes or custom colours.
- Reordering (drag-and-drop) of cards.
- An initial git commit (repo currently has no history).
