import { useState } from 'react';
import { artUrl } from '../content';
import { activeVariants } from '../engine/engine';
import type { GameState, Scene } from '../engine/types';
import { fill, type UiStrings } from '../i18n/ui';
import { beats, splitDialogue } from './describe';

interface Props {
  scene: Scene;
  state: GameState;
  callsign: string;
  ui: UiStrings;
}

type Block = { kind: 'narration'; text: string } | { kind: 'speech'; speaker: string; lines: string[] };

const MICA_ICON = 'icon-mica.svg';

/** Keeps names like "Vesper-6" or "Station 04" from breaking across lines. */
function keepTogether(text: string) {
  const parts = text.split(/(\S+-\d+|Station \d+|Stazione \d+|Estación \d+|Estação \d+)/);
  return parts.map((part, i) => (i % 2 === 1 ? <span key={i} className="nowrap">{part}</span> : part));
}

/** One sentence on screen. The rest stays in the page for anyone who asks, including assistive tech. */
function Beat({ text, open }: { text: string; open: boolean }) {
  const { lead, rest } = beats(text);
  return (
    <>
      {keepTogether(lead)}
      {rest && (
        <span className={open ? 'more-copy is-open' : 'more-copy'}>
          {' '}
          {keepTogether(rest)}
        </span>
      )}
    </>
  );
}

function hasRest(text: string) {
  return beats(text).rest.length > 0;
}

export function Narrative({ scene, state, callsign, ui }: Props) {
  const [open, setOpen] = useState(false);
  const blocks: Block[] = [];
  const push = (kind: 'narration' | 'speech', text: string, speaker?: string) => {
    const t = fill(text, { callsign });
    const prev = blocks[blocks.length - 1];
    if (kind === 'speech' && speaker && prev?.kind === 'speech' && prev.speaker === speaker) prev.lines.push(t);
    else if (kind === 'speech' && speaker) blocks.push({ kind: 'speech', speaker, lines: [t] });
    else blocks.push({ kind: 'narration', text: t });
  };

  if (scene.speaker) for (const seg of splitDialogue(scene.text)) push(seg.kind, seg.text, scene.speaker);
  else push('narration', scene.text);
  for (const v of activeVariants(scene, state)) push(v.speaker ? 'speech' : 'narration', v.text, v.speaker);

  const more = blocks.some((block) => (block.kind === 'narration' ? hasRest(block.text) : block.lines.some(hasRest)));
  // Anchors kept so a first scene can point at the story and at MICA without a tour.
  const firstNarration = blocks.findIndex((b) => b.kind === 'narration');
  const firstMica = blocks.findIndex((b) => b.kind === 'speech' && b.speaker === 'MICA');
  return (
    <div className={`narrative${open ? ' is-open' : ''}`}>
      {blocks.map((block, i) =>
        block.kind === 'narration' ? (
          <p key={i} className="narration" data-tour={i === firstNarration ? 'story' : undefined}>
            <Beat text={block.text} open={open} />
          </p>
        ) : (
          <div
            key={i}
            className={`dialogue dialogue-${block.speaker.toLowerCase().replace(/[^a-z0-9]+/g, '')}`}
            role="group"
            aria-label={block.speaker}
            data-tour={block.speaker === 'MICA' && i === firstMica ? 'mica' : undefined}
          >
            {(block.speaker === 'MICA' || block.speaker === 'K-7') && (
              <img className="dialogue-icon" src={artUrl(MICA_ICON)} alt="" width={32} height={32} />
            )}
            <div className="dialogue-body">
              <span className="speaker">{block.speaker}</span>
              {block.lines.map((line, j) => (
                <p key={j}>
                  <Beat text={line} open={open} />
                </p>
              ))}
            </div>
          </div>
        ),
      )}
      {more && (
        <button
          type="button"
          className="more-toggle"
          data-action="more-text"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? ui.showLess : ui.showMore}
        </button>
      )}
    </div>
  );
}
