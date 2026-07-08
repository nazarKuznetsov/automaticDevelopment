#!/usr/bin/env bash
set -euo pipefail

TARGET=""
DRY_RUN="false"
FORCE="false"

usage() {
  cat <<'USAGE'
Usage: scripts/install-kit.sh --target /path/to/repo [--dry-run] [--force]

Copies the Codex Automation Guide kit from kit/repo/ into a target repository.

Options:
  --target PATH   Target repository root.
  --dry-run       Print actions without copying files.
  --force         Allow overwriting existing files.
  -h, --help      Show this help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --force)
      FORCE="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "Missing --target" >&2
  usage
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
KIT_DIR="$REPO_ROOT/kit/repo"
TARGET_DIR="$(cd "$TARGET" && pwd -P)"

if [[ ! -d "$KIT_DIR" ]]; then
  echo "Kit directory not found: $KIT_DIR" >&2
  exit 1
fi

if [[ ! -d "$TARGET_DIR/.git" ]]; then
  echo "Target does not look like a git repository root: $TARGET_DIR" >&2
  exit 1
fi

KIT_FILES=()
while IFS= read -r file; do
  KIT_FILES+=("$file")
done < <(cd "$KIT_DIR" && find . -type f | sed 's#^\./##' | sort)

if [[ "$FORCE" != "true" ]]; then
  for file in "${KIT_FILES[@]}"; do
    if [[ -e "$TARGET_DIR/$file" ]]; then
      echo "Refusing to overwrite existing file without --force: $file" >&2
      exit 1
    fi
  done
fi

echo "Source kit: $KIT_DIR"
echo "Target repo: $TARGET_DIR"
echo "Files: ${#KIT_FILES[@]}"

for file in "${KIT_FILES[@]}"; do
  echo "  $file"
done

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run complete; no files copied."
  exit 0
fi

for file in "${KIT_FILES[@]}"; do
  mkdir -p "$TARGET_DIR/$(dirname "$file")"
  cp "$KIT_DIR/$file" "$TARGET_DIR/$file"
done

echo "Kit installed. Review changes, then run gh auth status and start Codex with \$github-agent-orchestrator."
