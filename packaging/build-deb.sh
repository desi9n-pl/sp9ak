#!/usr/bin/env bash
# Buduje pakiet dist/sp9ak_<wersja>_all.deb (użycie: packaging/build-deb.sh [wersja])
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-1.0.0}"
BUILD="$ROOT/dist/build"
LIB="$BUILD/usr/lib/sp9ak"

rm -rf "$BUILD"
mkdir -p "$LIB" "$BUILD/DEBIAN" "$BUILD/usr/bin" \
    "$BUILD/usr/share/applications" "$BUILD/usr/share/icons/hicolor/scalable/apps"

cp -r "$ROOT/server" "$ROOT/desktop" "$ROOT/web" "$LIB/"
cp "$ROOT/sp9ak.sh" "$ROOT/LICENSE" "$LIB/"
find "$LIB" -name __pycache__ -prune -exec rm -rf {} +

# Launcher pakietu ustawia katalog danych w profilu użytkownika
cat > "$BUILD/usr/bin/sp9ak" <<'LAUNCHER'
#!/bin/sh
export SP9AK_DATA="${SP9AK_DATA:-${XDG_DATA_HOME:-$HOME/.local/share}/sp9ak}"
exec /usr/lib/sp9ak/sp9ak.sh "$@"
LAUNCHER
chmod 755 "$BUILD/usr/bin/sp9ak" "$LIB/sp9ak.sh"

cp "$ROOT/packaging/sp9ak.desktop" "$BUILD/usr/share/applications/sp9ak.desktop"
cp "$ROOT/desktop/icon.svg" "$BUILD/usr/share/icons/hicolor/scalable/apps/sp9ak.svg"

cat > "$BUILD/DEBIAN/control" <<CONTROL
Package: sp9ak
Version: $VERSION
Section: sound
Priority: optional
Architecture: all
Depends: python3 (>= 3.6)
Recommends: wmctrl, xdotool, python3-xlib, python3-gi, gir1.2-gtk-3.0
Suggests: google-chrome-beta
Maintainer: desi9n.pl <kscira@gmail.com>
Description: Polskie dyktowanie głosowe z korektą AI
 Lokalna aplikacja do dyktowania po polsku (Web Speech API) z korektą
 interpunkcji przez Gemini Nano. Wymaga Google Chrome Beta 149+
 (https://www.google.com/chrome/beta/), instalowanego osobno.
CONTROL

find "$BUILD" -type d -exec chmod 755 {} +
find "$BUILD" -type f ! -perm /111 -exec chmod 644 {} +
mkdir -p "$ROOT/dist"
OUT="$ROOT/dist/sp9ak_${VERSION}_all.deb"
dpkg-deb --root-owner-group --build "$BUILD" "$OUT"
rm -rf "$BUILD"
echo "Gotowe: $OUT"
