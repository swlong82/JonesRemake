/**
 * Art packs in Settings (ART_SPEC 17.6, M9.12): pick the active art set, import a pack from a
 * `.zip`, see exactly why an import was refused, and delete packs. Packs stay on this device.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteArtPack, importArtPack, useArtPackLibrary } from '../../assets/art/artPackLibrary';
import type { ImportResult } from '../../assets/art/importPack';
import { useServices } from '../../platform/Services';
import { useSettings } from '../../store/settings';
import { Button } from '../common/Button';

export function ArtPacksSection() {
  const { t } = useTranslation();
  const { artPacks } = useServices();
  const packs = useArtPackLibrary((s) => s.packs);
  const active = useSettings((s) => s.settings.artSet);
  const update = useSettings((s) => s.update);
  const [report, setReport] = useState<(ImportResult & { file: string }) | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File): Promise<void> => {
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setReport({ ...(await importArtPack(bytes, artPacks)), file: file.name });
    } catch {
      setReport({
        ok: false,
        issues: [{ path: file.name, message: t('artPacks.storeFailed') }],
        ignored: [],
        file: file.name,
      });
    } finally {
      setBusy(false);
    }
  };

  const options = [
    { id: 'default', name: t('artPacks.default') },
    ...packs.map((p) => ({ id: p.manifest.id, name: p.manifest.name })),
  ];

  return (
    <fieldset
      className="flex flex-col gap-2 rounded-lg border border-line p-3"
      data-testid="art-packs"
    >
      <legend className="px-1 font-semibold">{t('artPacks.heading')}</legend>
      <p className="text-sm text-ink-muted">{t('artPacks.hint')}</p>
      {options.map((o) => (
        <div key={o.id} className="flex items-center gap-2">
          <label className="flex min-w-0 grow items-center gap-2 break-words">
            <input
              type="radio"
              name="art-set"
              value={o.id}
              checked={active === o.id}
              onChange={() => update({ artSet: o.id })}
              data-testid={`artset-${o.id}`}
            />
            {o.name}
          </label>
          {o.id !== 'default' && (
            <Button
              variant="ghost"
              onClick={() => void deleteArtPack(o.id, artPacks)}
              aria-label={t('artPacks.delete', { name: o.name })}
              data-testid={`artpack-delete-${o.id}`}
            >
              {t('artPacks.deleteShort')}
            </Button>
          )}
        </div>
      ))}
      <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
        {t('artPacks.import')}
        <input
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          className="w-full min-w-0 max-w-full text-sm"
          data-testid="artpack-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = '';
          }}
        />
      </label>
      {report && (
        <div role="status" className="text-sm" data-testid="artpack-report" data-ok={report.ok}>
          {report.ok ? (
            <p>{t('artPacks.imported', { name: report.pack?.name ?? report.file })}</p>
          ) : (
            <>
              <p className="font-semibold text-danger">
                {t('artPacks.refused', { file: report.file })}
              </p>
              <ul className="max-h-48 list-disc overflow-y-auto pl-5">
                {report.issues.slice(0, 50).map((i, n) => (
                  <li key={`${i.path}-${n}`}>
                    <code>{i.path}</code>: {i.message}
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.ignored.length > 0 && (
            <p className="text-ink-muted">{t('artPacks.ignored', { n: report.ignored.length })}</p>
          )}
        </div>
      )}
    </fieldset>
  );
}
