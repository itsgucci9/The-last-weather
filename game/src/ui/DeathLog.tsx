import type { Scene, Session, Story } from '../engine/types';
import { fill, type UiStrings } from '../i18n/ui';
import { EndingsGallery } from './EndingsGallery';
import { FieldLog } from './FieldLog';

interface Props {
  story: Story;
  /** The death scene (its title is the cause). */
  scene: Scene;
  session: Session;
  ui: UiStrings;
  found: string[];
  deaths: string[];
  /** Chapter where the player died, and whether it can be replayed from its start. */
  chapterId?: string;
  chapterNo: number;
  canRestartChapter: boolean;
  onRestartChapter: () => void;
  onNewRun: () => void;
  onTitle: () => void;
}

/** The run is over: what killed the player, where, after which choice, and the ways to start again. */
export function DeathLog({ story, scene, session, ui, found, deaths, chapterId, chapterNo, canRestartChapter, onRestartChapter, onNewRun, onTitle }: Props) {
  const death = session.lastOutcome?.death;
  const place = death ? story.scenes.find((s) => s.id === death.at) : undefined;
  const from = session.lastOutcome ? story.scenes.find((s) => s.id === session.lastOutcome!.fromSceneId) : undefined;
  const lastChoice = from?.choices?.find((c) => c.id === session.lastOutcome!.choiceId);

  return (
    <section className="ending-log death-log" aria-labelledby="death-facts-heading">
      <h3 id="death-facts-heading" className="eyebrow">
        {ui.youDied}
      </h3>
      <dl className="log-list death-facts">
        <div className="log-row">
          <dt>{ui.deathCause}</dt>
          <dd data-death-cause={scene.death}>{scene.title}</dd>
        </div>
        {place && (
          <div className="log-row">
            <dt>{ui.deathWhere}</dt>
            <dd>{place.location ?? place.title}</dd>
          </div>
        )}
        {lastChoice && (
          <div className="log-row">
            <dt>{ui.deathChoice}</dt>
            <dd>{lastChoice.label}</dd>
          </div>
        )}
      </dl>
      <FieldLog story={story} state={session.state} ui={ui} chapterId={chapterId} />
      <EndingsGallery story={story} ui={ui} found={found} deaths={deaths} />
      <div className="ending-actions">
        {canRestartChapter && (
          <button type="button" className="btn btn-primary" data-action="restart-chapter" onClick={onRestartChapter}>
            {fill(ui.tryChapterAgain, { n: chapterNo })}
          </button>
        )}
        <button type="button" className={canRestartChapter ? 'btn' : 'btn btn-primary'} data-action="play-again" onClick={onNewRun}>
          {canRestartChapter ? ui.newRun : ui.playAgain}
        </button>
        <button type="button" className="btn" onClick={onTitle}>
          {ui.toTitle}
        </button>
      </div>
    </section>
  );
}
