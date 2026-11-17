#!/usr/bin/env bash
# Automancy Academy: install or update the site on an Ubuntu/Debian VPS (e.g. Hostinger KVM), as root.
#
#   First time:   curl -fsSL https://raw.githubusercontent.com/heirmexxy/automancy-academy/main/scripts/deploy-vps.sh -o deploy-automancy.sh && bash deploy-automancy.sh
#   Update later: bash deploy-automancy.sh            (pulls the latest code, rebuilds, restarts; keeps your keys)
#   HTTPS only:   bash deploy-automancy.sh --ssl      (once automancy.cc points at this server)
#
# On a server where Dokploy's Traefik already owns ports 80/443 (like srv878622), it does what Titan does:
# no Nginx; the app listens on the Docker bridge (172.17.0.1) and a file in /etc/dokploy/traefik/dynamic/
# routes automancy.cc to it, with Traefik's own Let's Encrypt certificate.
# It leaves your other sites alone: its own Node 20 in /opt/automancy-node (the system Node is not touched),
# its own systemd service (automancy), its own Nginx site file, and a free local port.
# Keys live in /etc/automancy/env (readable by root only), never in the code.
set -Eeuo pipefail

DOMAIN="automancy.cc"
REPO="https://github.com/heirmexxy/automancy-academy.git"
APP_DIR="/var/www/automancy-academy"
ENV_FILE="/etc/automancy/env"
NODE_DIR="/opt/automancy-node"
NODE_VERSION="v20.18.1"
SERVICE="automancy"
SITE_FILE="/etc/nginx/sites-available/${DOMAIN}"

say()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mXX  %s\033[0m\n' "$*"; exit 1; }
trap 'printf "\n\033[1;31mXX  Stopped at line %s of the script (command: %s). Send Claude a screenshot of this.\033[0m\n" "$LINENO" "$BASH_COMMAND"' ERR

# Install only what's missing, and don't let an unrelated broken package source stop us.
need_pkgs() {
  local missing=() p
  for p in "$@"; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
  [ ${#missing[@]} -eq 0 ] && return 0
  say "Installing: ${missing[*]}"
  apt-get update -qq >/tmp/automancy-apt.log 2>&1 || warn "apt-get update reported problems with some package sources (see /tmp/automancy-apt.log); continuing."
  apt-get install -y -qq "${missing[@]}" >>/tmp/automancy-apt.log 2>&1 || { tail -15 /tmp/automancy-apt.log; die "Couldn't install ${missing[*]}. Send Claude a screenshot of the lines above."; }
}

[ "$(id -u)" = "0" ] || die "Run this as root (in Hostinger's browser terminal you already are)."
command -v apt-get >/dev/null || die "This script expects Ubuntu or Debian."

TRAEFIK_DIR="/etc/dokploy/traefik/dynamic"
TRAEFIK_FILE="$TRAEFIK_DIR/automancy.yml"
MODE=nginx
if ss -ltnp 2>/dev/null | grep -E ':80\s' | grep -q docker-proxy && [ -d "$TRAEFIK_DIR" ]; then MODE=traefik; fi

SERVER_IP="$(curl -fsS -4 --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"

# ── HTTPS ────────────────────────────────────────────────────────────────────
ssl() {
  if [ "$MODE" = traefik ]; then
    say "HTTPS: Dokploy's Traefik gets the certificate by itself within a minute or two of the domain pointing here."
    return 0
  fi
  local admin dns www_dns
  admin="$(grep -E '^ADMIN_EMAILS=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | cut -d, -f1 || true)"
  dns="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
  www_dns="$(getent ahostsv4 "www.$DOMAIN" | awk 'NR==1{print $1}' || true)"
  if [ "$dns" != "$SERVER_IP" ]; then
    warn "$DOMAIN points to '${dns:-nothing yet}', not this server ($SERVER_IP)."
    echo "    In Hostinger hPanel → Domains → $DOMAIN → DNS: set the A record for @ (and www) to $SERVER_IP."
    echo "    Wait 10–30 minutes, then run:  bash deploy-automancy.sh --ssl"
    return 0
  fi
  local names=(-d "$DOMAIN")
  [ "$www_dns" = "$SERVER_IP" ] && names+=(-d "www.$DOMAIN")
  say "Getting a free HTTPS certificate (Let's Encrypt)"
  certbot --nginx "${names[@]}" --redirect --agree-tos --non-interactive -m "${admin:-admin@$DOMAIN}" \
    || die "Certbot failed. Check that ports 80 and 443 are open in Hostinger's firewall, then run: bash deploy-automancy.sh --ssl"
  say "HTTPS is on: https://$DOMAIN"
}
if [ "${1:-}" = "--ssl" ]; then ssl; exit 0; fi

# ── 1. System packages ───────────────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
if [ "$MODE" = traefik ]; then
  say "Dokploy's Traefik runs this server's websites: Automancy plugs into it (like Titan), no Nginx"
  ip -4 addr show docker0 2>/dev/null | grep -q '172.17.0.1/' || die "Expected the Docker bridge at 172.17.0.1 and didn't find it. Nothing was changed. Send Claude: ip -4 addr show docker0"
  need_pkgs git curl ca-certificates xz-utils
  BIND=172.17.0.1
else
  if ss -ltnp 2>/dev/null | grep -E ':80\s' | grep -vq nginx; then
    die "Something other than Nginx is using port 80: $(ss -ltnp | grep -E ':80\s' | head -1). Nothing was changed. Send this line to Claude."
  fi
  need_pkgs git curl ca-certificates xz-utils nginx certbot python3-certbot-nginx
  systemctl enable --now nginx >/dev/null
  BIND=127.0.0.1
fi

# ── 2. Node 20, just for this app ────────────────────────────────────────────
if [ ! -x "$NODE_DIR/bin/node" ] || [ "$("$NODE_DIR/bin/node" -v)" != "$NODE_VERSION" ]; then
  say "Installing Node $NODE_VERSION in $NODE_DIR (your system Node is not touched)"
  arch="$(uname -m)"; case "$arch" in x86_64) arch=x64;; aarch64) arch=arm64;; *) die "Unsupported CPU: $arch";; esac
  tmp="$(mktemp -d)"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-$arch.tar.xz" -o "$tmp/node.tar.xz"
  rm -rf "$NODE_DIR"; mkdir -p "$NODE_DIR"
  tar -xJf "$tmp/node.tar.xz" -C "$NODE_DIR" --strip-components=1
  rm -rf "$tmp"
