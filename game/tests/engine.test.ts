import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import storyJson from '../data/story.json';
import { MOODS } from '../src/audio';
import {
  activeVariants,
  applyEffects,
  availableChoices,
  choose,
  clockOut,
  conditionsPass,
  createSession,
  getChoiceViews,
  getScene,
  isTerminal,
  restartChapter,
  restoreSession,
  runChapterId,
} from '../src/engine/engine';
import { explore } from '../src/engine/explore';
import { localizeStory, type StoryLocale } from '../src/engine/localize';
import type { Session, Story } from '../src/engine/types';
import { validateStory } from '../src/engine/validate';
import { UI } from '../src/i18n/ui';
import { choiceChips } from '../src/ui/describe';

const story = storyJson as unknown as Story;
const play = (ids: string[], from: Session = createSession(story)): Session => ids.reduce((s, id) => choose(story, s, id), from);
const view = (s: Session, choiceId: string) => getChoiceViews(story, getScene(story, s.sceneId), s.state).find((v) => v.choice.id === choiceId)!;

const localeDir = path.resolve(__dirname, '../data/locales');
const locales = fs
  .readdirSync(localeDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(localeDir, f), 'utf8')) as StoryLocale);

/**
 * A tiny story that isolates each survival rule: an exposed yard, a storm crossing, a sealed hut
 * with a shelter, and one death scene per cause.
 */
function mini(overrides: Partial<Story['initialState']> = {}): Story {
  const deathScenes = ['asphyxiation', 'suit_breach', 'storm'].map((cause) => ({ id: `dead_${cause}`, title: cause, art: 'a.svg', text: cause, death: cause }));
  return {
    schemaVersion: 1,
    title: 'Mini',
    assetRoot: 'assets/',
    initialScene: 'yard',
    initialState: { oxygen: 2, suit: 2, salvage: 1, clock: 3, ...overrides },
    stateRules: {
      oxygen: { min: 0, max: 3, label: 'Oxygen', lethal: 'asphyxiation' },
      suit: { min: 0, max: 3, label: 'Suit', lethal: 'suit_breach' },
      salvage: { min: 0, max: 3, label: 'Salvage', spend: true },
      clock: { min: 0, max: 3, label: 'Clock', clock: { cause: 'storm' } },
    },
    scenes: [
      {
        id: 'yard',
        title: 'Yard',
        art: 'a.svg',
        text: 'Outside.',
        exposure: 'exposed',
        choices: [
          { id: 'walk', label: 'Walk', effects: { add: { oxygen: -1 } }, next: 'hut' },
          { id: 'cross', label: 'Cross', exposure: 'storm', effects: { add: { suit: -2 } }, next: 'hut' },
          { id: 'wait', label: 'Wait', effects: { add: { clock: -3 } }, next: 'hut' },
          { id: 'duck', label: 'Duck inside and wait', exposure: 'sealed', effects: { add: { clock: -3 } }, next: 'hut' },
          { id: 'go_out', label: 'Go further', next: 'field' },
        ],
      },
      {
        id: 'hut',
        title: 'Hut',
        art: 'a.svg',
        text: 'Sealed.',
        exposure: 'sealed',
        shelter: 'safe',
        choices: [
          { id: 'build', label: 'Build', effects: { add: { salvage: -2 } }, next: 'safe' },
          { id: 'rest', label: 'Rest', effects: { add: { oxygen: -2 } }, next: 'safe' },
          { id: 'read', label: 'Read', effects: { add: { clock: -5 } }, next: 'field' },
          { id: 'leave', label: 'Leave', next: 'field' },
        ],
      },
      {
        id: 'field',
        title: 'Field',
        art: 'a.svg',
        text: 'Outside again.',
        exposure: 'exposed',
        choices: [{ id: 'home', label: 'Home', conditions: { all: [{ field: 'salvage', op: 'gte', value: 3 }] }, next: 'safe' }],
      },
      { id: 'safe', title: 'Safe', art: 'a.svg', text: 'Safe.', exposure: 'sealed', ending: true },
      ...deathScenes,
    ],
  } as Story;
}
const miniPlay = (s: Story, ids: string[]) => ids.reduce((x, id) => choose(s, x, id), createSession(s));

