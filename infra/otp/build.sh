#!/usr/bin/env bash
# Builds the South Florida OpenTripPlanner graph on this machine, exactly as it was first built
# on 9 September 2026. Idempotent: every step is skipped when its output already exists, so
# re-running the script after a failure resumes where it stopped. Pass --refresh to fetch new
# GTFS feeds and OSM data and rebuild.
#
#   infra/otp/build.sh            # build (or resume) into ~/otp-data
#   infra/otp/build.sh --refresh  # re-download the feeds and the map, then rebuild
#   infra/otp/build.sh --serve    # build if needed, then run the server on port 8080
#
# What it produces (nothing is written inside the repository):
#   ~/otp-data/otp-shaded-2.10.0.jar        the planner (191 MB, from Maven Central, SHA-1 checked)
#   ~/otp-data/build/mdt-gtfs.zip           Miami-Dade Transit timetable (8.4 MB)
#   ~/otp-data/build/bct-gtfs.zip           Broward County Transit timetable (4.8 MB)
#   ~/otp-data/build/palmtran-gtfs.zip      Palm Tran timetable (5.3 MB)
#   ~/otp-data/build/sfrta-gtfs.zip         Tri-Rail timetable (36 KB)
#   ~/otp-data/build/brightline-gtfs.zip    Brightline timetable (27 KB)
#   ~/otp-data/build/south-florida.osm.pbf  the street map, Miami-Dade + Broward + Palm Beach (119 MB)
#   ~/otp-data/build/graph.obj              the finished graph (229 MB) — this is the file to deploy
#
# Requirements: Java 25 and osmium-tool. On macOS: brew install openjdk@25 osmium-tool
# (this script adds Homebrew's JDK to PATH itself). On Debian/Ubuntu: apt install osmium-tool
# and a Java 25 runtime (Adoptium: https://adoptium.net/installation/linux/).
#
# Measured on a 16 GB Apple Silicon Mac: osmium crop 4 s, graph build 46 s, peak 3.3 GB RSS.
# The Florida download (656 MB) is the slow part and depends on the connection.

set -euo pipefail

OTP_VERSION="2.10.0"
OTP_SHA1="cc2f88081d468372fb3c4e7ca37a5f8f6cd8233c"
OTP_JAR_URL="https://repo1.maven.org/maven2/org/opentripplanner/otp-shaded/${OTP_VERSION}/otp-shaded-${OTP_VERSION}.jar"
MDT_GTFS_URL="https://www.miamidade.gov/transit/googletransit/current/google_transit.zip"
# Broward County Transit's own address (broward.org/bct/documents/google_transit.zip) returns an
# HTML 404; the Mobility Database mirror (mdb-330) serves the county's latest file.
BCT_GTFS_URL="https://files.mobilitydatabase.org/mdb-330/latest.zip"
PALMTRAN_GTFS_URL="https://www.palmtran.org/feed/google_transit.zip"
SFRTA_GTFS_URL="https://gtfs.tri-rail.com/gtfs.zip"
BRIGHTLINE_GTFS_URL="https://feed.gobrightline.com/bl_gtfs.zip"
FLORIDA_PBF_URL="https://download.geofabrik.de/north-america/us/florida-latest.osm.pbf"
# West, south, east, north. Miami-Dade, Broward and Palm Beach counties; the Keys are excluded.
BBOX="-80.95,25.05,-79.95,26.98"
BUILD_XMX="${BUILD_XMX:-6G}"
SERVE_XMX="${SERVE_XMX:-3G}"
PORT="${PORT:-8080}"

DATA_DIR="${OTP_DATA_DIR:-$HOME/otp-data}"
BUILD_DIR="$DATA_DIR/build"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REFRESH=0
SERVE=0
for arg in "$@"; do
  case "$arg" in
    --refresh) REFRESH=1 ;;
    --serve) SERVE=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

mkdir -p "$BUILD_DIR" "$DATA_DIR/logs"
cd "$DATA_DIR"

# ---- Java 25 ------------------------------------------------------------------------------
if [ -d /opt/homebrew/opt/openjdk@25/bin ]; then export PATH="/opt/homebrew/opt/openjdk@25/bin:$PATH"; fi
if ! java -version 2>&1 | grep -qE 'version "25'; then
  echo "Java 25 is required (OTP ${OTP_VERSION} is compiled for it). On macOS: brew install openjdk@25" >&2
  exit 1
