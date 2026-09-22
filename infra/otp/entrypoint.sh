#!/usr/bin/env bash
# Container start: make sure a graph is present, then serve it.
set -euo pipefail

OTP_DIR="${OTP_DIR:-/var/otp}"
PORT="${PORT:-8080}"
OTP_XMX="${OTP_XMX:-2500m}"
mkdir -p "$OTP_DIR"

if [ ! -s "$OTP_DIR/graph.obj" ]; then
  if [ -n "${GRAPH_URL:-}" ]; then
    echo "No graph at $OTP_DIR/graph.obj; downloading from GRAPH_URL..."
    curl -sSL --retry 5 --retry-delay 10 -o "$OTP_DIR/graph.obj.part" "$GRAPH_URL"
    mv "$OTP_DIR/graph.obj.part" "$OTP_DIR/graph.obj"
    echo "Downloaded $(du -h "$OTP_DIR/graph.obj" | cut -f1)."
  else
    cat >&2 <<EOF
No graph found at $OTP_DIR/graph.obj and GRAPH_URL is not set.
Build one with infra/otp/build.sh, then either copy graph.obj onto the disk mounted at
$OTP_DIR or upload it to object storage and set GRAPH_URL to its HTTPS address.
EOF
    exit 1
  fi
fi

# The configuration in the image is authoritative; refresh the copy next to the graph.
cp /opt/otp/config/router-config.json /opt/otp/config/otp-config.json "$OTP_DIR/"

echo "Starting OpenTripPlanner on port $PORT with -Xmx$OTP_XMX from $OTP_DIR"
exec java "-Xmx$OTP_XMX" -XX:+UseParallelGC -jar /opt/otp/otp.jar --load --serve --port "$PORT" "$OTP_DIR"
