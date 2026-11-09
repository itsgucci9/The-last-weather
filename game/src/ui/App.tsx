import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ambience, isMood } from '../audio';
import { artAlt, artUrl, baseStory, storyFor } from '../content';
import {
  activeVariants,
  chapterNumber,
  choose,
  createSession,
  getChoiceViews,
  getScene,
  isDeath,
  isOutcomeScene,
  isTerminal,
  restartChapter,
  restoreSession,
  runChapterId,
} from '../engine/engine';
import type { Session } from '../engine/types';
import { detectLanguage, fill, isLang, LANGUAGES, UI, type Lang } from '../i18n/ui';
import { KEYS, readJson, remove, storageAvailable, writeJson } from '../storage';
import { onUpdateReady } from '../pwa';
import { Choices, orderViews } from './Choices';
import { DeathLog } from './DeathLog';
import { placeKind, revealMeters } from './guide';
import { EndingLog } from './EndingLog';
import { EndingsGallery } from './EndingsGallery';
import { FieldLog } from './FieldLog';
import { Hud, type MeterPop } from './Hud';
import { Narrative } from './Narrative';
import { SettingsDialog, type TextSize } from './SettingsDialog';

interface Settings {
  lang: Lang;
  textSize: TextSize;
  sound: boolean;
}

/** Tutorial progress: whether the guided first scene has been done. */
interface Tutorial {
  tourDone: boolean;
}

function loadTutorial(): Tutorial {
  const saved = readJson<Partial<Tutorial>>(KEYS.tutorial);
  return { tourDone: saved?.tourDone === true };
}

interface Run {
  session: Session;
  callsign: string;
}

interface SavedRun {
  version: 1;
  story: string;
  callsign: string;
  session: Session;
}

const CALLSIGN_MAX = 16;

function loadSettings(): Settings {
  const saved = readJson<Partial<Settings>>(KEYS.settings);
  return {
    lang: isLang(saved?.lang) ? saved.lang : detectLanguage(typeof navigator !== 'undefined' ? navigator.languages : undefined),
    textSize: saved?.textSize === 'large' ? 'large' : 'normal',
    sound: saved?.sound !== false,
  };
}

function loadRun(): Run | null {
  const saved = readJson<SavedRun>(KEYS.run);
  if (!saved || saved.version !== 1 || saved.story !== baseStory.title) return null;
  const session = restoreSession(baseStory, saved.session);
  if (!session) return null;
  return { session, callsign: typeof saved.callsign === 'string' ? saved.callsign.slice(0, CALLSIGN_MAX) : '' };
}

