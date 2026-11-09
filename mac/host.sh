#!/bin/sh
# Make this Mac the Design Studio host for your tailnet.
#   mac/host.sh            install: keep the studio + MCP running, publish both with `tailscale serve`
#   mac/host.sh uninstall  remove the login items and the serve config
# Other machines then open https://<this-mac>.<tailnet>.ts.net and point Claude at …/mcp.
# `tailscale serve` is tailnet-only: nothing is exposed to the internet or the local network.
set -eu
repo="$(cd "$(dirname "$0")/.." && pwd)"
agents="$HOME/Library/LaunchAgents"
logs="$HOME/Library/Logs/DesignStudio"
dns="$(tailscale status --self --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"
url="https://$dns"

agent() {  # label, command, extra env
  cat > "$agents/$1.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>-lc</string><string>$3 exec $2</string></array>
  <key>WorkingDirectory</key><string>$repo</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$logs/$1.log</string>
  <key>StandardErrorPath</key><string>$logs/$1.log</string>
</dict></plist>
EOF
  launchctl bootout "gui/$(id -u)/$1" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$agents/$1.plist"
}

if [ "${1:-}" = uninstall ]; then
  for l in local.designstudio.web local.designstudio.mcp; do
    launchctl bootout "gui/$(id -u)/$l" 2>/dev/null || true; rm -f "$agents/$l.plist"
  done
  tailscale serve reset
  echo "Design Studio host removed."; exit 0
fi

mkdir -p "$agents" "$logs"
agent local.designstudio.web "pnpm dev" ""
agent local.designstudio.mcp "pnpm mcp" "STUDIO_PUBLIC_URL=$url"

tailscale serve --bg http://127.0.0.1:5173 >/dev/null
tailscale serve --bg --set-path /mcp http://127.0.0.1:5174/mcp >/dev/null

echo "Design Studio is hosted at $url"
echo "  App on another Mac:  STUDIO_URL=$url mac/build.sh"
echo "  Claude Code:         claude mcp add --scope user --transport http design-studio $url/mcp"
echo "  Logs:                $logs"
