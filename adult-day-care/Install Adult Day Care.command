#!/bin/bash
# Double-click this file to build and install the Adult Day Care app on this Mac.
cd "$(dirname "$0")" || exit 1
clear

echo "=============================================="
echo "  Adult Day Care - installer"
echo "=============================================="
echo
echo "This takes about 5 to 10 minutes the first time."
echo "Leave this window open until it says it is finished."
echo

stop() {
  echo
  echo "Something went wrong at this step: $1"
  echo "Take a screenshot of this window and send it to Claude."
  echo
  read -n 1 -s -r -p "Press any key to close this window."
  exit 1
}

# 1. Node.js is needed once, to build the app
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed on this Mac."
  echo "Your web browser will open the download page now."
  echo "Download the LTS version, install it, then double-click this file again."
  open "https://nodejs.org"
  echo
  read -n 1 -s -r -p "Press any key to close this window."
  exit 1
fi

# 2. Download the building blocks
echo "Step 1 of 4: downloading components..."
npm install --no-audit --no-fund || stop "downloading components"

# Some versions of npm skip Electron's own setup step, so run it directly.
echo "Step 2 of 4: downloading the app engine..."
node node_modules/electron/install.js || stop "downloading the app engine"

# 3. Build the app
echo "Step 3 of 4: building the app..."
export CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --mac --dir || stop "building the app"

APP=$(ls -d dist/mac*/"Adult Day Care.app" 2>/dev/null | head -1)
[ -n "$APP" ] || stop "finding the built app"

# Sign it locally (required on Apple Silicon Macs) and clear download flags
codesign --force --deep --sign - "$APP" || stop "signing the app"
xattr -cr "$APP" 2>/dev/null

# 4. Install it
echo "Step 4 of 4: installing into Applications..."
DEST="/Applications"
rm -rf "$DEST/Adult Day Care.app" 2>/dev/null
if ! cp -R "$APP" "$DEST/" 2>/dev/null; then
  DEST="$HOME/Applications"
  mkdir -p "$DEST"
  rm -rf "$DEST/Adult Day Care.app"
  cp -R "$APP" "$DEST/" || stop "copying the app into Applications"
fi

echo
echo "Finished. Adult Day Care is installed in: $DEST"
echo "Opening it now. Next time, open it from Launchpad or the Applications folder."
open "$DEST/Adult Day Care.app"
echo
read -n 1 -s -r -p "Press any key to close this window."