export function App() {
  // Opening the page with #crash-test shows the safety screen (used by the QA checks).
  if (typeof window !== 'undefined' && window.location.hash === '#crash-test') throw new Error('Crash test');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [run, setRun] = useState<Run | null>(loadRun);
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [menuOpen, setMenuOpen] = useState(false);
  const [endingsFound, setEndingsFound] = useState<string[]>(() => readJson<string[]>(KEYS.endings) ?? []);
  const [deathsFound, setDeathsFound] = useState<string[]>(() => readJson<string[]>(KEYS.deaths) ?? []);
  // A lethal choice waiting for its confirming second tap.
  const [armed, setArmed] = useState<string | null>(null);
  const [callsignDraft, setCallsignDraft] = useState(() => run?.callsign ?? '');
  const [confirmNew, setConfirmNew] = useState(false);
  const [canSave] = useState(storageAvailable);
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);
  const [tutorial, setTutorial] = useState<Tutorial>(loadTutorial);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const ui = UI[settings.lang];
  const story = useMemo(() => storyFor(settings.lang), [settings.lang]);
  const scene = run ? getScene(story, run.session.sceneId) : null;
  const views = useMemo(() => (scene && run ? getChoiceViews(story, scene, run.session.state) : []), [story, scene, run]);
  const callsign = run?.callsign || ui.defaultCallsign;
  // A run that reached an ending or a death is finished: the title screen offers a fresh start, not "Continue".
  const inProgress = !!run && !isTerminal(getScene(baseStory, run.session.sceneId));
  const chapterId = run ? runChapterId(story, run.session) : undefined;
  const chapter = chapterId ? story.chapters?.find((c) => c.id === chapterId) : undefined;
  const chapterNo = chapterNumber(story, chapter?.id);
  const canRestartChapter = !!run && chapterNo > 1 && !!chapter && !!run.session.checkpoints?.[chapter.id];

  // Persist settings, run, endings and tutorial progress.
  useEffect(() => writeJson(KEYS.settings, settings), [settings]);
  useEffect(() => writeJson(KEYS.tutorial, tutorial), [tutorial]);
  useEffect(() => {
    if (run) writeJson(KEYS.run, { version: 1, story: baseStory.title, callsign: run.callsign, session: run.session } satisfies SavedRun);
    else remove(KEYS.run);
  }, [run]);
  useEffect(() => {
    if (scene && isOutcomeScene(scene) && !endingsFound.includes(scene.id)) {
      const next = [...endingsFound, scene.id];
      setEndingsFound(next);
      writeJson(KEYS.endings, next);
    }
  }, [scene, endingsFound]);
  useEffect(() => {
    if (scene && isDeath(scene) && !deathsFound.includes(scene.id)) {
      const next = [...deathsFound, scene.id];
      setDeathsFound(next);
      writeJson(KEYS.deaths, next);
    }
  }, [scene, deathsFound]);

  useEffect(() => {
    document.documentElement.lang = settings.lang === 'pt' ? 'pt-BR' : settings.lang;
    document.documentElement.dataset.textSize = settings.textSize;
  }, [settings]);

  useEffect(() => {
    document.title = screen === 'game' && scene ? `${scene.title} · ${baseStory.title}` : baseStory.title;
  }, [screen, scene]);

  useEffect(() => onUpdateReady((apply) => setApplyUpdate(() => apply)), []);

  // Sound: follows the setting; the mood follows the scene; MICA's channel crackles when she speaks.
  useEffect(() => {
    ambience.setEnabled(settings.sound);
    document.documentElement.dataset.sound = settings.sound ? 'on' : 'off';
  }, [settings.sound]);
  const ambienceKey = screen === 'game' && scene ? scene.id : 'title';
  useEffect(() => {
    if (ambienceKey === 'title' || !scene || !run) {
      ambience.setMood('wind');
      return;
    }
    ambience.setMood(isMood(scene.ambience) ? scene.ambience : 'wind');
    // MICA, K-7 and the Halcyon all speak over a radio channel.
    const voices = [scene.speaker, ...activeVariants(scene, run.session.state).map((v) => v.speaker)];
    if (voices.some((v) => v === 'MICA' || v === 'K-7' || v === 'HALCYON')) ambience.radio();
    // Only when the scene changes, not on every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambienceKey]);

  // Meters appear the first time they matter. The first scene of a first run teaches by playing:
  // one short hint, then the choice itself. No tour. The hint stays gone after that first choice.
  const reveal = useMemo(() => (run ? revealMeters(story, run.session) : { meters: [], fresh: [] }), [story, run]);
  const tourActive = !tutorial.tourDone && screen === 'game' && !!run && run.session.history.length === 0 && run.session.sceneId === story.initialScene;
  const tourShown = useRef(false);
  if (tourActive) tourShown.current = true;
  const [pops, setPops] = useState<MeterPop[]>([]);
  const meterSeen = useRef<Record<string, number>>({});
  const popSerial = useRef(0);
  useEffect(() => {
    if (!run) return;
    const born: MeterPop[] = [];
    for (const field of Object.keys(story.stateRules)) {
      const value = run.session.state[field];
      if (typeof value !== 'number') continue;
      const before = meterSeen.current[field];
      if (typeof before === 'number' && before !== value) {
        popSerial.current += 1;
        born.push({ id: popSerial.current, field, delta: value - before });
      }
      meterSeen.current[field] = value;
    }
    setPops(born);
  }, [run, story]);

  // Move focus to the new scene heading so keyboard and screen-reader users start at the new text.
  const sceneId = run?.session.sceneId;
  useEffect(() => setArmed(null), [sceneId]);
  useEffect(() => {
    if (screen !== 'game') return;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, sceneId]);

  const onChoose = useCallback(
    (choiceId: string) => {
      ambience.unlock();
      ambience.tap();
      setArmed(null);
      if (tourShown.current) {
        tourShown.current = false;
        setTutorial({ tourDone: true });
      }
      setRun((current) => (current ? { ...current, session: choose(story, current.session, choiceId) } : current));
    },
    [story],
  );

  /** Tap or key on a choice: a lethal choice is armed first and only taken on the second activation. */
  const activate = useCallback(
    (choiceId: string) => {
      const view = views.find((v) => v.choice.id === choiceId);
      if (!view?.available) return;
      if (view.resolution?.risk?.kind === 'death' && armed !== choiceId) {
        ambience.unlock();
        setArmed(choiceId);
        return;
      }
      onChoose(choiceId);
    },
    [views, armed, onChoose],
  );


  const startNewRun = useCallback((name: string) => {
    ambience.unlock();
    setRun({ session: createSession(baseStory), callsign: name.trim().slice(0, CALLSIGN_MAX) });
    setConfirmNew(false);
    setMenuOpen(false);
    setScreen('game');
  }, []);

  // Number keys pick a choice.
  useEffect(() => {
    if (screen !== 'game' || menuOpen || !scene || isTerminal(scene)) return;
    const open = orderViews(views).open;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const n = Number.parseInt(e.key, 10);
      if (!Number.isInteger(n) || n < 1 || n > open.length) return;
      e.preventDefault();
      activate(open[n - 1].choice.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, menuOpen, scene, views, activate]);

  const settingsDialog = (
    <SettingsDialog
      open={menuOpen}
      ui={ui}
      lang={settings.lang}
      textSize={settings.textSize}
      sound={settings.sound}
      inRun={screen === 'game'}
      onClose={() => setMenuOpen(false)}
      onLang={(lang) => setSettings((s) => ({ ...s, lang }))}
      onTextSize={(textSize) => setSettings((s) => ({ ...s, textSize }))}
      onSound={(sound) => {
        setSettings((s) => ({ ...s, sound }));
        ambience.setEnabled(sound);
        if (sound) ambience.unlock();
      }}
      onResetTutorial={() => {
        setTutorial({ tourDone: false });
      }}
      onRestart={() => startNewRun(run?.callsign ?? '')}
      onRestartChapter={
        canRestartChapter
          ? () => {
              setRun((current) => {
                const session = current && restartChapter(story, current.session);
                return current && session ? { ...current, session } : current;
              });
              setMenuOpen(false);
            }
          : undefined
      }
      onTitle={() => {
        setMenuOpen(false);
        setScreen('title');
      }}
    />
  );

  /** Begin a new run, or continue the saved one (title screen button and Enter in the callsign field). */
  const primaryAction = () => {
    if (run && inProgress && !confirmNew) {
      ambience.unlock();
      setRun({ ...run, callsign: callsignDraft.trim().slice(0, CALLSIGN_MAX) });
      setScreen('game');
    } else startNewRun(callsignDraft);
  };

  const updateBanner = applyUpdate && (
    <div className="update-banner" role="status">
      <span>{ui.updateReady}</span>
      <button type="button" className="btn btn-small" data-action="apply-update" onClick={applyUpdate}>
        {ui.reload}
      </button>
    </div>
  );

  if (screen === 'title' || !run || !scene) {
    return (
      <div className="app title-screen">
        {updateBanner}
        <main className="title-main">
          <figure className="art-frame title-art">
            <img src={artUrl('scene-impact.svg')} alt={artAlt('scene-impact.svg', settings.lang)} width={320} height={180} />
          </figure>
          <h1 className="game-title">{baseStory.title}</h1>

          {/* Not a <form>: sandboxed frames (game portals, embeds) block form submission outright. */}
          <div className="title-form">
            <label className="field">
              <span className="field-label">{ui.callsign}</span>
              <input
                type="text"
                name="callsign"
                value={callsignDraft}
                maxLength={CALLSIGN_MAX}
                placeholder={ui.defaultCallsign}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => setCallsignDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    primaryAction();
                  }
                }}
              />
            </label>

            <div className="title-actions">
              {inProgress ? (
                <>
                  <button type="button" className="btn btn-primary btn-continue" data-action="continue" onClick={primaryAction}>
                    {ui.continue}
                    {chapter && (
                      <span className="btn-sub">
                        {fill(ui.chapter, { n: chapterNo })} · {chapter.title}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`btn${confirmNew ? ' btn-danger' : ''}`}
                    data-action="new-run"
                    onClick={() => (confirmNew ? startNewRun(callsignDraft) : setConfirmNew(true))}
                  >
                    {confirmNew ? ui.restartConfirm : ui.newRun}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" data-action="begin" onClick={primaryAction}>
                  {ui.begin}
                </button>
              )}
            </div>
          </div>

          <label className="field field-inline">
            <span className="field-label">{ui.language}</span>
            <select value={settings.lang} onChange={(e) => isLang(e.target.value) && setSettings((s) => ({ ...s, lang: e.target.value as Lang }))}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          {(endingsFound.length > 0 || deathsFound.length > 0) && (
            <EndingsGallery story={story} ui={ui} found={endingsFound} deaths={deathsFound} headingLevel="h2" />
          )}
          {!canSave && <p className="settings-note">{ui.saveUnavailable}</p>}
        </main>
        {settingsDialog}
      </div>
    );
  }

  const { session } = run;
  const outcome = session.lastOutcome;
  const place = placeKind(story, session);
  // First scene of a chapter in this run: show the chapter's title card.
  const previous = session.history[session.history.length - 1];
  const chapterStart = !isDeath(scene) && (!previous || getScene(story, previous.sceneId).chapter !== scene.chapter);
  // A death is shown at the place where it happened.
  const dead = isDeath(scene);
  const deathAt = dead && outcome?.death ? story.scenes.find((s) => s.id === outcome.death!.at) : undefined;
  const shown = deathAt ?? scene;
  const airLow = typeof session.state.oxygen === 'number' && session.state.oxygen <= (story.stateRules.oxygen?.warnAt ?? 1);
  const restartThisChapter = () => {
    setRun((current) => {
      const restarted = current && restartChapter(story, current.session);
      return current && restarted ? { ...current, session: restarted } : current;
    });
    setMenuOpen(false);
  };
  const stormValue = typeof session.state.stormClock === 'number' ? session.state.stormClock : null;
  const stormShown = reveal.meters.includes('stormClock');
  const weather: 'off' | 'far' | 'near' | 'here' =
    place === 'storm' ? 'here' : !stormShown || stormValue === null ? 'off' : stormValue <= 0 ? 'here' : stormValue <= 2 ? 'near' : 'far';

  return (
    <div className={`app${tourActive ? ' is-learning' : ''}`}>
      {updateBanner}
      <header className="topbar">
        {ambience.supported && (
          <button
            type="button"
            className="btn btn-small icon-button sound-button"
            aria-label={ui.sound}
            aria-pressed={settings.sound}
            data-action="toggle-sound"
            onClick={() => {
              const sound = !settings.sound;
              setSettings((s) => ({ ...s, sound }));
              ambience.setEnabled(sound);
              if (sound) ambience.unlock();
            }}
          >
            <SoundIcon on={settings.sound} />
          </button>
        )}
        <button type="button" className="btn btn-small icon-button menu-button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" aria-label={ui.menu}>
          <MenuIcon />
        </button>
      </header>

      <main className="game">
        <div className="col-visual">
          <figure
            className={`art-frame${dead ? ' is-dead' : ''}`}
            data-weather={weather}
            data-air={airLow ? 'low' : 'ok'}
            key={`${shown.art}${dead ? '-dead' : ''}`}
          >
            <img src={artUrl(shown.art)} alt={artAlt(shown.art, settings.lang)} width={320} height={180} />
            <Weather level={weather} />
          </figure>
          <div className="hud-slot hud-slot-side">
            <Hud story={story} session={session} ui={ui} reveal={reveal} pops={pops} />
          </div>
        </div>

        <div className="col-story" key={scene.id}>
          <div className="hud-slot hud-slot-inline">
            <Hud story={story} session={session} ui={ui} reveal={reveal} pops={pops} />
          </div>
          {outcome?.shelter && (
            <p className="shelter-flash" data-shelter={outcome.shelter} role="status">
              <PlaceIcon kind="sealed" />
              <span className="sr">{outcome.shelter === 'storm' ? ui.forcedShelter : ui.stuckShelter}</span>
            </p>
          )}

          {chapterStart && chapter && !scene.chapterEnd && chapter.title !== scene.title && (
            <p className="chapter-card">
              <span className="chapter-card-title">{chapter.title}</span>
            </p>
          )}
          {scene.ending && <p className="eyebrow scene-eyebrow">{ui.ending}</p>}
          {dead && <p className="eyebrow scene-eyebrow death-eyebrow">{ui.youDied}</p>}
          {scene.chapterEnd && <p className="eyebrow scene-eyebrow chapter-complete">{fill(ui.chapterComplete, { n: chapterNo })}</p>}
          <h1 className="scene-title" tabIndex={-1} ref={headingRef}>
            {scene.title}
          </h1>
          {place && (
            <p className={`place place-${place}`} data-place={place}>
              <PlaceIcon kind={place} />
              <span className="sr">{place === 'sealed' ? ui.placeSealed : place === 'storm' ? ui.placeStorm : ui.placeExposed}</span>
            </p>
          )}
          <Narrative scene={scene} state={session.state} callsign={callsign} ui={ui} />

          {dead ? (
            <DeathLog
              story={story}
              scene={scene}
              session={session}
              ui={ui}
              found={endingsFound}
              deaths={deathsFound}
              chapterId={chapterId}
              chapterNo={chapterNo}
              canRestartChapter={canRestartChapter}
              onRestartChapter={restartThisChapter}
              onNewRun={() => startNewRun(run.callsign)}
              onTitle={() => setScreen('title')}
            />
          ) : scene.ending ? (
            <EndingLog
              story={story}
              scene={scene}
              state={session.state}
              ui={ui}
              found={endingsFound}
              onPlayAgain={() => startNewRun(run.callsign)}
              onTitle={() => setScreen('title')}
            />
          ) : (
            <>
              {scene.chapterEnd && (
                <section className="ending-log chapter-recap" aria-labelledby="field-log-heading">
                  <FieldLog story={story} state={session.state} ui={ui} chapterId={scene.chapter} />
                </section>
              )}
              {tourActive && <div className="coach" data-coach="play" aria-hidden="true" />}
              <Choices story={story} state={session.state} views={views} ui={ui} armed={armed} onActivate={activate} />
              <p className="key-hint">{fill(ui.keyHint, { n: orderViews(views).open.length })}</p>
            </>
          )}
        </div>
      </main>
      {settingsDialog}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" fill="currentColor">
      <rect x="1" y="2" width="8" height="1" />
      <rect x="1" y="5" width="8" height="1" />
      <rect x="1" y="8" width="8" height="1" />
    </svg>
  );
}