describe('conditions', () => {
  const state = { oxygen: 2, flag: true, mode: 'careful' };
  it('requires every item in all', () => {
    expect(conditionsPass({ all: [{ field: 'oxygen', op: 'gte', value: 2 }, { field: 'flag', op: 'eq', value: true }] }, state)).toBe(true);
    expect(conditionsPass({ all: [{ field: 'oxygen', op: 'gte', value: 3 }, { field: 'flag', op: 'eq', value: true }] }, state)).toBe(false);
  });
  it('requires at least one item in any', () => {
    expect(conditionsPass({ any: [{ field: 'oxygen', op: 'gte', value: 9 }, { field: 'mode', op: 'eq', value: 'careful' }] }, state)).toBe(true);
    expect(conditionsPass({ any: [{ field: 'oxygen', op: 'gte', value: 9 }, { field: 'mode', op: 'eq', value: 'quick' }] }, state)).toBe(false);
  });
  it('requires both groups when both are present', () => {
    expect(conditionsPass({ all: [{ field: 'flag', op: 'eq', value: true }], any: [{ field: 'oxygen', op: 'lte', value: 1 }] }, state)).toBe(false);
    expect(conditionsPass({ all: [{ field: 'flag', op: 'eq', value: true }], any: [{ field: 'oxygen', op: 'lte', value: 2 }] }, state)).toBe(true);
  });
});

describe('resource thresholds', () => {
  it('kills by asphyxiation when oxygen reaches 0 during an exposed action', () => {
    const s = mini({ oxygen: 1 });
    const v = getChoiceViews(s, getScene(s, 'yard'), s.initialState).find((x) => x.choice.id === 'walk')!;
    expect(v.available).toBe(true); // a knowing choice, not a lock
    expect(v.resolution?.risk).toEqual({ kind: 'death', cause: 'asphyxiation', field: 'oxygen', at: 'action' });
    const after = miniPlay(s, ['walk']);
    expect(after.sceneId).toBe('dead_asphyxiation');
    expect(after.lastOutcome?.death).toEqual({ cause: 'asphyxiation', at: 'yard', how: 'action' });
  });

  it('survives with one unit left, and may empty a meter safely in a sealed place', () => {
    expect(miniPlay(mini({ oxygen: 2 }), ['walk']).sceneId).toBe('hut');
    const atHut = miniPlay(mini({ oxygen: 3 }), ['walk']); // oxygen 2 in the hut
    expect(choose(mini({ oxygen: 3 }), atHut, 'rest').sceneId).toBe('safe'); // 2 - 2 = 0, sealed: fine
  });

  it('locks a cost larger than what is left instead of clamping it (sealed oxygen, salvage)', () => {
    const s2 = mini({ oxygen: 2, salvage: 1 });
    const hut = { ...createSession(s2), sceneId: 'hut', state: { ...s2.initialState, oxygen: 1 } };
    const views = getChoiceViews(s2, getScene(s2, 'hut'), hut.state);
    expect(views.find((v) => v.choice.id === 'rest')).toMatchObject({ available: false, shortfalls: [{ field: 'oxygen', need: 2, have: 1 }] });
    expect(views.find((v) => v.choice.id === 'build')).toMatchObject({ available: false, shortfalls: [{ field: 'salvage', need: 2, have: 1 }] });
    expect(() => choose(s2, hut, 'build')).toThrow(/locked/);
  });

  it('kills by suit breach when the suit reaches 0 during a storm crossing', () => {
    expect(miniPlay(mini({ suit: 2 }), ['cross'])).toMatchObject({ sceneId: 'dead_suit_breach' });
    expect(miniPlay(mini({ suit: 3 }), ['cross']).sceneId).toBe('hut');
  });

  it('applies the same rules in the real story', () => {
    // Restored memory, ridge, archive, trench: one oxygen left at the ship; the careful repair is fatal.
    const atRepair = play(['restore_memory', 'glass_ridge', 'copy_archive', 'follow_mica']);
    expect(atRepair.state).toMatchObject({ oxygen: 1, stormClock: 1 });
    expect(view(atRepair, 'careful_repair').resolution?.risk).toMatchObject({ kind: 'death', cause: 'asphyxiation' });
    expect(view(atRepair, 'quick_patch').resolution?.risk).toBeNull();
    expect(choose(story, atRepair, 'careful_repair').sceneId).toBe('death_asphyxiation');
    // Glass Ridge then the exposed crossing: suit 2 - 2 = 0 in the storm.
    const atFront = play(['save_battery', 'glass_ridge', 'leave_with_coupler']);
    expect(view(atFront, 'cross_exposed_ridge').resolution?.risk).toMatchObject({ kind: 'death', cause: 'suit_breach' });
    expect(choose(story, atFront, 'cross_exposed_ridge').sceneId).toBe('death_suit_breach');
    // From the ravine the suit is whole: the same crossing leaves it at 1.
    expect(play(['save_battery', 'dry_ravine', 'leave_with_coupler', 'cross_exposed_ridge']).state.suitIntegrity).toBe(1);
  });

  it('says so on the choice when a gain hits the maximum instead of silently clamping it', () => {
    const s = createSession(story); // oxygen 4 of 6
    const full = { ...s, state: { ...s.state, oxygen: 6 } };
    const v = view(full, 'save_battery');
    const chips = choiceChips(story, UI.en, v.choice, full.state, v.resolution);
    expect(chips.map((c) => c.text)).toContain('Oxygen: max');
  });
});

