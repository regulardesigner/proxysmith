import { useRef, useState } from 'react';
import { useCardStore } from './store/useCardStore';
import { usePersistence } from './hooks/usePersistence';
import { exportCardPng, exportCardsPdf } from './lib/export';
import { SearchPanel } from './components/SearchPanel';
import { CardPreview } from './components/CardPreview';
import { EditorPanel } from './components/EditorPanel';

type ExportFormat = 'png' | 'pdf';

function App() {
  const card = useCardStore((state) => state.card);
  const template = useCardStore((state) => state.template);
  const frame = useCardStore((state) => state.frame);
  const accent = useCardStore((state) => state.accent);
  const art = useCardStore((state) => state.art);
  const { ready, error: persistenceError } = usePersistence();
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport(format: ExportFormat) {
    if (!card || !cardRef.current) return;

    setExporting(format);
    setExportError(null);

    try {
      if (format === 'png') {
        await exportCardPng(cardRef.current, card.name, art);
      } else {
        await exportCardsPdf(cardRef.current, card.name, art);
      }
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "L'export a échoué. Réessayez dans un instant.",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="app-glow" aria-hidden="true" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="font-display text-lg leading-none tracking-[0.18em] text-stone-100">
              PROXYSMITH
            </p>
            <p className="mt-1 text-[10px] tracking-[0.22em] text-stone-400 uppercase">
              Proxies Magic · votre art
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[10px] tracking-wider text-emerald-300/80 uppercase sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Local · sans compte
          </span>
          <span className="rounded-full border border-stone-700 bg-stone-900/60 px-3 py-1.5 text-[10px] tracking-wider text-stone-400 uppercase">
            v1.0
          </span>
        </div>
      </header>

      <section className="hero mx-auto w-full max-w-3xl px-5 pt-6 pb-10 text-center sm:px-8 sm:pt-10">
        <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-400/80 uppercase">
          Recherchez. Illustrez. Imprimez.
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-stone-100 sm:text-5xl">
          Vos cartes. Vos illustrations.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-stone-400 sm:text-base">
          Tapez le nom d’une carte Magic : ses règles sont récupérées automatiquement. Ajoutez votre
          artwork, puis exportez un proxy prêt à imprimer.
        </p>

        <div className="mt-7">
          <SearchPanel />
        </div>
      </section>

      {persistenceError && (
        <p
          role="alert"
          className="mx-auto w-full max-w-7xl px-5 pb-2 text-xs text-red-300 sm:px-8"
        >
          {persistenceError}
        </p>
      )}

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-5 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
        {!ready ? (
          <p role="status" className="px-5 py-16 text-center text-sm text-stone-400 lg:col-span-2">
            Restauration de votre travail…
          </p>
        ) : (
          <>
            <section className="flex flex-col items-center gap-4 lg:sticky lg:top-6">
              <div className="card-scaler">
                {card ? (
                  <CardPreview
                    ref={cardRef}
                    card={card}
                    template={template}
                    frame={frame}
                    accent={accent}
                    art={art}
                  />
                ) : (
                  <EmptyCard />
                )}
              </div>

              <div className="text-center">
                <p className="font-display text-[11px] tracking-[0.22em] text-stone-400 uppercase">
                  Aperçu 300 DPI
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  {template === 'signature'
                    ? frame === 'dark'
                      ? 'Signature sombre'
                      : 'Signature clair'
                    : template === 'classic'
                      ? 'Old school 1993'
                      : 'Moderne 2026'}{' '}
                  · 750 × 1050 px
                </p>
                {card && (
                  <p className="mt-1 text-[11px] text-stone-400">
                    Impression : échelle 100 %, papier 200–300 g
                  </p>
                )}
              </div>
            </section>

            <EditorPanel
              onExportPng={() => void handleExport('png')}
              onExportPdf={() => void handleExport('pdf')}
              exporting={exporting}
              exportError={exportError}
            />
          </>
        )}
      </main>

      <footer className="border-t border-stone-800/70 px-5 py-6 text-center text-[11px] leading-relaxed text-stone-400 sm:px-8">
        <p>
          Données de cartes © Wizards of the Coast, diffusées par Scryfall. Projet non officiel, sans
          affiliation.
        </p>
        <p className="mt-1">
          Les proxies sont destinés à un usage personnel. Ne les vendez pas et ne les présentez pas
          comme des cartes officielles.
        </p>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <div className="relative h-10 w-10" aria-hidden="true">
      <span className="absolute inset-0 -rotate-6 rounded-md border border-stone-700 bg-stone-800/80" />
      <span className="absolute inset-0 rotate-3 overflow-hidden rounded-md border border-amber-500/50 bg-linear-to-br from-stone-900 to-stone-800 shadow-lg shadow-black/40">
        <span className="absolute inset-x-1.5 top-1.5 h-1.5 rounded-full bg-amber-400/90" />
        <span className="absolute inset-x-1.5 top-[18px] h-3 rounded-sm border border-stone-600/80 bg-stone-700/50" />
        <span className="absolute inset-x-1.5 bottom-1.5 h-1.5 rounded-sm bg-stone-700" />
      </span>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="empty-card">
      <div className="empty-card-inner">
        <svg
          viewBox="0 0 24 24"
          className="h-12 w-12 text-amber-500/60"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2.5" />
          <path d="M7 8h10M7 12h7M7 16h5" strokeLinecap="round" />
        </svg>
        <p className="mt-5 font-display text-3xl text-stone-300">Votre prochaine carte</p>
        <p className="mt-3 max-w-sm text-base leading-relaxed text-stone-400">
          Recherchez une carte Magic : son nom, son coût de mana et son texte seront remplis
          automatiquement.
        </p>
        <p className="mt-8 text-[11px] tracking-[0.24em] text-stone-400 uppercase">
          Aucun artwork officiel utilisé
        </p>
      </div>
    </div>
  );
}

export default App;
