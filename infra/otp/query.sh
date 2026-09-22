#!/usr/bin/env bash
# Posts a GraphQL document to the OTP GTFS GraphQL API.
#   infra/otp/query.sh <file.graphql> '<variables-json>' [otp-base-url]
set -euo pipefail
FILE="$1"; VARS="${2:-{\}}"; BASE="${3:-${OTP_URL:-http://localhost:8080}}"
python3 - "$FILE" "$VARS" "$BASE" <<'PY'
import json, sys, urllib.request
query = open(sys.argv[1]).read()
body = json.dumps({"query": query, "variables": json.loads(sys.argv[2])}).encode()
req = urllib.request.Request(sys.argv[3].rstrip('/') + '/otp/gtfs/v1', data=body,
                             headers={'Content-Type': 'application/json', 'OTPTimeout': '30000'})
with urllib.request.urlopen(req, timeout=60) as r:
    print(json.dumps(json.load(r), indent=2))
PY
