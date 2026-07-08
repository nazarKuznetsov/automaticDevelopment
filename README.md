# Codex Automation Guide

Premium static documentation portal and installable repository kit for GitHub-native Codex automation workflows.

The project publishes a GitHub Pages site at:

```text
https://nazarkuznetsov.github.io/automaticDevelopment/
```

Repository:

```text
https://github.com/nazarKuznetsov/automaticDevelopment
```

## What This Contains

- A static Astro documentation portal.
- A lightweight browser-only Three.js Tech Core accent.
- A GitHub Pages deployment workflow.
- An installable workflow kit in `kit/repo/`.
- An optional local installer in `scripts/install-kit.sh`.

## Local Development

```bash
git clone https://github.com/nazarKuznetsov/automaticDevelopment.git
cd automaticDevelopment
npm install
npm run dev
```

## Build

```bash
npm run check
npm run build
npm run preview
```

## Install The Workflow Kit Into Another Repository

Manual install:

```bash
cp -R kit/repo/. /path/to/target-repo/
```

Optional installer:

```bash
scripts/install-kit.sh --target /path/to/target-repo --dry-run
scripts/install-kit.sh --target /path/to/target-repo
```

See `INSTALL.md` for detailed setup.

## Static Hosting

This project is static-only and GitHub Pages-compatible. It does not use a backend, database, API routes, server-side secrets, or authentication.

