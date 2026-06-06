#!/bin/sh
# Generate runtime config.js from environment variables at container start.
# The official nginx image runs every /docker-entrypoint.d/*.sh before nginx,
# so a single built image is configured per-environment without rebuilding.
set -e

cat > /usr/share/nginx/html/config.js <<EOF
window.__SPELLNOOK_CONFIG__ = {
  apiUrl: "${SPELLNOOK_API_URL:-}",
  googleClientId: "${SPELLNOOK_GOOGLE_CLIENT_ID:-}"
};
EOF

if [ -n "$SPELLNOOK_GOOGLE_CLIENT_ID" ]; then
  echo "[spellnook] runtime config.js written (Google client id: set)"
else
  echo "[spellnook] runtime config.js written (Google client id: unset)"
fi
