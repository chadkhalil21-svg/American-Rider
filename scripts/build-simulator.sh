#!/usr/bin/env bash
# Build the release candidate for the iOS Simulator the way EAS builds it for TestFlight:
# Release configuration, the production API, the commit stamped in — then install it over the
# app on every booted simulator (an install over the same bundle id keeps the signed-in
# session) and relaunch. No EAS credit is spent. Measured: about eight minutes.
#
#   npm run build:sim                      # HEAD, production API
#   EXPO_PUBLIC_API_URL=http://localhost:4242 npm run build:sim   # a build for local backend work
#
# Why prebuild --clean every time: a `pod install` after a Release build strips the marker
# React Native uses to know which prebuilt core is on disk, and the next build links the
# wrong one ("Undefined symbols ... Sealable"). A clean prebuild is 22 seconds and cures it.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 CI=1

# BUILD_REF=<commit> builds THAT commit instead of the working tree — the way to put the exact
# TestFlight build on a simulator: the commit EAS records for it, compiled here for free. The
# commit is checked out into a sibling worktree (a path with no space in it, see AGENTS.md)
# with its own node_modules, so the working tree is never disturbed.
if [ -n "${BUILD_REF:-}" ]; then
  COMMIT=$(git rev-parse --verify "${BUILD_REF}^{commit}")
  WT="$ROOT-build-$(git rev-parse --short "$COMMIT")"
  if [ ! -d "$WT" ]; then git worktree add --detach "$WT" "$COMMIT" >/dev/null; fi
  (cd "$WT" && git checkout --detach -q "$COMMIT")
  if [ ! -d "$WT/node_modules" ]; then (cd "$WT" && npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null 2>&1); fi
  [ -f "$ROOT/backend/.env" ] && [ ! -f "$WT/backend/.env" ] && cp "$ROOT/backend/.env" "$WT/backend/.env"
  cd "$WT"
  DIRTY=0
else
  COMMIT=$(git rev-parse HEAD)
  DIRTY=$(git status --porcelain | wc -l | tr -d ' ')
fi
API="${EXPO_PUBLIC_API_URL:-https://american-rider-server.onrender.com}"
BUNDLE_ID="com.americanrider.app"
LOG="${LOG:-$HOME/Library/Logs/american-rider-build-simulator.log}"
mkdir -p "$(dirname "$LOG")"

# iPhones only. Operators and travelers use phones; an iPad booted for something else must not
# receive the app and be counted as a device we verify (founders, 10 Sept 2026).
booted() { xcrun simctl list devices booted | grep -E '^\s*iPhone' | grep -oE '[0-9A-F-]{36}'; }
TARGET="${SIM_DEVICE:-$(booted | head -1)}"
if [ -z "$TARGET" ]; then echo "No booted simulator. Boot one: xcrun simctl boot 'iPhone 17'" >&2; exit 1; fi

echo "Building $COMMIT (${DIRTY} uncommitted files) for $API on $TARGET; log: $LOG"
# THE TRANSFORM CACHE IS PURGED FIRST. Metro caches each file's transformed output, and the
# inlined EXPO_PUBLIC_* values live inside that output. A src/config.ts identical to one
# transformed earlier for a localhost build was served from cache with localhost inside it,
# ignoring the environment of this build entirely (7dae837, 10 Sept 2026). Nothing in the
# bundling flags cleared it; deleting the cache does.
rm -rf "${TMPDIR:-/tmp}"/metro-* /tmp/metro-* "${TMPDIR:-/tmp}"/haste-map-* node_modules/.cache/metro* 2>/dev/null || true
npx expo prebuild --clean -p ios >> "$LOG" 2>&1

# THE ENTITLEMENTS THAT ONLY MEAN SOMETHING ON A DEVICE ARE STRIPPED FOR THE SIMULATOR.
# Adding Sign In with Apple (13 Sept 2026) put com.apple.developer.applesignin in the
# generated project, and Xcode then refused to build at all: "No code signing certificates
# are available to use." A capability entitlement requires a provisioning profile that
# carries it, and the signing identity for this bundle id lives in Chad's Individual
# membership, not on this Mac. The simulator needs none of it — Apple's own docs say Apple
# sign-in does not fully work there anyway — so the device-only capabilities come out of the
# simulator copy and the TestFlight build, which EAS signs properly, keeps all of them.
ENT=ios/AmericanRider/AmericanRider.entitlements
if [ -f "$ENT" ]; then
  for KEY in com.apple.developer.applesignin com.apple.developer.in-app-payments aps-environment; do
    /usr/libexec/PlistBuddy -c "Delete :$KEY" "$ENT" 2>/dev/null || true
  done
  echo "Stripped device-only entitlements from the simulator build" >> "$LOG"
