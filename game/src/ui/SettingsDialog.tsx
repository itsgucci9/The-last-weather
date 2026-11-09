import { useEffect, useRef, useState } from 'react';
import { fill, LANGUAGES, isLang, type Lang, type UiStrings } from '../i18n/ui';

export type TextSize = 'normal' | 'large';

interface Props {
  open: boolean;
  ui: UiStrings;
  lang: Lang;
  textSize: TextSize;
  sound: boolean;
  inRun: boolean;
  onClose: () => void;
  onLang: (lang: Lang) => void;
  onTextSize: (size: TextSize) => void;
  onSound: (on: boolean) => void;
  /** Show the first-scene hint again on the next new game. */
  onResetTutorial: () => void;
  onRestart: () => void;
  /** Present when the current chapter can be replayed from its start. */
  onRestartChapter?: () => void;
  onTitle: () => void;
}

export function SettingsDialog({
  open,
  ui,
  lang,
  textSize,
  sound,
  inRun,
  onClose,
  onLang,
  onTextSize,
  onSound,
  onResetTutorial,
  onRestart,
  onRestartChapter,
  onTitle,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmingChapter, setConfirmingChapter] = useState(false);
  const [tutorialNote, setTutorialNote] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) {
      setConfirming(false);
      setConfirmingChapter(false);
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="settings"
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // tap on the backdrop
      }}
    >
      <div className="settings-inner">
        <header className="settings-head">
          <h2 id="settings-title">{ui.settings}</h2>
          <button type="button" className="btn btn-small" onClick={onClose}>
            {ui.close}
          </button>
        </header>

        <label className="field">
          <span className="field-label">{ui.language}</span>
          <select value={lang} onChange={(e) => isLang(e.target.value) && onLang(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <div className="field" role="group" aria-labelledby="text-size-label">
          <span id="text-size-label" className="field-label">
            {ui.textSize}
          </span>
          <div className="segmented">
            {(['normal', 'large'] as const).map((size) => (
              <button key={size} type="button" className="btn btn-small" aria-pressed={textSize === size} onClick={() => onTextSize(size)}>
                {size === 'normal' ? ui.textNormal : ui.textLarge}
              </button>
            ))}
          </div>
        </div>

        <div className="field" role="group" aria-labelledby="sound-label">
          <span id="sound-label" className="field-label">
            {ui.sound}
          </span>
          <div className="segmented">
            {([true, false] as const).map((on) => (
              <button
                key={String(on)}
                type="button"
                className="btn btn-small"
                data-sound={on ? 'on' : 'off'}
                aria-pressed={sound === on}
                onClick={() => onSound(on)}
              >
                {on ? ui.soundOn : ui.soundOff}
              </button>
            ))}
          </div>
        </div>

        <div className="field" role="group" aria-labelledby="tutorial-label">
          <span id="tutorial-label" className="field-label">
            {ui.tutorialSetting}
          </span>
          <button
            type="button"
            className="btn btn-small reset-tutorial"
            data-action="reset-tutorial"
            onClick={() => {
              onResetTutorial();
              setTutorialNote(true);
            }}
          >
            {ui.resetTutorial}
          </button>
          {tutorialNote && (
            <span className="settings-note" role="status">
              {ui.resetTutorialDone}
            </span>
          )}
        </div>

        {inRun && (
          <div className="settings-actions">
            {onRestartChapter && (
              <button
                type="button"
                className={`btn${confirmingChapter ? ' btn-danger' : ''}`}
                data-action="restart-chapter"
                onClick={() => {
                  if (confirmingChapter) {
                    setConfirmingChapter(false);
                    onRestartChapter();
                  } else setConfirmingChapter(true);
                }}
              >
                {confirmingChapter ? ui.restartChapterConfirm : ui.restartChapter}
              </button>
            )}
            <button
              type="button"
              className={`btn${confirming ? ' btn-danger' : ''}`}
              data-action="restart"
              onClick={() => {
                if (confirming) {
                  setConfirming(false);
                  onRestart();
                } else setConfirming(true);
              }}
            >
              {confirming ? ui.restartConfirm : ui.restart}
            </button>
            <button type="button" className="btn" onClick={onTitle}>
              {ui.toTitle}
            </button>
          </div>
        )}
        <p className="settings-note">{ui.saveNote}</p>
        <p className="settings-note settings-version">{fill(ui.version, { v: __APP_VERSION__ })}</p>
      </div>
    </dialog>
  );
}