/** Dust and a storm bank drawn over the scene. The bank grows as the clock runs down. */
function Weather({ level }: { level: 'off' | 'far' | 'near' | 'here' }) {
  if (level === 'off') return null;
  return (
    <span className={`weather weather-${level}`} aria-hidden="true">
      <svg viewBox="0 0 320 180" preserveAspectRatio="none">
        <path d="M180 0h140v96H150z" className="weather-bank" />
        <path d="M230 8h18l-14 28h16L214 78l12-28h-16z" className="weather-bolt" />
        <rect x="24" y="70" width="4" height="4" className="weather-dust" />
        <rect x="70" y="54" width="3" height="3" className="weather-dust" />
        <rect x="120" y="78" width="4" height="4" className="weather-dust" />
        <rect x="168" y="46" width="3" height="3" className="weather-dust" />
        <rect x="40" y="88" width="5" height="3" className="weather-dust" />
        <rect x="200" y="84" width="4" height="3" className="weather-dust" />
      </svg>
    </span>
  );
}

/** Small pixel sign for where the player is: a warning triangle outside, a bolt in the storm, a shield inside. */
function PlaceIcon({ kind }: { kind: 'sealed' | 'exposed' | 'storm' }) {
  return (
    <svg className="place-icon" width="18" height="18" viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true" fill="currentColor">
      {kind === 'sealed' && <path d="M1 1h7v4H7v1H6v1H5v1H4V7H3V6H2V5H1z" />}
      {kind === 'exposed' && <path d="M4 0h1v1h1v2h1v2h1v3H0V5h1V3h1V1h1zM4 3v2h1V3zM4 6v1h1V6z" fillRule="evenodd" />}
      {kind === 'storm' && <path d="M4 0h4L6 3h2L2 9l2-4H2z" />}
    </svg>
  );
}

/** Pixel speaker icon: sound waves when on, a cross when off. */
function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" fill="currentColor">
      <rect x="0" y="3" width="2" height="4" />
      <rect x="2" y="2" width="1" height="6" />
      <rect x="3" y="1" width="1" height="8" />
      {on ? (
        <>
          <rect x="5" y="4" width="1" height="2" />
          <rect x="6" y="2" width="1" height="1" />
          <rect x="7" y="3" width="1" height="4" />
          <rect x="6" y="7" width="1" height="1" />
        </>
      ) : (
        <>
          <rect x="5" y="3" width="1" height="1" />
          <rect x="6" y="4" width="1" height="2" />
          <rect x="7" y="3" width="1" height="1" />
          <rect x="5" y="6" width="1" height="1" />
          <rect x="7" y="6" width="1" height="1" />
        </>
      )}
    </svg>
  );
}