fi
# THE ENVIRONMENT IS WRITTEN WHERE XCODE READS IT. The bundle is embedded by Xcode's own
# "Bundle React Native code and images" phase, which sources ios/.xcode.env.local. Passing
# the variables on the command line reached that phase in some builds and not others (a
# 7dae837 build came out pointed at localhost with nothing in the shell to explain it), so
# they are written into the file the phase is guaranteed to read, and the result is checked.
{
  echo "export EXPO_PUBLIC_COMMIT=$COMMIT"
  echo "export EXPO_PUBLIC_BUILD_STAMP=ar-commit:$COMMIT"
  echo "export EXPO_PUBLIC_API_URL=$API"
  echo "export EXPO_PUBLIC_SSO_PREVIEW=${SSO_PREVIEW:-}"
  # THE SIGN-IN CLIENT IDS COME FROM eas.json, so a simulator build and a TestFlight build
  # cannot disagree about them. They are public values — they identify the app to Google and
  # are readable in any binary — which is why they live in build config rather than a secret
  # store, and why reading them here is safe. Absent, the control hides itself rather than
  # appearing and failing, so an unconfigured build is simply a build without that button.
  echo "export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=$(node -p "require('./eas.json').build.production.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID||''" 2>/dev/null)"
  echo "export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=$(node -p "require('./eas.json').build.production.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID||''" 2>/dev/null)"
} >> ios/.xcode.env.local
# SSO_PREVIEW=1 renders the Apple and Google controls before their credentials exist, so the
# layout can be reviewed. It is passed through only here; no eas.json profile sets it, so
# TestFlight and App Store builds are unaffected.
# BUILT WITH XCODEBUILD DIRECTLY, NOT `expo run:ios` (16 Sept 2026). Xcode 27 changed the
# simulator list: `simctl list -j` now carries `deviceTypeIdentifier`, and @expo/cli 57's
# isSimulatorDevice() looks for `deviceType`, so every simulator is taken for a physical
# iPhone and the run stops at "No code signing certificates are available" — after a
# successful compile. xcodebuild with the simulator as its destination is what the CLI runs
# underneath for a simulator; called directly, the CLI's guess is out of the path. The bundle
# is still embedded by Xcode's own phase, which reads ios/.xcode.env.local written above.
DD="$HOME/Library/Developer/Xcode/DerivedData/AmericanRider-simulator"
xcodebuild -workspace ios/AmericanRider.xcworkspace -scheme AmericanRider -configuration Release \
  -destination "id=$TARGET" -derivedDataPath "$DD" CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  build >> "$LOG" 2>&1

APP="$DD/Build/Products/Release-iphonesimulator/AmericanRider.app"
[ -d "$APP" ] || { echo "Build finished but no .app was found" >&2; exit 1; }
# A commit from before the stamp existed cannot carry one; its identity is then proved by the
# record below — the bundle's own hash, which the parity check compares with what is installed.
if grep -aq "ar-commit:" "$APP/main.jsbundle"; then
  grep -aq "ar-commit:$COMMIT" "$APP/main.jsbundle" || { echo "The bundle is not stamped with $COMMIT" >&2; exit 1; }
fi
# The server the bundle will talk to is checked, not assumed: a production build keeps the
# production address literal; a localhost build folds it away.
case "$API" in
  *onrender.com*) grep -aq "american-rider-server.onrender.com" "$APP/main.jsbundle" || { echo "The bundle does not carry the production server address; it was built for something else" >&2; exit 1; } ;;
  *localhost*)    grep -aq "localhost:4242" "$APP/main.jsbundle" || { echo "The bundle does not carry the local server address" >&2; exit 1; } ;;
esac
BUNDLE_SHA=$(shasum -a 256 "$APP/main.jsbundle" | cut -c1-64)

for UDID in $(booted); do
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
  xcrun simctl install "$UDID" "$APP"
  xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
done
mkdir -p "$ROOT/.expo"
printf '{"commit":"%s","dirty":%s,"api":"%s","builtAt":"%s","app":"%s","bundleSha256":"%s"}\n' \
  "$COMMIT" "$([ "$DIRTY" = 0 ] && echo false || echo true)" "$API" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$APP" "$BUNDLE_SHA" > "$ROOT/.expo/simulator-build.json"
echo "Installed $COMMIT on $(booted | wc -l | tr -d ' ') simulator(s)."