describe('storm clock', () => {
  it('counts down on time-consuming actions and is shown before the choice', () => {
    expect(createSession(story).state.stormClock).toBe(7);
    expect(play(['restore_memory']).state.stormClock).toBe(6);
    expect(play(['restore_memory', 'dry_ravine']).state.stormClock).toBe(3);
    expect(view(createSession(story), 'restore_memory').choice.effects?.add?.stormClock).toBe(-1);
  });

  it('stops at zero instead of going negative', () => {
    const s = miniPlay(mini({ clock: 3 }), ['walk']); // hut, clock 3
    const after = choose(mini({ clock: 3 }), s, 'read'); // -5
    expect(after.state.clock).toBe(0);
  });

  it('makes an exposed action at zero lethal', () => {
    const s = mini({ clock: 3 });
    const yard = { ...createSession(s), state: { ...s.initialState, clock: 0 } };
    expect(choose(s, yard, 'go_out')).toMatchObject({ sceneId: 'dead_storm', lastOutcome: { death: { cause: 'storm', how: 'action' } } });
  });

  it('forces the player into shelter when it runs out while sealed in', () => {
    const s = mini({ clock: 3 });
    const atHut = miniPlay(s, ['walk']);
    const v = getChoiceViews(s, getScene(s, 'hut'), atHut.state).find((x) => x.choice.id === 'read')!;
    expect(v.resolution?.risk).toEqual({ kind: 'shelter', reason: 'storm' });
    expect(choose(s, atHut, 'read')).toMatchObject({ sceneId: 'safe', lastOutcome: { shelter: 'storm' } });
    // Waiting outside until the storm comes is a death; ducking into the hut first means forced shelter.
    expect(miniPlay(s, ['wait'])).toMatchObject({ sceneId: 'dead_storm', lastOutcome: { death: { cause: 'storm', how: 'action' } } });
    expect(miniPlay(s, ['duck'])).toMatchObject({ sceneId: 'safe', lastOutcome: { shelter: 'storm' } });
  });

  it('applies in the real story: forced shelter at the station, storm death in the open, no clear window at zero', () => {
    expect(view(play(['restore_memory', 'dry_ravine']), 'copy_archive').resolution?.risk).toEqual({ kind: 'shelter', reason: 'storm' });
    expect(play(['restore_memory', 'dry_ravine', 'copy_archive'])).toMatchObject({ sceneId: 'ending_shelter', lastOutcome: { shelter: 'storm' } });
    const late = play(['save_battery', 'dry_ravine', 'copy_archive']);
    expect(late.state.stormClock).toBe(1);
    expect(choose(story, late, 'follow_mica')).toMatchObject({ sceneId: 'death_storm', lastOutcome: { death: { cause: 'storm', at: 'storm_front', how: 'action' } } });
    expect(choose(story, late, 'back_to_shelter').sceneId).toBe('ending_shelter');
    const launch = getScene(story, 'launch');
    const ready = { ...story.initialState, shipReady: true, repairMode: 'careful', forecastSaved: true, oxygen: 2, stormClock: 0 };
    expect(getChoiceViews(story, launch, ready).find((v) => v.choice.id === 'clear_launch')?.available).toBe(false);
    expect(getChoiceViews(story, launch, { ...ready, stormClock: 1 }).find((v) => v.choice.id === 'clear_launch')?.available).toBe(true);
  });

  it('stops mattering once the player has left Vesper-6', () => {
    const away = { ...story.initialState, escape: 'clear', stormClock: 0 };
    expect(clockOut(story, away)).toBe(false);
    expect(conditionsPass(story.stateRules.stormClock.hudWhen, away)).toBe(false);
  });
});

