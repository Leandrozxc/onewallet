# One Wallet

[![Deploy to GitHub Pages](https://github.com/Leandrozxc/onewallet/actions/workflows/deploy.yml/badge.svg)](https://github.com/Leandrozxc/onewallet/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/demo-live%20site-teal?style=flat-square)](https://leandrozxc.github.io/onewallet/)

A multi-wallet personal finance tracker designed for Philippine digital wallets and banks (GCash, Maya, GoTyme, Cash).

🔗 **Live Prototype**: [https://leandrozxc.github.io/onewallet/](https://leandrozxc.github.io/onewallet/)

## Overview

One Wallet consolidates fragmented balances into a unified dashboard, calculates daily spending runway until next payday, parses copied payment SMS/notifications, and maintains an offline-first financial ledger.

## Project Documentation

- **[Class Diagram](docs/class-diagram.md)**: Object-oriented domain models, services, page relationships, and architecture blueprint for the Blazor migration.
- **[Code Review](docs/code-review.md)**: In-depth technical evaluation of the prototype codebase, security assessment, data integrity review, and refactoring roadmap.

## Key Features

- **Multi-Account Registration, Switching & Cloud Sync**: Create separate encrypted accounts with custom starting presets (`4 PH Wallets`, `Sample Demo Data`, or `Blank Workspace`), switch accounts seamlessly, and sync across devices via **Supabase Auth & PostgreSQL**.
- **Zero-Knowledge Encrypted Card Vault (`AES-256-GCM`)**: Store 16 Philippine credit/debit card and digital wallet designs (`BDO`, `BPI`, `EastWest`, `Metrobank`, `RCBC`, `UnionBank`, `Maya`, `GoTyme`, `CIMB`, `GCash`, `Cash`). Card numbers, expiry dates, and CVV codes are encrypted in-browser via Web Crypto `PBKDF2-SHA256` + `AES-256-GCM` (`src/vault-cloud.js`) before touching `localStorage` or Supabase PostgreSQL.
- **Real-Time Payday Cycle & Daily Runway Calculator**: Dynamic spendable daily budget calculated from real calendar dates and configurable payday schedules (`15th & 30th Bi-monthly`, `Every 15th`, `Every 30th`, or `Custom target date`).
- **Quarantined Bills & One-Click Bill Settlement**: Set aside upcoming bills from your safe-to-spend balance, and click **Pay bill** to deduct from a chosen wallet, record a `Bills` ledger entry, and clear the quarantined bill in one step.
- **Payment Alert Parser & Full Ledger CRUD**: Extracts merchant, transaction amount, direction, and category from copied SMS/app alerts, with full edit and delete support across wallets, ledger entries, and bills.
- **Balance Reconciliation**: One-click balance adjustments that maintain audit history when physical app balances drift.

## Tech Stack

- **Frontend**: HTML5, Modular Vanilla ES JavaScript (`src/vault-cloud.js`), Tailwind CSS v4 CLI
- **Cryptography**: Web Crypto API (`PBKDF2-SHA256` key derivation + `AES-256-GCM` authenticated encryption)
- **Cloud Backend & Database**: Supabase Auth + PostgreSQL with strict Row-Level Security (`supabase/schema.sql`)
- **Deployment**: GitHub Pages via GitHub Actions

## Getting Started

### 1. Run Live Online
Visit the deployed application at [https://leandrozxc.github.io/onewallet/](https://leandrozxc.github.io/onewallet/).

### 2. Run Locally
Open `index.html` directly in any modern web browser or serve via:
```bash
npx serve .
```

### 3. Build Styles
```bash
npm install
npm run build
```
To run Tailwind in watch mode:
```bash
npm run watch
```
