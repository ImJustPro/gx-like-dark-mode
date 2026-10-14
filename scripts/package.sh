#!/usr/bin/env sh
# Builds release zips into dist/
set -e
cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
rm -rf dist && mkdir -p dist
(cd extension && zip -qr "../dist/gx-like-dark-mode-v$VERSION.zip" .)
(cd extension-native && zip -qr "../dist/gx-like-dark-mode-native-v$VERSION.zip" .)
ls -l dist