describe('death state', () => {
  const dead = play(['save_battery', 'glass_ridge', 'leave_with_coupler', 'cross_exposed_ridge']);

  it('ends the run, records the cause and where, and locks every choice', () => {
    const scene = getScene(story, dead.sceneId);
    expect(isTerminal(scene)).toBe(true);
    expect(scene.ending).toBeUndefined(); // not one of the story endings
    expect(dead.lastOutcome?.death).toEqual({ cause: 'suit_breach', at: 'storm_front', how: 'action' });
    expect(getChoiceViews(story, scene, dead.state)).toEqual([]);
    expect(availableChoices(story, scene, dead.state)).toEqual([]);
    expect(() => choose(story, dead, 'anything')).toThrow(/run is over/);
  });

  it('stays dead after a reload, and drops a damaged death record', () => {
    expect(restoreSession(story, JSON.parse(JSON.stringify(dead)))).toMatchObject({ sceneId: 'death_suit_breach', lastOutcome: { death: { cause: 'suit_breach' } } });
    const broken = { ...dead, lastOutcome: { ...dead.lastOutcome, death: { cause: 7 } } };
    expect(restoreSession(story, broken)?.lastOutcome).toBeUndefined();
  });

  it('handles a scene with nothing open by the state: shelter if sealed, death if exposed (no blanket fallback)', () => {
    const s = mini({ salvage: 0 });
    // The field's only exit needs 3 salvage: arriving outside with nothing open is a death, not a free shelter.
    expect(miniPlay(s, ['go_out'])).toMatchObject({ sceneId: 'dead_asphyxiation', lastOutcome: { death: { how: 'stuck' } } });
    const sealedStuck = { ...s, scenes: s.scenes.map((x) => (x.id === 'field' ? { ...x, exposure: 'sealed' as const, shelter: 'safe' } : x)) };
    expect(miniPlay(sealedStuck, ['go_out'])).toMatchObject({ sceneId: 'safe', lastOutcome: { shelter: 'stuck' } });
  });
});

