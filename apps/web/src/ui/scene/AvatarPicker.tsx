/**
 * Avatar picker for a human seat in New Game Setup (ART_SPEC 17.3, M9.7): the six player avatars
 * as a radio group, each previewed in the seat's colour. Native radios keep it keyboard and
 * screen-reader friendly; the pictures are decorative.
 */
import { PLAYER_AVATARS } from '@hustle-ring/art';
import type { PaletteId } from '@hustle-ring/shared';
import { useTranslation } from 'react-i18next';
import type { ArtRegistry } from '../../assets/art/artRegistry';
import { ArtImage } from './ArtImage';

export function AvatarPicker({
  registry,
  seat,
  value,
  color,
  onChange,
}: {
  registry: ArtRegistry;
  seat: number;
  value: string;
  color: PaletteId;
  onChange: (avatar: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="flex min-w-0 flex-col gap-1" data-testid={`avatar-picker-${seat}`}>
      <legend className="text-sm font-medium">{t('setup.avatar')}</legend>
      <div className="flex flex-wrap gap-1">
        {PLAYER_AVATARS.map((id, n) => (
          <label
            key={id}
            className="flex cursor-pointer flex-col items-center rounded-md border-2 border-line p-1 has-[:checked]:border-accent has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
          >
            <input
              type="radio"
              className="sr-only"
              name={`avatar-${seat}`}
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
              data-testid={`avatar-${seat}-${id}`}
            />
            <ArtImage
              registry={registry}
              artKey={`avatar:${id}:idle:s`}
              tint={color}
              className="h-12 w-8"
            />
            <span className="text-xs">{t('setup.avatarN', { n: n + 1 })}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
