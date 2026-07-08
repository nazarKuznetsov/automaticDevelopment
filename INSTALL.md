# Install Codex Automation Guide

Use this repository to bootstrap GitHub-native Codex automation in another repository.

## Links

- Repository: <https://github.com/nazarKuznetsov/automaticDevelopment>
- GitHub Pages: <https://nazarkuznetsov.github.io/automaticDevelopment/>
- Clone URL: <https://github.com/nazarKuznetsov/automaticDevelopment.git>
- GitHub CLI: <https://cli.github.com/>
- GitHub Pages with Actions: <https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>

## Manual Install

Clone this repository:

```bash
git clone https://github.com/nazarKuznetsov/automaticDevelopment.git
cd automaticDevelopment
```

Copy the kit into your target repository:

```bash
cp -R kit/repo/. /path/to/target-repo/
```

Then open the target repository in Codex App and run:

```text
Use $github-agent-orchestrator to bootstrap the GitHub-native agent workflow for this repository.
First run a repo audit, then produce the Project Intake Packet and GitHub Setup Packet.
Do not launch Workers until setup verification passes.
```

## Optional Installer

Preview changes:

```bash
scripts/install-kit.sh --target /path/to/target-repo --dry-run
```

Install:

```bash
scripts/install-kit.sh --target /path/to/target-repo
```

Overwrite existing kit files only when you intentionally want to refresh them:

```bash
scripts/install-kit.sh --target /path/to/target-repo --force
```

## Required Target Repository Setup

The target repository should have:

- GitHub Issues enabled.
- GitHub Actions enabled.
- GitHub Project v2 available.
- `gh` authenticated with enough repository and Project scopes.
- Codex App running locally for thread/worktree orchestration.

Verify GitHub CLI access:

```bash
gh auth status
```

## First Pilot

The first pilot should be workflow setup plus one low-risk issue:

```text
Issue -> Ready Queue -> Worker branch -> Pull Request with Closes #issue -> evidence -> Review/Done
```

