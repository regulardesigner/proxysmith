import { useRef, useState, type DragEvent } from 'react';
import clsx from 'clsx';
import { useCardStore } from '../store/useCardStore';

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Lecture impossible'));
    reader.readAsDataURL(file);
  });
}

export function ArtUpload() {
  const art = useCardStore((state) => state.art);
  const setArt = useCardStore((state) => state.setArt);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setBusy(false);
      setError('Format non pris en charge. Utilisez un PNG, JPG ou WebP.');
      return;
    }

    if (file.size > MAX_BYTES) {
      setBusy(false);
      setError('Image trop lourde (20 Mo maximum).');
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (requestId !== requestIdRef.current) return;
      setArt({
        dataUrl,
        fileName: file.name,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      });
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError("Impossible de lire cette image. Essayez un autre fichier.");
    } finally {
      if (requestId === requestIdRef.current) setBusy(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function updateArt(patch: Partial<NonNullable<typeof art>>) {
    if (!art) return;
    setArt({ ...art, ...patch });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleFile(file);
        }}
      />

      {!art ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-describedby={error ? 'art-upload-error' : undefined}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={clsx(
            'flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition',
            dragging
              ? 'border-amber-400/80 bg-amber-400/5'
              : 'border-stone-700 bg-stone-950/40 hover:border-stone-500 hover:bg-stone-900/60',
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-stone-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-medium text-stone-200">
            {busy ? 'Lecture de l’image…' : 'Importer une illustration'}
          </span>
          <span className="text-xs text-stone-400">
            Glissez-déposez ou cliquez · PNG, JPG, WebP · 20 Mo max
          </span>
        </button>
      ) : (
        <div className="rounded-xl border border-stone-700/80 bg-stone-950/40 p-3">
          <div className="flex items-center gap-3">
            <img
              src={art.dataUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg border border-stone-700 object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-stone-200">{art.fileName}</p>
              <p className="mt-0.5 text-xs text-stone-400">Illustration personnelle</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                aria-describedby={error ? 'art-upload-error' : undefined}
                className="rounded-lg border border-stone-700 px-2.5 py-1.5 text-xs text-stone-300 transition hover:border-stone-500 hover:text-stone-100"
              >
                Remplacer
              </button>
              <button
                type="button"
                onClick={() => {
                  setArt(null);
                  setError(null);
                }}
                className="rounded-lg border border-stone-800 px-2.5 py-1.5 text-xs text-stone-400 transition hover:border-red-500/40 hover:text-red-300"
              >
                Retirer
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Slider
              label="Zoom"
              value={art.zoom}
              min={1}
              max={2.5}
              step={0.05}
              display={`${art.zoom.toFixed(2)}×`}
              onChange={(zoom) => updateArt({ zoom })}
            />
            <Slider
              label="Horizontal"
              value={art.offsetX}
              min={-50}
              max={50}
              step={1}
              display={`${Math.round(art.offsetX)} %`}
              onChange={(offsetX) => updateArt({ offsetX })}
            />
            <Slider
              label="Vertical"
              value={art.offsetY}
              min={-50}
              max={50}
              step={1}
              display={`${Math.round(art.offsetY)} %`}
              onChange={(offsetY) => updateArt({ offsetY })}
            />
            <button
              type="button"
              onClick={() => updateArt({ zoom: 1, offsetX: 0, offsetY: 0 })}
              className="text-xs text-stone-400 underline decoration-stone-700 underline-offset-4 transition hover:text-stone-300"
            >
              Recentrer l’illustration
            </button>
          </div>
        </div>
      )}

      {error && (
        <p id="art-upload-error" role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs text-stone-400">
        <span>{label}</span>
        <span className="font-mono text-[10px] text-stone-400">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 w-full accent-amber-500"
      />
    </label>
  );
}
