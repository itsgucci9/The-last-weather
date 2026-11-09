import { describe, expect, it } from 'vitest';
import storyJson from '../data/story.json';
import { beats, splitDialogue } from '../src/ui/describe';
import { choose, createSession, getScene } from '../src/engine/engine';
import type { ChoiceView, Session, Story } from '../src/engine/types';
import { UI } from '../src/i18n/ui';
import { orderViews } from '../src/ui/Choices';
import { placeKind, revealMeters, sceneFields, showStatusFlag } from '../src/ui/guide';

const story = storyJson as unknown as Story;
const play = (ids: string[], from: Session = createSession(story)): Session => ids.reduce((s, id) => choose(story, s, id), from);
const at = (sceneId: string, from: Session = createSession(story)): Session => ({ ...from, sceneId });

describe('progressive meters', () => {
  it('starts with only the meters the first decision uses, and nothing marked new', () => {
    const start = createSession(story);
    const { meters, fresh } = revealMeters(story, start);
    expect(meters).toEqual(['oxygen', 'micaTrust', 'stormClock']);
    expect(fresh).toEqual([]);
  });

  it('introduces Suit and Salvage at the route choice, marked new', () => {
    const s = play(['restore_memory']);
    expect(s.sceneId).toBe('route_choice');
    const { meters, fresh } = revealMeters(story, s);
    expect(meters).toEqual(['oxygen', 'suitIntegrity', 'salvage', 'micaTrust', 'stormClock']);
    expect(fresh).toEqual(['suitIntegrity', 'salvage']);
  });

  it('keeps a meter once shown, and it is only new once', () => {
    const s = play(['restore_memory', 'glass_ridge']);
    const { meters, fresh } = revealMeters(story, s);
    expect(meters).toEqual(expect.arrayContaining(['oxygen', 'suitIntegrity', 'salvage', 'micaTrust']));
    expect(fresh).not.toContain('suitIntegrity');
    expect(fresh).not.toContain('salvage');
  });

  it('reads the fields a scene changes or checks', () => {
    const fields = sceneFields(getScene(story, 'storm_front'));
    for (const f of ['forecastSaved', 'micaTrust', 'hasFilter', 'suitIntegrity', 'oxygen', 'stormClock']) expect(fields.has(f)).toBe(true);
  });

  it('shows a status line once it has changed', () => {
    expect(showStatusFlag(story, createSession(story), 'memoryRestored')).toBe(false);
    expect(showStatusFlag(story, play(['restore_memory']), 'memoryRestored')).toBe(true);
  });
});

describe('place banner', () => {
  it('says outside, storm or sealed only where survival depends on it', () => {
    const start = createSession(story);
    expect(placeKind(story, start)).toBe('exposed');
    expect(placeKind(story, at('storm_front'))).toBe('storm');
    expect(placeKind(story, at('weather_station'))).toBe('sealed');
  });

  it('stays quiet off-planet, on chapter ends, endings and deaths', () => {
    const s = createSession(story);
    const offPlanet = { ...at('hard_drift'), state: { ...s.state, escape: 'hard' } };
    expect(placeKind(story, offPlanet)).toBeNull();
    expect(placeKind(story, at('ending_clear'))).toBeNull();
    expect(placeKind(story, at('ending_known_space'))).toBeNull();
    expect(placeKind(story, at('death_asphyxiation'))).toBeNull();
  });
});

describe('choice order', () => {
  it('lists open options first, then the locked ones, each in story order', () => {
    const v = (id: string, available: boolean) => ({ choice: { id }, available }) as unknown as ChoiceView;
    const { open, locked } = orderViews([v('a', false), v('b', true), v('c', false), v('d', true)]);
    expect(open.map((x) => x.choice.id)).toEqual(['b', 'd']);
    expect(locked.map((x) => x.choice.id)).toEqual(['a', 'c']);
  });
});

describe('first-run hint', () => {
  const keys = [
    'coachPlay', 'showMore', 'showLess', 'tutorialSetting', 'resetTutorial',
    'placeExposed', 'placeStorm', 'placeSealed', 'costs', 'gains', 'needsLabel',
  ] as const;
  it('exists in every language, and the place line is a label rather than a paragraph', () => {
    for (const [lang, ui] of Object.entries(UI)) {
      for (const k of keys) expect(ui[k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(ui.coachPlay.split(/\s+/).length, lang).toBeLessThanOrEqual(8);
      expect(ui.placeExposed.includes('.'), lang).toBe(false);
      expect(ui.chapterOf, lang).toContain('{n}');
      expect(ui.chapterOf, lang).toContain('{total}');
    }
  });

  it('shows the first sentence and keeps the rest for later', () => {
    expect(beats('The storm is close. The ship is split open.')).toEqual({
      lead: 'The storm is close.',
      rest: 'The ship is split open.',
    });
    expect(beats('Only this.')).toEqual({ lead: 'Only this.', rest: '' });
  });

  it('shortens a long opening sentence to a few words', () => {
    const { lead, rest } = beats('The storm has turned the horizon the color of old copper. Your ship lies split.');
    expect(lead.split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(rest.toLowerCase()).toContain('copper');
  });
});

describe('MICA keeps it short', () => {
  // Requested 9 Nov 2026: MICA talked too much. Every line she (or the keeper) says stays brief;
  // rules the interface already shows are not repeated in dialogue.
  const lines: { where: string; speaker: string; text: string }[] = [];
  for (const scene of story.scenes) {
    if (scene.speaker) for (const seg of splitDialogue(scene.text)) if (seg.kind === 'speech') lines.push({ where: scene.id, speaker: scene.speaker, text: seg.text });
    for (const v of scene.textVariants ?? []) if (v.speaker) lines.push({ where: `${scene.id}.${v.id}`, speaker: v.speaker, text: v.text });
  }
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

  it('no MICA line is longer than 25 words', () => {
    const long = lines.filter((l) => l.speaker === 'MICA' && words(l.text) > 25).map((l) => `${l.where} (${words(l.text)})`);
    expect(long).toEqual([]);
  });

  it('no other voice is longer than 30 words', () => {
    const long = lines.filter((l) => l.speaker !== 'MICA' && words(l.text) > 30).map((l) => `${l.where} (${words(l.text)})`);
    expect(long).toEqual([]);
  });

  it('MICA no longer explains the survival rules on the first screen', () => {
    const first = getScene(story, story.initialScene);
    expect(first.textVariants ?? []).toEqual([]);
  });
});
