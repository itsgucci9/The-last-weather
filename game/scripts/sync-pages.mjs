// Copies dist/ to the parent repository root so GitHub Pages (branch main, folder /)
// keeps serving the built game. Source stays in this folder. Safe to run only when
// this project is the `game/` directory of that repo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(game, '..');
const dist = path.join(game, 'dist');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ is missing. Run vite build first.');
  process.exit(1);
}
if (path.basename(game) !== 'game' || !fs.existsSync(path.join(repo, '.git'))) {
  console.log('Not inside the Pages repo (game/ under a git root). Left dist/ in place.');
  process.exit(0);
}

const keep = new Set(['game', '.git']);
const siteNames = new Set([
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'og-image.png',
  '_headers',
  'robots.txt',
  'assets',
  'icons',
  'qa',
]);

for (const name of fs.readdirSync(repo)) {
  if (keep.has(name) || !siteNames.has(name)) continue;
  fs.rmSync(path.join(repo, name), { recursive: true, force: true });
}

function copy(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) copy(path.join(src, entry), path.join(dest, entry));
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

for (const name of fs.readdirSync(dist)) copy(path.join(dist, name), path.join(repo, name));
fs.writeFileSync(path.join(repo, '.nojekyll'), '');
console.log('Published the build to the repository root for GitHub Pages.');
