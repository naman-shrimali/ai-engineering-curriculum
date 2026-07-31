#!/usr/bin/env bash
# Open the AI Engineering repo in the local reader UI.
# Serves the repo root so the reader can fetch the .md files, then opens the browser.
set -e
cd "$(dirname "$0")"
# keep the file index current so written/pending stays accurate
python3 tutor/build-index.py >/dev/null 2>&1 || true

PORT="${PORT:-8123}"
URL="http://localhost:$PORT/tutor/reader.html"

# reuse an existing server on this port if one is already up
if curl -s -o /dev/null "http://localhost:$PORT/manifest.yaml" 2>/dev/null; then
  echo "Server already running on :$PORT"
else
  echo "Serving $(pwd) on :$PORT  (Ctrl-C to stop)"
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  sleep 1
fi

echo "Opening $URL"
open "$URL" 2>/dev/null || echo "Open manually: $URL"
wait
