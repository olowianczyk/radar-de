#!/usr/bin/env bash
# deploy-de.sh — build and ship the GERMAN instance (Rechtsradar) to its own hosting.
#
#   scripts/deploy-de.sh              DRY RUN (default): builds, lints, stages, shows what rsync would send
#   scripts/deploy-de.sh --go         really uploads. Use ONLY after the owner's explicit confirmation.
#   scripts/deploy-de.sh --rollback   points `current` back to the previous release (needs --go to act)
#   scripts/deploy-de.sh --help
#
# Remote layout (DEPLOY_ROOT):  releases/<UTC timestamp>/  and  current -> releases/<ts>
# Point the hosting's docroot at DEPLOY_ROOT/current. Data and secrets are NOT here: they live in
# ~/private (hrbp/, hrbp-config.php, smtp.php) and are never touched by this script.
# Config comes from .deploy.env (git-ignored; template: .deploy.env.example) — no hosts/keys in the repo.
set -euo pipefail
cd "$(dirname "$0")/.."
MODE=dry; ROLLBACK=0
for a in "$@"; do case "$a" in
  --go) MODE=go;; --rollback) ROLLBACK=1;;
  --help|-h) sed -n 2,12p "$0"; exit 0;;
  *) echo "unknown option $a (see --help)"; exit 2;; esac; done

[ -f .deploy.env ] && . ./.deploy.env
: "${KEEP_RELEASES:=5}"; : "${DEPLOY_PORT:=22}"
if [ "$MODE" = go ] || [ "$ROLLBACK" = 1 ]; then
  for v in DEPLOY_HOST DEPLOY_USER DEPLOY_KEY DEPLOY_ROOT; do [ -n "${!v:-}" ] || { echo "missing $v (set it in .deploy.env)"; exit 2; }; done
fi
SSH=(ssh -p "${DEPLOY_PORT}" -i "${DEPLOY_KEY:-/dev/null}" -o IdentitiesOnly=yes -o BatchMode=yes "${DEPLOY_USER:-u}@${DEPLOY_HOST:-h}")

# ---- rollback: only flips the symlink to the release before the current one -------------------
if [ "$ROLLBACK" = 1 ]; then
  CMD='cd "$1/releases" && cur=$(basename "$(readlink ../current)") && prev=$(ls -1 | grep -v "^$cur$" | sort | tail -1) && [ -n "$prev" ] && ln -sfn "releases/$prev" ../current.new && mv -Tf ../current.new ../current && echo "current -> $prev"'
  if [ "$MODE" = go ]; then "${SSH[@]}" bash -c "'$CMD'" _ "$DEPLOY_ROOT"; else echo "DRY RUN: would roll back 'current' on the server (add --go)"; fi
  exit 0
fi

# ---- 1. PHP syntax check before anything leaves the machine -----------------------------
if command -v php >/dev/null; then
  for f in server/php/index.php server/php/i18n.php server/php/smtp.example.php; do php -l "$f" >/dev/null; done
  echo "php -l OK"
else
  echo "WARN: no local php — syntax NOT checked (install php8.3-cli); a broken file would be uploaded"
  [ "$MODE" = go ] && { echo "refusing --go without a php lint"; exit 1; }
fi

# ---- 2. build the German frontend -------------------------------------------------------------------
( cd app && npm run build:de >/dev/null )
echo "build:de OK"

# ---- 3. stage the release tree --------------------------------------------------------------------------
TS=$(date -u +%Y%m%d-%H%M%S); STAGE=$(mktemp -d); trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/app" "$STAGE/api"
cp -r app/dist/. "$STAGE/app/"
cp server/php/index.php server/php/i18n.php server/php/sources.de.json "$STAGE/api/"
cp server/php/htaccess.radar "$STAGE/.htaccess"
# The PL root page (index.html) is a Polish intro: the DE site opens the app directly instead.
printf '%s\n' '<!doctype html><html lang="de"><meta charset="utf-8"><title>Rechtsradar</title><meta http-equiv="refresh" content="0;url=app/"><a href="app/">Rechtsradar</a></html>' > "$STAGE/index.html"
echo "staged release $TS ($(find "$STAGE" -type f | wc -l) files)"

# ---- 4. upload (dry-run by default) ---------------------------------------------------------------------
if [ "$MODE" != go ]; then
  echo "DRY RUN — nothing sent. Files that would be uploaded:"; (cd "$STAGE" && find . -type f | sort | sed 's/^/  /')
  echo "Run with --go only after the owner confirmed the deployment."; exit 0
fi
RSYNC_SSH="ssh -p $DEPLOY_PORT -i $DEPLOY_KEY -o IdentitiesOnly=yes -o BatchMode=yes"
REL="$DEPLOY_ROOT/releases/$TS"
"${SSH[@]}" mkdir -p "$REL"
rsync -az -e "$RSYNC_SSH" "$STAGE"/ "$DEPLOY_USER@$DEPLOY_HOST:$REL/"
# atomic switch: build the new symlink beside the old one, then rename over it
"${SSH[@]}" bash -c "'cd \"$DEPLOY_ROOT\" && ln -sfn releases/$TS current.new && mv -Tf current.new current && cd releases && ls -1 | sort | head -n -$KEEP_RELEASES | xargs -r rm -rf'"
echo "deployed $TS -> $DEPLOY_ROOT/current"