fi
export PATH="$NODE_DIR/bin:$PATH"

# ── 3. Memory for the build (adds a 2 GB swap file only if the server has little) ──
mem_mb=$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1024 ))
swap_mb=$(( $(grep SwapTotal /proc/meminfo | awk '{print $2}') / 1024 ))
if [ $((mem_mb + swap_mb)) -lt 3500 ] && [ ! -f /swapfile-automancy ]; then
  say "Adding a 2 GB swap file so the build doesn't run out of memory"
  fallocate -l 2G /swapfile-automancy && chmod 600 /swapfile-automancy && mkswap /swapfile-automancy >/dev/null && swapon /swapfile-automancy
  echo '/swapfile-automancy none swap sw 0 0' >> /etc/fstab
fi

# ── 4. Code ──────────────────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  say "Getting the latest code"
  git -C "$APP_DIR" fetch -q origin main && git -C "$APP_DIR" reset -q --hard origin/main
else
  say "Downloading the code"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone -q --depth 1 "$REPO" "$APP_DIR"
fi

# ── 5. Keys (asked once, kept in /etc/automancy/env) ─────────────────────────
ask() { # ask VAR "Question" [secret]
  local v=""
  while [ -z "$v" ]; do
    if [ "${3:-}" = "secret" ]; then read -r -s -p "  $2: " v; echo; else read -r -p "  $2: " v; fi
    v="$(echo "$v" | tr -d '[:space:]')"
  done
  printf '%s=%s\n' "$1" "$v" >> "$ENV_FILE"
}
if [ ! -s "$ENV_FILE" ]; then
  say "Your keys (typed here, saved only on this server; secret keys don't show while you type)"
  mkdir -p "$(dirname "$ENV_FILE")"; umask 077; : > "$ENV_FILE"
  ask NEXT_PUBLIC_SUPABASE_URL "Supabase Project URL (https://….supabase.co)"
  ask NEXT_PUBLIC_SUPABASE_ANON_KEY "Supabase publishable key (sb_publishable_…)"
  ask SUPABASE_SERVICE_ROLE_KEY "Supabase secret key (sb_secret_…)" secret
  ask ADMIN_EMAILS "Admin email (the account you'll sign up with)"
  read -r -p "  Paystack secret key (sk_test_… or sk_live_…; press Enter to add later): " pk; echo
  cron_secret="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  cat >> "$ENV_FILE" <<EOF
PAYSTACK_SECRET_KEY=$(echo "${pk:-}" | tr -d '[:space:]')
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
NEXT_PUBLIC_SUPPORT_EMAIL=support@$DOMAIN
NEXT_PUBLIC_PRIVACY_EMAIL=privacy@$DOMAIN
EMAIL_FROM="Automancy Academy <hello@$DOMAIN>"
CRON_SECRET=$cron_secret
# Add later (then run: bash deploy-automancy.sh), remove the leading # first:
#RESEND_API_KEY=
#ANTHROPIC_API_KEY=
#AZURE_SPEECH_KEY=
#AZURE_SPEECH_REGION=westeurope
#WHATSAPP_TOKEN=
#WHATSAPP_PHONE_NUMBER_ID=
#WHATSAPP_APP_SECRET=
#WHATSAPP_VERIFY_TOKEN=
#WHATSAPP_BUSINESS_NUMBER=
EOF
  chmod 600 "$ENV_FILE"
