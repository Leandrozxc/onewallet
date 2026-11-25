---
name: One Wallet
description: Achromatic passbook ledger and client-encrypted Philippine bank card vault
colors:
  paper: "#F6F7F9"
  card: "#FFFFFF"
  subtle: "#F1F3F6"
  line: "#E2E6ED"
  track: "#E5E9F0"
  scrollbar: "#CBD5E1"
  selection: "#DBEAFE"
  ink: "#0F172A"
  ink-2: "#334155"
  mute: "#475569"
  accent: "#1D5FBF"
  marigold: "#D97706"
  gain: "#15803D"
  alert: "#B91C1C"
typography:
  display:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "42px"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  display-mobile:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  display-wallet:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  headline-mobile:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  input:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  card-meta:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  card: "10px"
  ctl: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.ctl}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    height: "40px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "{colors.alert}"
    textColor: "{colors.card}"
    rounded: "{rounded.ctl}"
    height: "40px"
    padding: "0 16px"
---

# Design System: One Wallet

## Overview

**Creative North Star: "The Achromatic Passbook & Tactile Card Vault"**

One Wallet treats personal cashflow like a crisp physical bank passbook paired with an encrypted card folio. The workspace defaults to calm, high-contrast ledger paper and structural 1px hairline borders so daily allowance figures, quarantined bills, and transaction histories scan effortlessly. Rich color is reserved strictly for two jobs: semantic financial signals (income gain vs. validation alert) and the tactile bank and digital wallet card faces inside the encrypted vault.

**Key Characteristics:**
- Structural 1px borders (`--color-line`) over decorative drop shadows.
- Mandatory tabular numerals (`font-variant-numeric: tabular-nums`) on every currency figure, percentage, date, countdown, and card number.
- Tactile Philippine bank and e-wallet card art (`BDO`, `BPI`, `EastWest`, `Metrobank`, `RCBC`, `UnionBank`, `Maya`, `GoTyme`, `CIMB`, `GCash`, `Cash`) with vector EMV chips, NFC waves, and network badges.

## Colors

An achromatic slate-and-paper ledger palette where semantic hues appear only when financial state demands attention.

### Primary
- **Passbook Ink** (`--color-ink`): Primary text, active navigation indicators, primary action buttons, and free-to-spend progress bars.
- **Ledger Cobalt** (`--color-accent`): Caret indicator and interactive focus accents.

### Secondary
- **Credit Emerald** (`--color-gain`): Positive cashflow inflows (`+ ₱...`), runway status indicator dot, and money-in progress bars.
- **Quarantine Crimson** (`--color-alert`): Destructive actions, form validation errors, and alert callouts.
- **Caution Marigold** (`--color-marigold`): Reserved warning states.

### Neutral
- **Ledger Paper** (`--color-paper`): Root application canvas.
- **Passbook Sheet** (`--color-card`): Elevated card, sidebar, header, and modal surfaces.
- **Tonal Well** (`--color-subtle`): Segmented tablist wells, avatar circles, and subtle hover backgrounds.
- **Hairline Rule** (`--color-line`): 1px structural borders and row dividers.
- **Meter Track** (`--color-track`): Unfilled progress bar tracks.
- **Secondary Slate** (`--color-ink-2`): Supporting body copy, ledger descriptions, and inactive navigation links.
- **Muted Caption** (`--color-mute`): Timestamps, metadata captions, and helper hints.

### Named Rules
**The Financial Signal Rule.** Outside the tactile bank card faces, chromatic color (`gain`, `alert`) never decorates containers or backgrounds; it marks positive inflows, errors, or destructive actions only.

## Typography

**Display & Body Font:** `IBM Plex Sans` (with `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` fallback)

**Character:** Engineered, legible grotesque with crisp tabular numerals (`tnum`) suited for dense financial statements and embossed card numbers.

### Hierarchy
- **Display** (`600`, `38px–42px`, `1.08`, `-0.025em`): Daily safe-to-spend hero figure and individual wallet balance readout.
- **Headline** (`600`, `22px–24px`, `1.25`, `-0.015em`): Page header titles (`Today`, `Wallets & Cards`, `Ledger`).
- **Title** (`600`, `16px`, `1.4`, `-0.01em`): Section card headings and wallet card titles.
- **Body** (`400–500`, `14px–15px`, `1.5`): Ledger rows, form inputs, and explanatory copy.
- **Label** (`500–600`, `12px`, `1.4`): Metadata, date group headers, and filter pills.

### Named Rules
**The Tabular Numeral Rule.** Every peso amount, percentage, countdown, date, and card number must carry `.tnum` (`font-variant-numeric: tabular-nums`) so vertical columns and live reveals never jitter horizontally.

