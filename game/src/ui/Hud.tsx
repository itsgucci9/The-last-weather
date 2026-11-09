import { artUrl } from '../content';
import { conditionsPass } from '../engine/engine';
import type { Session, Story } from '../engine/types';
import type { UiStrings } from '../i18n/ui';
import type { Reveal } from './guide';

export interface MeterPop {
  id: number;
  field: string;
  delta: number;
}

interface Props {
  story: Story;
  session: Session;
  ui: UiStrings;
  /** Which meters to show (they appear the first time they matter) and which are new here. */
  reveal: Reveal;
  /** Numeric changes since the previous scene, drawn as a short pop on the icon. */
  pops?: MeterPop[];
}

/**
 * Your status, introduced step by step: a meter appears the first time a scene uses it (marked
 * "New"), the pack only once it holds something, and a status line once it means something.
 */
export function Hud({ story, session, ui, reveal, pops = [] }: Props) {
  const { state } = session;
  const inventory = Object.entries(story.flagRules ?? {}).filter(
    ([field, rule]) => rule.hud === 'inventory' && state[field] === true && conditionsPass(rule.hudWhen, state),
  );
  if (!reveal.meters.length && !inventory.length) return null;

  return (
    <section className="hud" aria-label={ui.status}>
      <ul className="meters">
        {reveal.meters.map((field) => {
          const rule = story.stateRules[field];
          const value = state[field] as number;
          const low = rule.warnAt !== undefined && value <= rule.warnAt;
          const fresh = reveal.fresh.includes(field);
          // A clock warns that the storm is close, then that it is here; other meters say "Low".
          const warning = rule.clock ? (value <= rule.min ? ui.stormHere : ui.stormClose) : ui.low;
          const span = Math.max(1, rule.max - rule.min);
          const level = Math.max(0, Math.min(1, (value - rule.min) / span));
          return (
            <li
              key={field}
              className={`meter meter-${field}${rule.clock ? ' meter-clock' : ''}${low ? ' is-low' : ''}${fresh ? ' is-new' : ''}`}
              data-tour={`meter-${field}`}
              style={{ ['--level' as string]: String(level) }}
            >
              <span className="meter-glyph" aria-hidden="true">
                {rule.icon && <img className="meter-icon" src={artUrl(rule.icon)} alt="" width={32} height={32} />}
                <span className="meter-fill" />
                {low && <span className="meter-crack" />}
                {pops
                  .filter((pop) => pop.field === field)
                  .map((pop) => (
                    <span key={pop.id} className={`delta-pop${pop.delta > 0 ? ' up' : ' down'}`}>
                      {pop.delta > 0 ? `+${pop.delta}` : `−${Math.abs(pop.delta)}`}
                    </span>
                  ))}
              </span>
              <span className="meter-label sr">
                {rule.label}
                {fresh && <span className="sr">{ui.newBadge}</span>}
              </span>
              <span className="meter-bar">
                <span className="pips" aria-hidden="true">
                  {Array.from({ length: rule.max - rule.min }, (_, i) => (
                    <span key={i} className={i < value - rule.min ? 'pip on' : 'pip'} />
                  ))}
                </span>
                <span className="meter-value">
                  <span key={value} className="meter-number">
                    {value}
                    <span className="meter-max">/{rule.max}</span>
                  </span>
                  {low && <span className="meter-low">{warning}</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {inventory.length > 0 && (
        <div className="hud-lines">
          <div className="pack">
            <span className="pack-label sr">{ui.pack}</span>
            <ul className="pack-items">
              {inventory.map(([field, rule]) => (
                <li key={field} className="pack-item">
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
