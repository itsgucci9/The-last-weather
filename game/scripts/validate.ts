// npm run validate — checks data/story.json, its art and its translations, then walks every run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOODS } from '../src/audio';
import { explore } from '../src/engine/explore';
import type { StoryLocale } from '../src/engine/localize';
import type { Story } from '../src/engine/types';
import { validateStory } from '../src/engine/validate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const story = JSON.parse(fs.readFileSync(path.join(root, 'data/story.json'), 'utf8')) as Story;
const assets = fs.readdirSync(path.join(root, story.assetRoot)).filter((f) => f.endsWith('.svg'));
const localeDir = path.join(root, 'data/locales');
const locales = fs.existsSync(localeDir)
  ? fs
      .readdirSync(localeDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(localeDir, f), 'utf8')) as StoryLocale)
  : [];

const { errors, warnings } = validateStory(story, { assets, locales, ambiences: MOODS });

// Every art file needs alt text in the manifest (English) and in each translation.
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'asset-manifest.json'), 'utf8')) as {
  scenes: { file: string; alt: string }[];
  icons: { file: string; alt: string }[];
};
const described = [...manifest.scenes, ...manifest.icons].map((a) => path.basename(a.file));
for (const file of assets) if (!described.includes(file)) errors.push(`asset-manifest.json has no alt text for ${file}`);
for (const locale of locales) {
  for (const a of manifest.scenes) {
    if (!locale.art?.[path.basename(a.file)]) errors.push(`Locale "${locale.language}" is missing art alt text for ${path.basename(a.file)}`);
  }
}
const report = explore(story);

console.log(`\n${story.title} — story check`);
console.log(`Scenes: ${story.scenes.length} · reached: ${report.visitedScenes.size} · art files: ${assets.length}`);
console.log(`Translations checked: ${['en (source)', ...locales.map((l) => l.language)].join(', ')}`);
console.log(`Complete runs: ${report.pathCount.toLocaleString('en')} (${report.nodeCount} distinct situations) · dead ends: ${report.deadEnds.length} · stuck: ${report.stuck.length} · storm forced shelter: ${report.stormShelters}`);
const share = (runs: number) => `${String(runs).padStart(7)} runs ${String(report.pathCount ? Math.round((100 * runs) / report.pathCount) : 0).padStart(3)}%`;
for (const chapter of story.chapters ?? []) {
  const outcomes = story.scenes.filter((s) => s.chapter === chapter.id && (s.ending || s.chapterEnd));
  if (!outcomes.length) continue;
  console.log(`${chapter.title}:`);
  for (const s of outcomes) {
    const runs = s.ending ? report.endingCounts.get(s.id) ?? 0 : report.throughCounts.get(s.id) ?? 0;
    console.log(`  ${s.id.padEnd(22)} ${share(runs)}${s.ending ? '' : '  (chapter end)'}`);
  }
}
console.log('Deaths (the run ends; not endings):');
for (const s of story.scenes.filter((x) => x.death)) console.log(`  ${s.id.padEnd(22)} ${share(report.endingCounts.get(s.id) ?? 0)}`);
console.log('  where (situations):');
for (const [place, n] of [...report.deathPlaces].sort()) console.log(`    ${place.padEnd(36)} ${n}`);

console.log('\nResource ranges on arrival (min-max):');
const fields = Object.keys(story.stateRules);
console.log(`  ${'scene'.padEnd(16)} ${fields.map((f) => f.padEnd(14)).join('')}`);
for (const scene of story.scenes) {
  const ranges = report.statRanges.get(scene.id);
  if (!ranges) continue;
  console.log(`  ${scene.id.padEnd(16)} ${fields.map((f) => `${ranges.get(f)!.min}-${ranges.get(f)!.max}`.padEnd(14)).join('')}`);
}

console.log('\nChoice availability (visits available / locked):');
for (const [sceneId, choices] of report.choiceStats) {
  for (const [choiceId, s] of choices) console.log(`  ${`${sceneId}.${choiceId}`.padEnd(40)} ${s.available} / ${s.locked}`);
}

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  x ${e}`);
  process.exit(1);
}
console.log('\nStory OK.');