fi
command -v osmium >/dev/null || { echo "osmium-tool is required. On macOS: brew install osmium-tool" >&2; exit 1; }

# ---- The planner --------------------------------------------------------------------------
JAR="otp-shaded-${OTP_VERSION}.jar"
if [ ! -f "$JAR" ]; then
  echo "Downloading OpenTripPlanner ${OTP_VERSION} (191 MB)..."
  curl -sSL --retry 3 -o "$JAR.part" "$OTP_JAR_URL" && mv "$JAR.part" "$JAR"
fi
if command -v sha1sum >/dev/null; then SHA1CMD="sha1sum"; else SHA1CMD="shasum -a 1"; fi
echo "${OTP_SHA1}  ${JAR}" | $SHA1CMD -c - >/dev/null || { echo "SHA-1 mismatch on $JAR; delete it and re-run." >&2; exit 1; }

# ---- Timetables ---------------------------------------------------------------------------
fetch_gtfs() { # url, file
  if [ "$REFRESH" = 1 ] || [ ! -f "$BUILD_DIR/$2" ]; then
    echo "Downloading $2..."
    curl -sSL --retry 3 -A "Mozilla/5.0" -o "$BUILD_DIR/$2.part" "$1"
    unzip -tq "$BUILD_DIR/$2.part" >/dev/null || { echo "$1 did not return a zip file (the county changes this URL; see README)." >&2; rm -f "$BUILD_DIR/$2.part"; exit 1; }
    unzip -l "$BUILD_DIR/$2.part" | grep -q ' routes.txt' || { echo "$2 has no routes.txt" >&2; exit 1; }
    mv "$BUILD_DIR/$2.part" "$BUILD_DIR/$2"
  fi
}
fetch_gtfs "$MDT_GTFS_URL" mdt-gtfs.zip
fetch_gtfs "$BCT_GTFS_URL" bct-gtfs.zip
fetch_gtfs "$PALMTRAN_GTFS_URL" palmtran-gtfs.zip
fetch_gtfs "$SFRTA_GTFS_URL" sfrta-gtfs.zip
fetch_gtfs "$BRIGHTLINE_GTFS_URL" brightline-gtfs.zip

# ---- The street map -----------------------------------------------------------------------
if [ "$REFRESH" = 1 ] || [ ! -f "$BUILD_DIR/south-florida.osm.pbf" ]; then
  if [ ! -f florida-latest.osm.pbf ]; then
    echo "Downloading OpenStreetMap Florida (about 660 MB)..."
    curl -sSL --retry 3 -o florida-latest.osm.pbf.part "$FLORIDA_PBF_URL" && mv florida-latest.osm.pbf.part florida-latest.osm.pbf
  fi
  echo "Cropping to South Florida..."
  osmium extract -b "$BBOX" --overwrite -o "$BUILD_DIR/south-florida.osm.pbf" florida-latest.osm.pbf
  rm -f florida-latest.osm.pbf
fi

# ---- Configuration (the repo copy is authoritative) ---------------------------------------
cp "$SCRIPT_DIR/build-config.json" "$SCRIPT_DIR/router-config.json" "$SCRIPT_DIR/otp-config.json" "$BUILD_DIR/"

# ---- The graph ----------------------------------------------------------------------------
if [ "$REFRESH" = 1 ] || [ ! -f "$BUILD_DIR/graph.obj" ]; then
  echo "Building the graph (log: $DATA_DIR/build.log)..."
  rm -f "$BUILD_DIR/graph.obj"
  java "-Xmx${BUILD_XMX}" -jar "$JAR" --build --save "$BUILD_DIR" > "$DATA_DIR/build.log" 2>&1 \
    || { echo "Build failed; see $DATA_DIR/build.log" >&2; tail -20 "$DATA_DIR/build.log" >&2; exit 1; }
fi
echo "Graph: $(du -h "$BUILD_DIR/graph.obj" | cut -f1) at $BUILD_DIR/graph.obj"

# ---- Serve (optional) ---------------------------------------------------------------------
if [ "$SERVE" = 1 ]; then
  echo "Serving on http://localhost:${PORT}/ (log: $DATA_DIR/serve.log). Ctrl-C stops it."
  exec java "-Xmx${SERVE_XMX}" -jar "$JAR" --load --serve --port "$PORT" "$BUILD_DIR" 2>&1 | tee "$DATA_DIR/serve.log"
fi
