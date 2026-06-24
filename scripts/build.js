const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www');

const COPY_ITEMS = [
  'index.html',
  'manifest.json',
  'sw.js',
  'css',
  'js',
  'lib',
  'icons',
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const item of COPY_ITEMS) {
  const src = path.join(ROOT, item);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(OUT, item));
  }
}

console.log('Build complete -> www/');