describe('restart', () => {
  it('replays a chapter from where the run entered it, alive, after a death there', () => {
    const atStation = play(['restore_memory', 'glass_ridge']);
    const dead = play(['copy_archive', 'follow_mica', 'careful_repair'], atStation);
    expect(dead.sceneId).toBe('death_asphyxiation');
    expect(runChapterId(story, dead)).toBe('ch2');
    const again = restartChapter(story, dead)!;
    expect(again.sceneId).toBe('weather_station');
    expect(again.state).toEqual(atStation.state);
    expect(again.history).toEqual(atStation.history);
    expect(isTerminal(getScene(story, again.sceneId))).toBe(false);
  });

  it('keeps chapter checkpoints through a death, and a new run starts fresh', () => {
    const dead = play(['restore_memory', 'glass_ridge', 'copy_archive', 'cross_exposed_ridge']);
    expect(dead.sceneId).toBe('death_suit_breach');
    expect(Object.keys(dead.checkpoints ?? {}).sort()).toEqual(['ch1', 'ch2']);
    expect(restartChapter(story, dead)?.sceneId).toBe('weather_station'); // died in chapter 2
    const early = createSession(story);
    expect(early).toMatchObject({ sceneId: 'impact', history: [] });
    expect(early.state).toMatchObject({ oxygen: 4, suitIntegrity: 3, stormClock: 7, escape: 'none' });
  });
});

describe('the whole story', () => {
  const report = explore(story);

  it('passes the data validator', () => {
    const { errors } = validateStory(story, { locales, ambiences: MOODS });
    expect(errors).toEqual([]);
  });

  it('ends every possible run at an ending or a death, with nothing stuck', () => {
    expect(report.pathCount).toBeGreaterThan(1000);
    expect(report.deadEnds).toEqual([]);
    expect(report.stuck).toEqual([]);
    expect(report.loops).toEqual([]);
    expect(report.visitedScenes.size).toBe(story.scenes.length);
  });

  it('reaches all three deaths, the three Vesper-6 outcomes, storm-forced shelter, and every final ending', () => {
    for (const id of ['death_asphyxiation', 'death_suit_breach', 'death_storm']) expect(report.endingCounts.get(id)).toBeGreaterThan(0);
    for (const id of ['ending_clear', 'ending_hard', 'ending_shelter']) expect(report.throughCounts.get(id)).toBeGreaterThan(0);
    expect(report.stormShelters).toBeGreaterThan(0);
    for (const s of story.scenes.filter((x) => x.ending)) expect(report.endingCounts.get(s.id)).toBeGreaterThan(0);
  });

  it('shows the exact outcome before every choice on Vesper-6 (preview equals result)', () => {
    let checked = 0;
    const walk = (s: Session) => {
      const scene = getScene(story, s.sceneId);
      if (isTerminal(scene) || scene.chapter === 'ch3') return;
      for (const v of getChoiceViews(story, scene, s.state).filter((x) => x.available)) {
        const next = choose(story, s, v.choice.id);
        expect(next.sceneId).toBe(v.resolution!.sceneId);
        checked += 1;
        if (scene.chapterEnd) continue;
        walk(next);
      }
    };
    walk(createSession(story));
    expect(checked).toBeGreaterThan(100);
  });

  it('keeps a route to each survival outcome', () => {
    expect(play(['restore_memory', 'glass_ridge', 'leave_with_coupler', 'follow_mica', 'careful_repair', 'clear_launch']).sceneId).toBe('ending_clear');
    expect(play(['save_battery', 'glass_ridge', 'copy_archive', 'follow_mica', 'careful_repair', 'clear_launch']).sceneId).toBe('ending_clear');
    expect(play(['restore_memory', 'dry_ravine', 'leave_with_coupler', 'use_filter', 'careful_repair', 'clear_launch']).sceneId).toBe('ending_clear');
    expect(play(['save_battery', 'dry_ravine', 'leave_with_coupler', 'use_filter', 'quick_patch', 'hard_burn']).sceneId).toBe('ending_hard');
    expect(play(['save_battery', 'glass_ridge', 'take_shelter']).sceneId).toBe('ending_shelter');
  });

  it('removes the coupler from the pack once it is installed', () => {
    const rule = story.flagRules!.couplerFound;
    const atRepair = play(['save_battery', 'dry_ravine', 'leave_with_coupler', 'cross_exposed_ridge']);
    expect(conditionsPass(rule.hudWhen, atRepair.state)).toBe(true);
    expect(conditionsPass(rule.hudWhen, choose(story, atRepair, 'quick_patch').state)).toBe(false);
  });

  it('carries each Vesper-6 outcome into chapter 3', () => {
    const clear = play(['restore_memory', 'glass_ridge', 'leave_with_coupler', 'follow_mica', 'careful_repair', 'clear_launch', 'to_chapter_3']);
    expect(clear).toMatchObject({ sceneId: 'relay_signal', state: { escape: 'clear' } });
    expect(clear.checkpoints?.ch3?.sceneId).toBe('relay_signal');
    expect(play(['save_battery', 'dry_ravine', 'leave_with_coupler', 'use_filter', 'quick_patch', 'hard_burn', 'to_chapter_3']).sceneId).toBe('hard_drift');
    expect(play(['save_battery', 'glass_ridge', 'take_shelter', 'to_chapter_3']).sceneId).toBe('shelter_morning');
  });

  it('explains the strain when a carefully repaired ship takes the hard burn', () => {
    const s = play(['restore_memory', 'glass_ridge', 'leave_with_coupler', 'follow_mica', 'careful_repair', 'hard_burn']);
    expect(activeVariants(getScene(story, s.sceneId), s.state).map((v) => v.id)).toContain('careful_strain');
  });
});

