#!/bin/bash
# Make the iOS build survive a project path containing a space.
#
# THE BUG, and it is upstream in expo-constants. Its podspec declares this build phase:
#
#     bash -l -c "…$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"
#
# `bash -c` re-parses the string it is handed, so the expansion of PODS_TARGET_SRCROOT —
# "/Users/adriansmith/American Rider/node_modules/expo-constants" — word-splits at the space
# and bash tries to run "/Users/adriansmith/American". The build dies at 99% with:
#
#     No such file or directory: /Users/adriansmith/American
#
# which names a directory nobody has ever heard of and says nothing about quoting.
#
# The fix is one pair of single quotes inside the double quotes, so the inner shell sees one
# argument. Applied to node_modules so `pod install` regenerates the project correctly, and
# re-applied automatically after every `npm install` (see package.json "postinstall").
#
# THE ALTERNATIVE IS TO MOVE THE PROJECT to a path with no space in it, which is the real cure
# and is the founders' call, not mine.
set -e
SPEC="node_modules/expo-constants/ios/EXConstants.podspec"
[ -f "$SPEC" ] || { echo "patch-ios-space-in-path: $SPEC not present, nothing to do"; exit 0; }

if grep -q "bash -l -c \\\\\"'#{env_vars}" "$SPEC"; then
  echo "patch-ios-space-in-path: already applied"
  exit 0
fi

python3 - "$SPEC" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
old = ''':script => "bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",'''
new = ''':script => "bash -l -c \\"#{env_vars}'$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh'\\"",'''
if old not in s:
    print('patch-ios-space-in-path: pattern not found — expo-constants may have fixed it upstream')
    raise SystemExit(0)
open(p, 'w', encoding='utf-8').write(s.replace(old, new, 1))
print('patch-ios-space-in-path: applied')
PY

# ---- 2. React Native's own "Bundle React Native code and images" phase --------------------
#
# Generated into ios/*.xcodeproj by prebuild, from React Native's template. It ends with a
# BACKTICK command substitution:
#
#     `"$NODE_BINARY" --print "…react-native/scripts/react-native-xcode.sh"`
#
# The backticks make the shell EXECUTE the resulting path, and the path word-splits at the
# space, so it tries to run "/Users/adriansmith/American". Captured into a quoted variable
# instead, which is what the template should have done.
#
# Rewritten in the generated project rather than in node_modules, because this phase is
# emitted by prebuild — so RUN THIS SCRIPT AFTER EVERY `npx expo prebuild`.
PBX=$(ls ios/*.xcodeproj/project.pbxproj 2>/dev/null | head -1)
[ -n "$PBX" ] || { echo "patch-ios-space-in-path: no ios project yet, skipping phase 2"; exit 0; }

python3 - "$PBX" <<'PY2'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
old = r"""\n`"$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'"`\n"""
new = r"""\nRN_XCODE_SH="$("$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'")"\n/bin/sh "$RN_XCODE_SH"\n"""
if new in s:
    print('patch-ios-space-in-path: phase 2 already applied'); raise SystemExit(0)
if old not in s:
    print('patch-ios-space-in-path: phase 2 pattern not found — template may have changed'); raise SystemExit(0)
open(p, 'w', encoding='utf-8').write(s.replace(old, new, 1))
print('patch-ios-space-in-path: phase 2 applied')
PY2
