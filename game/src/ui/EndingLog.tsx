import { useState } from 'react';
import type { GameState, Scene, Story } from '../engine/types';
import { fill, type UiStrings } from '../i18n/ui';
import { shareText, SITE_URL, type ShareResult } from '../share';
import { EndingsGallery, galleryOutcomes } from './EndingsGallery';
import { FieldLog } from './FieldLog';

interface Props {
  story: Story;
  scene: Scene;
  state: GameState;
  ui: UiStrings;
  found: string[];
  onPlayAgain: () => void;
  onTitle: () => void;
}

export function EndingLog({ story, scene, state, ui, found, onPlayAgain, onTitle }: Props) {
  const [shared, setShared] = useState<ShareResult | null>(null);
  const outcomes = galleryOutcomes(story);
  const message = fill(ui.shareText, {
    ending: scene.title,
    n: outcomes.filter((e) => found.includes(e.id)).length,
    total: outcomes.length,
  });

  return (
    <section className="ending-log" aria-labelledby="field-log-heading">
      <FieldLog story={story} state={state} ui={ui} chapterId={scene.chapter} />
      <EndingsGallery story={story} ui={ui} found={found} />
      <div className="ending-actions">
        <button type="button" className="btn btn-primary" onClick={onPlayAgain} data-action="play-again">
          {ui.playAgain}
        </button>
        <button
          type="button"
          className="btn"
          data-action="share"
          onClick={async () => setShared(await shareText(story.title, message, SITE_URL))}
        >
          {ui.share}
        </button>
        <button type="button" className="btn" onClick={onTitle}>
          {ui.toTitle}
        </button>
      </div>
      <div className="share-status" role="status">
        {shared === 'copied' && ui.shareCopied}
        {shared === 'manual' && (
          <label className="field">
            <span className="field-label">{ui.shareManual}</span>
            <textarea readOnly rows={3} value={`${message} ${SITE_URL}`} onFocus={(e) => e.currentTarget.select()} />
          </label>
        )}
      </div>
    </section>
  );
}
