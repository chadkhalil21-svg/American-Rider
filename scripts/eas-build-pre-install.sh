#!/usr/bin/env bash
# EAS build hook (package.json "eas-build-pre-install"): stamp the commit into the build.
#
# EAS knows the commit it is building (EAS_BUILD_GIT_COMMIT_HASH). Expo CLI reads .env.local
# when it embeds the JavaScript bundle, so writing the value there makes it available to
# src/config.ts as EXPO_PUBLIC_COMMIT — the same stamp scripts/build-simulator.sh gives a
# simulator build. Without this, a TestFlight build cannot say what it was made from.
set -euo pipefail
if [ -n "${EAS_BUILD_GIT_COMMIT_HASH:-}" ]; then
  printf 'EXPO_PUBLIC_COMMIT=%s\nEXPO_PUBLIC_BUILD_STAMP=ar-commit:%s\n' "$EAS_BUILD_GIT_COMMIT_HASH" "$EAS_BUILD_GIT_COMMIT_HASH" >> .env.local
  echo "Stamped EXPO_PUBLIC_COMMIT=$EAS_BUILD_GIT_COMMIT_HASH"
else
  echo "EAS_BUILD_GIT_COMMIT_HASH is not set; the build will be unstamped" >&2
fi
