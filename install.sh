#!/bin/bash
set -e

REPO="edison7009/hedge-coding"
API_URL="https://api.github.com/repos/$REPO/releases/latest"

echo ""
echo "========================================="
echo "  Hedge Coding - Auto Installer          "
echo "========================================="
echo ""

echo "🚀 Fetching latest release of Hedge Coding..."

# Get the latest release JSON
RELEASE_JSON=$(curl -s "$API_URL")

# Check if release exists
if echo "$RELEASE_JSON" | grep -q "Not Found"; then
    echo "❌ Failed to fetch the latest release. It may not be published yet."
    echo "🚧 Please follow the 'Build from Source' instructions in the README for now."
    exit 1
fi

OS="$(uname -s)"
if [ "$OS" = "Darwin" ]; then
    # Look for .dmg
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep -i "browser_download_url.*\.dmg" | head -n 1 | cut -d '"' -f 4)
    if [ -z "$DOWNLOAD_URL" ]; then
        echo "❌ Could not find the macOS installer (.dmg) in the latest release."
        exit 1
    fi
    FILE="/tmp/HedgeCoding.dmg"
    echo "📦 Downloading (this may take a minute): $DOWNLOAD_URL"
    curl -L "$DOWNLOAD_URL" -o "$FILE"
    
    echo "💿 Opening installer..."
    open "$FILE"
    echo "✅ Please drag 'Hedge Coding' into your Applications folder."

elif [ "$OS" = "Linux" ]; then
    # Look for .deb
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep -i "browser_download_url.*\.deb" | head -n 1 | cut -d '"' -f 4)
    if [ -z "$DOWNLOAD_URL" ]; then
        echo "❌ Could not find the Linux installer (.deb) in the latest release."
        exit 1
    fi
    FILE="/tmp/hedgecoding.deb"
    echo "📦 Downloading (this may take a minute): $DOWNLOAD_URL"
    curl -L "$DOWNLOAD_URL" -o "$FILE"
    
    echo "🔧 Installing package..."
    sudo dpkg -i "$FILE" || sudo apt-get install -f -y
    echo "✅ Installation complete! You can open Hedge Coding from your app launcher."
else
    echo "❌ Unsupported OS: $OS"
    exit 1
fi
