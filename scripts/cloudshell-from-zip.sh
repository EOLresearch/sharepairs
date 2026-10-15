#!/usr/bin/env bash
# Unpack the newest CloudShell zip in ~ and run the full study deploy.
#
# One-time setup (CloudShell):
#   cat > ~/deploy-simpatico.sh <<'EOF'
#   ...paste this file's contents...
#   EOF
#   chmod +x ~/deploy-simpatico.sh
#
# Every deploy after that:
#   1. Actions → Upload file → Desktop sharepairs-cloudshell*.zip
#      (any name is fine; duplicates like "sharepairs-cloudshell (1).zip" are OK)
#   2. bash ~/deploy-simpatico.sh
#
set -euo pipefail

cd ~
ZIP="$(ls -t sharepairs-cloudshell*.zip simpatico-cloudshell*.zip 2>/dev/null | head -1 || true)"
if [ -z "${ZIP:-}" ]; then
  echo "No CloudShell zip found in ~."
  echo "Upload Desktop/sharepairs-cloudshell*.zip via Actions → Upload file, then re-run:"
  echo "  bash ~/deploy-simpatico.sh"
  exit 1
fi

echo "============================================"
echo " Using zip: $ZIP"
echo "============================================"

rm -rf sharepairs
mkdir sharepairs
unzip -o "$ZIP" -d sharepairs
cd sharepairs
chmod +x scripts/*.sh
./scripts/cloudshell-deploy.sh