describe('validator', () => {
  it('rejects the old unconditional fallback and scenes without exposure', () => {
    const s = mini();
    expect(validateStory({ ...s, fallbackScene: 'safe' } as Story).errors.join()).toMatch(/fallbackScene/);
    const noExposure = { ...s, scenes: s.scenes.map((x) => (x.id === 'yard' ? { ...x, exposure: undefined } : x)) };
    expect(validateStory(noExposure).errors.join()).toMatch(/exposure/);
    const noDeath = { ...s, scenes: s.scenes.filter((x) => x.id !== 'dead_storm') };
    expect(validateStory(noDeath).errors.join()).toMatch(/no death scene for cause "storm"/);
  });
});

describe('effects and saves', () => {
  it('clamps gains with stateRules and does not mutate the input', () => {
    const state = { oxygen: 5, flag: false };
    const next = applyEffects(state, { add: { oxygen: 3 }, set: { flag: true } }, story.stateRules);
    expect(next).toEqual({ oxygen: 6, flag: true });
    expect(state).toEqual({ oxygen: 5, flag: false });
  });

  it('restores a valid save, fills fields added later, and rejects saves that do not fit', () => {
    const s = play(['restore_memory']);
    const { stormClock: _old, ...olderState } = s.state;
    expect(restoreSession(story, { ...s, state: olderState })?.state.stormClock).toBe(7);
    expect(restoreSession(story, { ...s, sceneId: 'nowhere' })).toBeNull();
    expect(restoreSession(story, { ...s, state: { ...s.state, oxygen: 'lots' } })).toBeNull();
  });

  it('drops a damaged "last action" instead of breaking the screen', () => {
    const good = play(['restore_memory']);
    expect(restoreSession(story, { ...good, lastOutcome: { choiceId: 'x', fromSceneId: 'impact', items: 'garbage' } })?.lastOutcome).toBeUndefined();
  });
});

describe('translations', () => {
  it('covers every story string in fr, es, it and pt', () => {
    expect(locales.map((l) => l.language).sort()).toEqual(['es', 'fr', 'it', 'pt']);
    const { errors } = validateStory(story, { locales });
    expect(errors.filter((e) => e.startsWith('Locale'))).toEqual([]);
  });

  it('translates the death scenes and the Storm Clock', () => {
    const fr = localizeStory(story, locales.find((l) => l.language === 'fr')!);
    expect(getScene(fr, 'death_suit_breach').title).toBe('Combinaison percée');
    expect(fr.stateRules.stormClock.label).toBe('Horloge tempête');
  });
});
