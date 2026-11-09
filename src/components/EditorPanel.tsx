import type { ReactNode } from 'react';
import clsx from 'clsx';
import { useCardStore } from '../store/useCardStore';
import { ACCENT_LABELS, ACCENT_OPTIONS } from '../lib/cardTheme';
import type { CardTemplate } from '../types';
import { ArtUpload } from './ArtUpload';
import { ManaCost } from './Mana';

const inputClass =
  'w-full rounded-lg border border-stone-700/80 bg-stone-950/60 px-3 py-2 text-sm text-stone-100 outline-none transition placeholder:text-stone-400 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15';

type EditorPanelProps = {
  onExportPng: () => void;
  onExportPdf: () => void;
  exporting: 'png' | 'pdf' | null;
  exportError: string | null;
};

export function EditorPanel({
  onExportPng,
  onExportPdf,
  exporting,
  exportError,
}: EditorPanelProps) {
  const card = useCardStore((state) => state.card);
  const template = useCardStore((state) => state.template);
  const frame = useCardStore((state) => state.frame);
  const accent = useCardStore((state) => state.accent);
  const setTemplate = useCardStore((state) => state.setTemplate);
  const setFrame = useCardStore((state) => state.setFrame);
  const setAccent = useCardStore((state) => state.setAccent);
  const patchCard = useCardStore((state) => state.patchCard);
  const reset = useCardStore((state) => state.reset);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-800/90 bg-stone-900/45 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-stone-400 uppercase">
              Carte sélectionnée
            </p>
            <h2 className="mt-1 truncate font-display text-xl text-stone-100">
              {card?.name ?? 'Aucune carte'}
            </h2>
            <p className="mt-1 truncate text-xs text-stone-400">
              {card
                ? [card.setName, card.setCode.toUpperCase(), card.collectorNumber]
                    .filter(Boolean)
                    .join(' · ')
                : 'Recherchez une carte pour commencer'}
            </p>
          </div>

          {card && (
            <button
              type="button"
              onClick={reset}
              className="shrink-0 rounded-lg border border-stone-700 px-2.5 py-1.5 text-xs text-stone-400 transition hover:border-stone-500 hover:text-stone-100"
            >
              Nouvelle carte
            </button>
          )}
        </div>
      </div>

      {!card ? (
        <>
          <Section title="Comment ça marche">
            <ol className="space-y-3 text-sm text-stone-400">
              <Step number="1">Cherchez une carte par son nom (français ou anglais).</Step>
              <Step number="2">Vérifiez ses règles, puis importez votre illustration.</Step>
              <Step number="3">Exportez un PNG 300 DPI ou une planche PDF A4 de 9 exemplaires.</Step>
            </ol>
          </Section>

          <Section title="Bon à savoir">
            <p className="text-xs leading-relaxed text-stone-400">
              Aucun artwork officiel n’est récupéré ni affiché. Les champs restent modifiables et la
              carte est marquée <span className="text-stone-300">PROXY</span>.
            </p>
          </Section>
        </>
      ) : (
        <>
          <Section title="Design de carte">
            <div className="grid grid-cols-3 gap-2">
              {(['signature', 'classic', 'modern'] as const).map((value) => (
                <TemplateButton
                  key={value}
                  template={value}
                  active={template === value}
                  onClick={() => setTemplate(value)}
                />
              ))}
            </div>

            {template === 'signature' && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-stone-800 bg-stone-950/40 px-3 py-2">
                <span className="text-xs text-stone-400">Variante</span>
                <div className="flex rounded-lg border border-stone-700 p-0.5">
                  {(['minimal', 'dark'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setFrame(style)}
                      aria-pressed={frame === style}
                      className={clsx(
                        'rounded-md px-2.5 py-1 text-xs transition',
                        frame === style
                          ? 'bg-amber-500 text-stone-950'
                          : 'text-stone-400 hover:text-stone-200',
                      )}
                    >
                      {style === 'minimal' ? 'Clair' : 'Sombre'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 rounded-xl border border-stone-800 bg-stone-950/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-stone-400">Couleur du cadre</span>
                <span className="text-[10px] text-stone-400">{ACCENT_LABELS[accent]}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {ACCENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAccent(option.value)}
                    aria-label={
                      option.value === 'auto'
                        ? 'Couleur automatique'
                        : `Couleur de cadre : ${option.label}`
                    }
                    aria-pressed={accent === option.value}
                    title={option.label}
                    className={clsx(
                      'flex h-7 w-7 items-center justify-center rounded-full border transition',
                      accent === option.value
                        ? 'border-amber-300 ring-2 ring-amber-400/40'
                        : 'border-stone-600 hover:border-stone-400',
                    )}
                  >
                    <span
                      className="h-[18px] w-[18px] rounded-full border border-black/20"
                      style={{
                        background:
                          option.value === 'auto'
                            ? 'conic-gradient(from 210deg, #e6d38f, #79e0a1, #6fb7ff, #b18cff, #ff8a68, #e6d38f)'
                            : option.swatch,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Illustration">
            <ArtUpload />
          </Section>

          <Section title="Champs de la carte">
            <div className="space-y-3">
              <Field label="Nom affiché">
                <input
                  className={inputClass}
                  value={card.name}
                  onChange={(event) => patchCard({ name: event.target.value })}
                />
              </Field>

              <Field label="Coût de mana" hint="Ex. {2}{R}">
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={card.manaCost}
                    onChange={(event) => patchCard({ manaCost: event.target.value })}
                    placeholder="{0}"
                  />
                  <ManaCost cost={card.manaCost} className="shrink-0 text-base" />
                </div>
              </Field>

              <Field label="Ligne de type">
                <input
                  className={inputClass}
                  value={card.typeLine}
                  onChange={(event) => patchCard({ typeLine: event.target.value })}
                />
              </Field>

              <Field label="Texte de la carte">
                <textarea
                  className={clsx(inputClass, 'min-h-28 resize-y leading-relaxed')}
                  value={card.oracleText}
                  onChange={(event) => patchCard({ oracleText: event.target.value })}
                  placeholder="Texte oracle de la carte…"
                />
              </Field>

              <div className="grid grid-cols-3 gap-2">
                <Field label="Force">
                  <input
                    className={inputClass}
                    value={card.power ?? ''}
                    onChange={(event) => patchCard({ power: event.target.value || undefined })}
                  />
                </Field>
                <Field label="Endurance">
                  <input
                    className={inputClass}
                    value={card.toughness ?? ''}
                    onChange={(event) =>
                      patchCard({ toughness: event.target.value || undefined })
                    }
                  />
                </Field>
                <Field label="Loyauté">
                  <input
                    className={inputClass}
                    value={card.loyalty ?? ''}
                    onChange={(event) => patchCard({ loyalty: event.target.value || undefined })}
                  />
                </Field>
              </div>

              {card.isFrontFaceOnly && (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/80">
                  Carte à faces multiples : seule la face avant est utilisée pour l’instant.
                </p>
              )}
            </div>
          </Section>

          <Section title="Détails d’impression">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Code d’édition">
                <input
                  className={inputClass}
                  value={card.setCode}
                  onChange={(event) => patchCard({ setCode: event.target.value })}
                />
              </Field>
              <Field label="Numéro">
                <input
                  className={inputClass}
                  value={card.collectorNumber}
                  onChange={(event) => patchCard({ collectorNumber: event.target.value })}
                />
              </Field>
            </div>
          </Section>

          <Section title="Export">
            <button
              type="button"
              onClick={onExportPng}
              disabled={exporting !== null}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M12 4v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" strokeLinecap="round" />
              </svg>
              {exporting === 'png' ? 'Export en cours…' : 'Télécharger le PNG'}
            </button>

            <button
              type="button"
              onClick={onExportPdf}
              disabled={exporting !== null}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-700 px-4 py-3 text-sm font-medium text-stone-200 transition hover:border-amber-500/50 hover:bg-amber-500/5 disabled:cursor-wait disabled:opacity-60"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M7 3h7l5 5v13H7z" strokeLinejoin="round" />
                <path d="M14 3v5h5M10 13h5M10 17h5" strokeLinecap="round" />
              </svg>
              {exporting === 'pdf' ? 'Création de la planche…' : 'Planche PDF A4 · 9 exemplaires'}
            </button>

            <p className="mt-2 text-center text-[11px] leading-relaxed text-stone-400">
              PNG : 750 × 1050 px · 300 DPI · 63,5 × 88,9 mm
              <br />
              PDF : 9 cartes sur A4 avec traits de coupe, à imprimer à 100 %
            </p>

            {exportError && (
              <p role="alert" className="mt-2 text-center text-xs text-red-300">
                {exportError}
              </p>
            )}
          </Section>

          <p className="border-t border-stone-800/80 px-5 py-4 text-[11px] leading-relaxed text-stone-400">
            Usage personnel uniquement. Ne vendez pas ces proxies et ne les présentez pas comme des
            cartes officielles. Magic: The Gathering est une marque de Wizards of the Coast ; ce
            projet n’est ni affilié ni approuvé par Wizards.
          </p>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border-t border-stone-800/80 px-5 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold tracking-[0.18em] text-stone-400 uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Step({ number, children }: { number: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-700 text-[10px] font-semibold text-amber-300">
        {number}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2 text-xs text-stone-400">
        <span>{label}</span>
        {hint && <span className="font-mono text-[10px] text-stone-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function TemplateButton({
  template,
  active,
  onClick,
}: {
  template: CardTemplate;
  active: boolean;
  onClick: () => void;
}) {
  const label =
    template === 'signature' ? 'Signature' : template === 'classic' ? '1993' : '2026';
  const hint =
    template === 'signature' ? 'Minimal' : template === 'classic' ? 'Old school' : 'Contemporain';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'rounded-xl border p-2 text-left transition',
        active
          ? 'border-amber-500/60 bg-amber-500/10'
          : 'border-stone-700/80 bg-stone-950/40 hover:border-stone-500',
      )}
    >
      <span
        className={clsx(
          'relative mb-2 block h-20 overflow-hidden rounded-md border',
          template === 'signature' && 'border-stone-300/20 bg-[#f2ead8]',
          template === 'classic' && 'border-amber-900/50 bg-[#cdb98b]',
          template === 'modern' && 'border-cyan-400/20 bg-[#0b0f14]',
        )}
      >
        {template === 'signature' && (
          <>
            <span className="absolute inset-x-2 top-2 h-1.5 rounded-full bg-stone-800/70" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-500" />
            <span className="absolute inset-x-2 top-5 h-7 rounded-sm border border-stone-800/25 bg-stone-700/20" />
            <span className="absolute inset-x-2 bottom-2 h-5 rounded-sm border border-stone-800/20 bg-white/40" />
          </>
        )}

        {template === 'classic' && (
          <>
            <span className="absolute inset-1 rounded-sm border border-[#5c4a2c]/70" />
            <span className="absolute inset-x-3 top-3 h-2 rounded-[1px] border border-[#5c4a2c]/60 bg-[#f2e7c8]" />
            <span className="absolute inset-x-3 top-7 h-6 border border-[#3d2f1a]/60 bg-[#7d8f6a]" />
            <span className="absolute inset-x-3 bottom-3 h-5 border border-[#5c4a2c]/40 bg-[#efe3c2]" />
          </>
        )}

        {template === 'modern' && (
          <>
            <span className="absolute inset-x-0 top-0 h-3 border-b border-cyan-300/20 bg-[#131b24]" />
            <span className="absolute inset-x-0 top-3 h-7 bg-linear-to-br from-cyan-500/50 via-violet-500/40 to-transparent" />
            <span className="absolute inset-x-2 top-11 h-1.5 rounded-full bg-cyan-300/40" />
            <span className="absolute inset-x-2 bottom-2 h-5 rounded-md border border-white/10 bg-white/5" />
          </>
        )}
      </span>
      <span className={clsx('block text-xs font-medium', active ? 'text-amber-100' : 'text-stone-300')}>
        {label}
      </span>
      <span className="block text-[10px] text-stone-400">{hint}</span>
    </button>
  );
}
