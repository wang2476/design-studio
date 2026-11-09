#!/bin/sh
# Build "Design Studio.app" into ~/Applications (override with APP_DIR).
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(dirname "$here")"
app="${APP_DIR:-$HOME/Applications}/Design Studio.app"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/out/MacOS" "$tmp/out/Resources"
xcrun swiftc -O -parse-as-library -o "$tmp/out/MacOS/DesignStudio" "$here/DesignStudio.swift"

# Icon from the studio's own touch icon.
iconset="$tmp/AppIcon.iconset"; mkdir "$iconset"
for s in 16 32 128 256 512; do
  sips -z $s $s "$repo/public/apple-touch-icon.png" --out "$iconset/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) "$repo/public/apple-touch-icon.png" --out "$iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$iconset" -o "$tmp/out/Resources/AppIcon.icns"

cat > "$tmp/out/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Design Studio</string>
  <key>CFBundleDisplayName</key><string>Design Studio</string>
  <key>CFBundleIdentifier</key><string>local.designstudio</string>
  <key>CFBundleExecutable</key><string>DesignStudio</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
  <key>StudioRepo</key><string>$repo</string>
</dict></plist>
EOF

# Swap in only after a full build, so a failed build keeps the old app.
mkdir -p "$(dirname "$app")"
rm -rf "$app"
mkdir -p "$app"
mv "$tmp/out" "$app/Contents"
codesign -s - --force "$app"
echo "built: $app"
