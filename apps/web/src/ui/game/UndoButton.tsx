/** Undo (M12.2): takes back the last action of this turn. Hidden in strict mode and off-turn. */
import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { haptic } from '../../store/haptics';
import { useSettings } from '../../store/settings';
import { Button } from '../common/Button';
import { GLYPH } from '../common/glyphs';

/** `icon`: a square glyph button for tight bars (the label stays as its accessible name). */
export function UndoButton({
  className = '',
  icon = false,
}: {
  className?: string;
  icon?: boolean;
}) {
  const { t } = useTranslation();
  const steps = useGame((s) => s.undoStack.length);
  const undo = useGame((s) => s.undoLast);
  const yourTurn = useGame(
    (s) => s.state?.players[s.state.activeSeat]?.controller === 'human-local',
  );
  const strict = useSettings((s) => s.settings.strictMode);
  if (strict || !yourTurn) return null;
  return (
    <Button
      className={`${icon ? 'w-11 shrink-0 px-0' : ''} ${className}`}
      aria-label={icon ? t('hud.undo') : undefined}
      disabled={steps === 0}
      aria-keyshortcuts="Control+Z Z"
      title={t('hud.undoHint')}
      onClick={() => {
        if (undo()) haptic('tap');
      }}
      data-testid="undo-btn"
    >
      {icon ? GLYPH.undo : t('hud.undo')}
    </Button>
  );
}
