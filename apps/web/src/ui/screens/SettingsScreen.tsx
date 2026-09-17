import { useTranslation } from 'react-i18next';
import { useGame } from '../../store/gameStore';
import { useSettings, type TextScale, type Theme } from '../../store/settings';
import { Button } from '../common/Button';
import { Field } from '../common/Field';

export function SettingsScreen() {
  const { t } = useTranslation();
  const go = useGame((s) => s.go);
  const hasGame = useGame((s) => s.state !== null);
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const resetData = useSettings((s) => s.resetData);
  return (
    <section className="mx-auto max-w-xl p-4 sm:p-6">
      <h1 className="mb-4 text-3xl font-bold">{t('settings.heading')}</h1>
      <div className="grid gap-4">
        <Field
          label={`${t('settings.music')}: ${Math.round(settings.musicVolume * 100)}%`}
          htmlFor="music"
        >
          <input
            id="music"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.musicVolume}
            onChange={(e) => update({ musicVolume: Number(e.target.value) })}
          />
        </Field>
        <Field
          label={`${t('settings.sfx')}: ${Math.round(settings.sfxVolume * 100)}%`}
          htmlFor="sfx"
        >
          <input
            id="sfx"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.sfxVolume}
            onChange={(e) => update({ sfxVolume: Number(e.target.value) })}
          />
        </Field>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => update({ muted: e.target.checked })}
          />
          {t('settings.mute')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => update({ reducedMotion: e.target.checked })}
            data-testid="reduced-motion"
          />
          {t('settings.reducedMotion')}
        </label>
        <Field label={t('settings.textScale')} htmlFor="textScale">
          <select
            id="textScale"
            className="input"
            value={settings.textScale}
            onChange={(e) => update({ textScale: Number(e.target.value) as TextScale })}
          >
            <option value={100}>100%</option>
            <option value={125}>125%</option>
            <option value={150}>150%</option>
          </select>
        </Field>
        <Field label={t('settings.theme')} htmlFor="theme">
          <select
            id="theme"
            className="input"
            value={settings.theme}
            onChange={(e) => update({ theme: e.target.value as Theme })}
          >
            <option value="system">{t('settings.theme.system')}</option>
            <option value="light">{t('settings.theme.light')}</option>
            <option value="dark">{t('settings.theme.dark')}</option>
          </select>
        </Field>
        <Field label={t('settings.aiSpeed')} htmlFor="aiSpeed">
          <select
            id="aiSpeed"
            className="input"
            value={settings.aiSpeed}
            onChange={(e) => update({ aiSpeed: e.target.value as typeof settings.aiSpeed })}
          >
            <option value="instant">{t('settings.aiSpeed.instant')}</option>
            <option value="fast">{t('settings.aiSpeed.fast')}</option>
            <option value="normal">{t('settings.aiSpeed.normal')}</option>
          </select>
        </Field>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.classicOpacityDefault}
            onChange={(e) => update({ classicOpacityDefault: e.target.checked })}
          />
          {t('settings.classicOpacity')}
        </label>
        <Field label={t('settings.language')} htmlFor="language">
          <select
            id="language"
            className="input"
            value={settings.language}
            onChange={(e) => update({ language: e.target.value as 'en' | 'pseudo' })}
          >
            <option value="en">{t('settings.language.en')}</option>
          </select>
        </Field>
        <Button
          variant="danger"
          onClick={() => {
            if (globalThis.confirm(t('settings.resetConfirm'))) resetData();
          }}
        >
          {t('settings.resetData')}
        </Button>
        <Button onClick={() => go(hasGame ? 'game' : 'title')} data-testid="back">
          {t('settings.back')}
        </Button>
      </div>
    </section>
  );
}
