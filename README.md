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

- **Multi-Wallet Overview**: Track real-time balances across GCash, Maya, GoTyme, and Cash in one place.
- **Daily Runway Calculator**: Dynamic spendable daily budget calculated from net balance minus reserved bills divided by days until payday.
- **Payment Alert Parser**: Extracts merchant, transaction amount, direction, and category from copied SMS/app payment alerts using pattern recognition.
- **Balance Reconciliation**: One-click balance adjustments that maintain audit history when physical app balances drift.
- **Spending Insights**: Visual categorical spending breakdowns and income vs. expense progress bars.
- **Offline Persistence**: Client-side `localStorage` data persistence with zero external server dependencies.

## Tech Stack

- **Prototype**: HTML5, Vanilla JavaScript, Tailwind CSS v4 CLI
- **Target Application**: ASP.NET Core Blazor, C# (.NET 8 / 10), Tailwind CSS
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