## Layout

- **Desktop (`>= 768px`)**: Sticky horizontal top `<header>` navigation (`48px` height, `1px` `border-line` bottom rule) + centered fluid passbook column capped at `max-w-[1160px]` (`24px` horizontal padding).
- **Mobile (`< 768px`)**: Compact top status header + single-column content (`16px` horizontal padding, `96px` bottom clearance) + fixed 5-tab bottom navigation bar (`60px` height + `env(safe-area-inset-bottom)`).
- **Dashboard & Wallets Grid**: Asymmetric 2-column split on desktop (`1.28fr 1fr` on Today, `2` equal columns on Wallets & Cards Grid) collapsing cleanly to a single vertical stack on narrow viewports.

## Elevation & Depth

Surfaces are flat by default and separated by 1px hairline borders (`border-line`) and subtle tonal contrast (`bg-paper` vs. `bg-card` vs. `bg-subtle`). Modal dialogs use a `bg-ink/40` backdrop scrim with a `160ms cubic-bezier(0.23, 1, 0.32, 1)` entrance (`dialog-in`), falling back to a non-spatial `120ms` fade under `prefers-reduced-motion: reduce`.

### Named Rules
**The Hairline-First Rule.** Never use drop shadows to separate cards on the passbook canvas; 1px `border-line` borders and `bg-paper`/`bg-card` contrast define all surface boundaries.

## Shapes

- **Cards & Dialogs**: `10px` border radius (`rounded-card`), bottom-sheet rounded top corners on mobile (`rounded-t-card`).
- **Controls, Inputs & Mini Card Swatches**: `8px` border radius (`rounded-ctl`).
- **Filter Chips & Sample Pills**: Full pill radius (`rounded-full`).

## Components

### Buttons
- **Shape:** Gently rounded control corners (`8px` radius, `40px` height).
- **Primary (`C.btn`):** Passbook Ink background (`#0F172A`), white text, `hover:bg-ink-2`, `active:scale-[0.98]`, `disabled:opacity-60`.
- **Secondary (`C.btn2`):** White card background (`#FFFFFF`), 1px `border-line` stroke, `hover:bg-subtle`.
- **Icon Buttons (`C.iconBtn`):** `36px` square on fine desktop pointers, expanding to `44x44px` (`touch-target`) on coarse/mobile pointers.

### Chips & Radio Filters
- **Style:** Pill-shaped (`rounded-full`, `36px` height on desktop, `40px+` on coarse pointers via `.touch-pill`).
- **State:** Active radio chip uses Passbook Ink fill (`bg-ink text-card`); inactive chips use `bg-card text-ink-2 border-line`. Supports `ArrowLeft`/`ArrowRight` roving keyboard navigation.

### Cards / Containers
- **Corner Style:** `10px` (`rounded-card`).
- **Background:** `#FFFFFF` (`bg-card`) over `#F6F7F9` (`bg-paper`).
- **Border:** 1px solid `#E2E6ED` (`border-line`).
- **Internal Padding:** `16px–20px` (`p-4` to `p-5`).

### Inputs / Fields
- **Style:** `40px` height, `12px` horizontal padding, `15px` text, 1px `border-line` on `#FFFFFF`.
- **Focus:** `focus:border-ink focus:ring-1 focus:ring-ink`.
- **Error:** `aria-[invalid=true]:border-alert` paired with an inline `text-xs text-alert` message linked via `aria-describedby`.

### Encrypted Bank Card Face (`renderCardFace`)
- **Structure:** Full-bleed header inside wallet cards featuring issuer brand typography, tier badge, SVG EMV metallic chip, contactless NFC waves, `AES-256-GCM` encryption status label, masked/revealed 16-digit card number (`•••• •••• •••• 4821`), expiry, CVV, cardholder name, and vector network mark (`Mastercard`, `Visa`, `JCB`, `Passbook`).

## Do's and Don'ts

### Do:
- **Do** apply `.tnum` to all monetary values, percentages, dates, and card numbers.
- **Do** encrypt card numbers, expiry dates, and CVV codes via `OWVault.buildEncryptedWallet` (`AES-256-GCM`) before persisting to `localStorage` or Supabase.
- **Do** maintain `>= 4.5:1` text contrast across both passbook surfaces and custom bank card faces.
- **Do** keep coarse-pointer touch targets at `44x44px` minimum using `.touch-target` and `.touch-pill`.

### Don't:
- **Don't** add decorative drop shadows, glassmorphism blurs, or gradient text to ledger cards.
- **Don't** use stock uncalibrated framework palettes or `example.com` placeholder emails.
- **Don't** store plaintext 16-digit card numbers or CVV codes in `localStorage` or Supabase PostgreSQL.
