import { chapterNumber, conditionsPass } from '../engine/engine';
import type { GameState, Story } from '../engine/types';
import type { UiStrings } from '../i18n/ui';
import { valueLabel } from './describe';

interface Props {
  story: Story;
  state: GameState;
  ui: UiStrings;
  /** Chapter the player is in: entries marked logFrom a later chapter are left out. */
  chapterId?: string;
}

/** The run so far: logged decisions, then the final status of every meter. */
export function FieldLog({ story, state, ui, chapterId }: Props) {
  const current = chapterNumber(story, chapterId);
  const logged = Object.entries(story.flagRules ?? {}).filter(
    ([, rule]) => rule.log && (!rule.logFrom || !current || chapterNumber(story, rule.logFrom) <= current),
  );
  return (
    <>
      <h3 id="field-log-heading" className="eyebrow">
        {ui.fieldLog}
      </h3>
      <dl className="log-list">
        {logged.map(([field, rule]) => (
          <div key={field} className="log-row">
            <dt>{rule.label}</dt>
            <dd>{valueLabel(story, field, state[field])}</dd>
          </div>
        ))}
      </dl>
      <h4 className="eyebrow">{ui.finalStatus}</h4>
      <ul className="final-stats">
        {Object.entries(story.stateRules)
          .filter(([, rule]) => conditionsPass(rule.hudWhen, state))
          .map(([field, rule]) => (
          <li key={field}>
            <span>{rule.label}</span>
            <strong>
              {String(state[field])}/{rule.max}
            </strong>
          </li>
        ))}
      </ul>
    </>
  );
}
