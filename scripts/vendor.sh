#!/usr/bin/env bash
# Rebuild app/vendor/ — the self-hosted runtime libraries and fonts the app
# uses, so the site has no third-party runtime dependency (Firebase is the
# one exception and loads only when app/config.js carries a config).
# Requires node + npm. Versions are pinned here; bump deliberately.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; V="$ROOT/app/vendor"; T="$(mktemp -d)"
cd "$T" && npm init -y >/dev/null
npm i --no-audit --no-fund esbuild@0.23.1 marked@12.0.2 mermaid@10.9.1 d3@7.9.0 firebase@10.12.2 \
  pyodide@314.0.7 codemirror@6.0.2 @codemirror/lang-python@6.2.1 @codemirror/language @codemirror/state @codemirror/view @codemirror/commands @lezer/highlight \
  @fontsource-variable/bricolage-grotesque@5 @fontsource-variable/newsreader@5 @fontsource-variable/jetbrains-mono@5
mkdir -p "$V/fonts"
npx esbuild node_modules/marked/lib/marked.esm.js --bundle --format=esm --minify --outfile="$V/marked.js"
echo "export * from 'd3';" | npx esbuild --bundle --format=esm --minify --outfile="$V/d3.js"
npx esbuild node_modules/mermaid/dist/mermaid.esm.min.mjs --bundle --format=esm --minify --outfile="$V/mermaid.js"
# Firebase app+auth+firestore in ONE bundle: three separate bundles would each
# carry their own copy of firebase-app, so getAuth() and getFirestore() would
# look up different app registries and fail. index.html maps all three bare
# specifiers at this single file.
printf "export * from 'firebase/app';\nexport * from 'firebase/auth';\nexport * from 'firebase/firestore';\n" > fb-entry.js
npx esbuild fb-entry.js --bundle --format=esm --minify --outfile="$V/firebase.js"
# CodeMirror 6 (the coding-lab editor): one ES module exporting just what app/views/labs.js uses
cat > cm-entry.js <<'CM'
export { EditorView, basicSetup } from 'codemirror';
export { EditorState, Compartment } from '@codemirror/state';
export { keymap } from '@codemirror/view';
export { indentWithTab } from '@codemirror/commands';
export { python } from '@codemirror/lang-python';
export { HighlightStyle, syntaxHighlighting, indentUnit } from '@codemirror/language';
export { tags } from '@lezer/highlight';
CM
npx esbuild cm-entry.js --bundle --format=esm --minify --outfile="$V/codemirror.js"
# Pyodide (Python compiled to WebAssembly) for the coding labs: the runtime files only,
# no extra packages — labs use the standard library. Loaded lazily by app/lab-worker.js.
mkdir -p "$V/pyodide"
cp node_modules/pyodide/{pyodide.mjs,pyodide.asm.mjs,pyodide.asm.wasm,python_stdlib.zip,pyodide-lock.json} "$V/pyodide/"
curl -fsSL https://raw.githubusercontent.com/pyodide/pyodide/main/LICENSE -o "$V/pyodide/LICENSE.txt"
cp node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2 "$V/fonts/"
cp node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-{normal,italic}.woff2 "$V/fonts/"
cp node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2 "$V/fonts/"
for f in bricolage-grotesque newsreader jetbrains-mono; do cp "node_modules/@fontsource-variable/$f/LICENSE" "$V/fonts/LICENSE-$f.txt"; done
rm -rf "$T"; echo "vendored into $V"; du -sh "$V"
