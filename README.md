# <img src="assets/logo.png" alt="One Wallet Logo" width="38"> One Wallet

[![Deploy to GitHub Pages](https://github.com/Leandrozxc/onewallet/actions/workflows/deploy.yml/badge.svg)](https://github.com/Leandrozxc/onewallet/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/demo-live%20site-teal?style=flat-square)](https://leandrozxc.github.io/onewallet/)

An offline-first personal finance passbook, payday runway calculator, and client-encrypted card vault built for Philippine digital wallets and banks (`GCash`, `Maya`, `GoTyme`, `BDO`, `BPI`, `UnionBank`, `Metrobank`, `RCBC`, `EastWest`, `CIMB`, `Cash`).

🔗 **Live Application**: [https://leandrozxc.github.io/onewallet/](https://leandrozxc.github.io/onewallet/)

## Key Capabilities

- **Integer-Centavo Financial Precision**: Fixed-point centavo arithmetic (`src/money.js`, `src/domain.js`) eliminates IEEE-754 floating-point drift across balances, ledger edits, bill settlements, reconciliations, and cashflow insights.
- **Payday Runway & Bill Shortfall Engine**: Calculates daily safe-to-spend allowance across `15th & 30th Bi-monthly`, `Every 15th`, `Every 30th / month-end`, and `Custom target date` schedules—accounting for leap years, today's spending pace, and underfunded bill shortfalls.
- **Zero-Knowledge Encrypted Card Vault (`AES-256-GCM`)**: Optional card numbers, expiry dates, and CVV codes are encrypted in-browser via Web Crypto `PBKDF2-SHA256` (`600,000` iterations with domain-separated authentication and vault salts) + `AES-256-GCM`, and auto-masked whenever the window loses focus. Cardless wallets (`Cash`, passbook e-wallets) never fabricate placeholder card numbers.
- **Verified SMS / Notification Import**: Provider-aware parser (`src/alert-parser.js`) for Philippine e-wallets and banks with editable preview fields, reference-number duplicate detection, and automatic rejection of OTPs, failed/declined alerts, and balance inquiries.
- **Quarantined Bills & Partial / Recurring Settlement**: Reserve upcoming bills before payday, settle full or partial payments atomically into the ledger, and roll monthly/bi-monthly bills forward automatically.
- **Searchable Ledger, Category Limits & Data Portability**: Filter entries by search query, wallet, category, type, and timeframe; configure category spending caps; export RFC-4180 CSV statements; and download/restore JSON workspace backups.
- **Resilient Supabase Sync**: Transactional PostgreSQL RPC (`supabase/schema.sql`) with non-destructive upsert-first fallback, automatic JWT refresh, and offline pending-sync retry.

## Architecture

- `src/money.js` — Integer-centavo currency math, formatting, and input validation
- `src/domain.js` — Payday/runway math, atomic ledger/wallet/bill operations, insights, and CSV/JSON portability
- `src/alert-parser.js` — Philippine payment SMS & notification parser with confidence and duplicate checks
- `src/vault-cloud.js` — Domain-separated `PBKDF2-SHA256` + `AES-256-GCM` vault, multi-account store, and Supabase sync
- `src/cards.js` — Vector Philippine bank & e-wallet card art and masking rules
- `src/app.js` — State controller, route auth guards, delegated event listeners, and passbook views
- `supabase/schema.sql` — PostgreSQL schema, Row-Level Security policies, and `sync_user_workspace` ACID RPC

## Getting Started

```bash
npm install
npm run build   # Compile Tailwind CSS v4 into dist/output.css
npm test        # Run automated financial, parser, security, and sync tests
npx serve .     # Serve locally (or open index.html directly)
```