else
  say "Using the keys already saved in $ENV_FILE (edit it with: nano $ENV_FILE)"
fi

# ── 6. Build ─────────────────────────────────────────────────────────────────
say "Installing packages and building the site (5–10 minutes)"
cd "$APP_DIR"
set -a; # shellcheck disable=SC1090
. "$ENV_FILE"; set +a
export NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--max-old-space-size=2048"
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund --include=dev; else npm install --no-audit --no-fund --include=dev; fi
if ! npm run build > /tmp/automancy-build.log 2>&1; then
  tail -60 /tmp/automancy-build.log
  die "The build failed. Send Claude the lines above."
fi
tail -15 /tmp/automancy-build.log

# ── 7. A free local port and the service ─────────────────────────────────────
PORT="$(grep -oP '(?<=-p )\d+' /etc/systemd/system/$SERVICE.service 2>/dev/null || true)"
if [ -z "$PORT" ]; then
  PORT=3010; while ss -ltn | awk '{print $4}' | grep -qE "[:.]$PORT\$"; do PORT=$((PORT+1)); done
fi
say "Running the site as the '$SERVICE' service on local port $PORT"
cat > "/etc/systemd/system/$SERVICE.service" <<EOF
[Unit]
Description=Automancy Academy (Next.js)
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
ExecStart=$NODE_DIR/bin/node $APP_DIR/node_modules/next/dist/bin/next start -p $PORT -H $BIND
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null
systemctl restart "$SERVICE"
for i in $(seq 1 30); do curl -fsS -o /dev/null "http://$BIND:$PORT/" && break; sleep 2; done
curl -fsS -o /dev/null "http://$BIND:$PORT/" || die "The site didn't start. Send Claude: journalctl -u $SERVICE -n 60 --no-pager"

# ── 8. Route automancy.cc to the app ────────────────────────────────────────
if [ "$MODE" = traefik ]; then
  say "Telling Dokploy's Traefik to send $DOMAIN here (with HTTPS)"
  cat > "$TRAEFIK_FILE" <<EOF
# Automancy Academy: written by scripts/deploy-vps.sh. Traefik reloads this file by itself.
http:
  routers:
    automancy-web:
      rule: Host(\`$DOMAIN\`) || Host(\`www.$DOMAIN\`)
      entryPoints: [web]
      middlewares: [automancy-https]
      service: automancy
    automancy:
      rule: Host(\`$DOMAIN\`)
      entryPoints: [websecure]
      service: automancy
      tls:
        certResolver: letsencrypt
    automancy-www:
      rule: Host(\`www.$DOMAIN\`)
      entryPoints: [websecure]
      middlewares: [automancy-www]
      service: automancy
      tls:
        certResolver: letsencrypt
  middlewares:
    automancy-https:
      redirectScheme:
        scheme: https
        permanent: true
    automancy-www:
      redirectRegex:
        regex: '^https?://www\\.automancy\\.cc/(.*)'
        replacement: 'https://automancy.cc/\${1}'
        permanent: true
  services:
    automancy:
      loadBalancer:
        servers:
          - url: http://$BIND:$PORT
EOF
elif [ ! -f "$SITE_FILE" ]; then
  say "Adding the Nginx site for $DOMAIN"
  cat > "$SITE_FILE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
EOF
  ln -sf "$SITE_FILE" "/etc/nginx/sites-enabled/$DOMAIN"
else
  sed -i -E "s#proxy_pass http://127\.0\.0\.1:[0-9]+;#proxy_pass http://127.0.0.1:$PORT;#" "$SITE_FILE"
fi
if [ "$MODE" = nginx ]; then
  nginx -t >/dev/null 2>&1 || { nginx -t; die "Nginx config test failed (your other sites were not changed). Send Claude the lines above."; }
  systemctl reload nginx
fi

if [ "$MODE" = nginx ] && command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 'Nginx Full' >/dev/null; fi

# ── 9. Daily WhatsApp job (harmless until WhatsApp is set up) ────────────────
CRON_SECRET_VAL="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2)"
echo "30 7 * * * root curl -fsS -m 600 -H 'Authorization: Bearer $CRON_SECRET_VAL' http://$BIND:$PORT/api/whatsapp/reminders >/dev/null 2>&1" > /etc/cron.d/automancy
chmod 644 /etc/cron.d/automancy

# ── 10. HTTPS if the domain already points here ──────────────────────────────
ssl

say "Done. The site is running."
echo "    Open:    https://$DOMAIN  (or http://$DOMAIN until HTTPS is on)"
echo "    Logs:    journalctl -u $SERVICE -f"
echo "    Keys:    nano $ENV_FILE   then  bash deploy-automancy.sh"
echo "    Update:  bash deploy-automancy.sh"
