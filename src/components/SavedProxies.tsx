import { useEffect, useRef, useState } from 'react';
import { useCardStore } from '../store/useCardStore';
import {
  cardStorage,
  describeStorageError,
  type SavedProxySummary,
} from '../lib/storage';
import { inputClass } from './inputStyles';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

type Action = 'save' | 'load' | 'delete';

export function SavedProxies() {
  const card = useCardStore((state) => state.card);
  const restore = useCardStore((state) => state.restore);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [proxies, setProxies] = useState<SavedProxySummary[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [name, setName] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    cardStorage
      .listProxies()
      .then((list) => {
        if (active) setProxies(list);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(describeStorageError(reason));
          setProxies([]);
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function resetMessages() {
    setError(null);
    setStatus(null);
  }

  async function handleSave() {
    const snapshot = useCardStore.getState();
    if (!snapshot.card || action !== null) return;

    setAction('save');
    resetMessages();

    try {
      const summary = await cardStorage.saveProxy({
        name,
        card: snapshot.card,
        template: snapshot.template,
        frame: snapshot.frame,
        accent: snapshot.accent,
        art: snapshot.art,
      });

      setName('');
      setStatus(`Proxy « ${summary.name} » sauvegardée.`);
      reload();
    } catch (reason) {
      setError(describeStorageError(reason));
    } finally {
      setAction(null);
    }
  }

  async function handleLoad(id: string) {
    if (action !== null) return;

    setAction('load');
    setActionId(id);
    resetMessages();

    try {
      const proxy = await cardStorage.getProxy(id);

      if (!proxy) {
        setError('Cette sauvegarde n’existe plus.');
        reload();
        return;
      }

      restore({
        card: proxy.card,
        template: proxy.template,
        frame: proxy.frame,
        accent: proxy.accent,
        art: proxy.art,
      });
      setStatus(`Proxy « ${proxy.name} » chargée.`);
    } catch (reason) {
      setError(describeStorageError(reason));
    } finally {
      setAction(null);
      setActionId(null);
    }
  }

  async function handleDelete(id: string) {
    if (action !== null) return;

    const proxy = proxies?.find((item) => item.id === id);
    setAction('delete');
    setActionId(id);
    resetMessages();

    try {
      await cardStorage.deleteProxy(id);
      setPendingDelete(null);
      setStatus(proxy ? `Proxy « ${proxy.name} » supprimée.` : 'Proxy supprimée.');
      reload();
      nameInputRef.current?.focus();
    } catch (reason) {
      setError(describeStorageError(reason));
    } finally {
      setAction(null);
      setActionId(null);
    }
  }

  function handleCancelDelete(id: string) {
    setPendingDelete(null);
    document.getElementById(`saved-proxy-delete-${id}`)?.focus();
  }

  const busy = action !== null;

  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-xs text-stone-400">Nom de la sauvegarde</span>
        <input
          ref={nameInputRef}
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={card?.name ?? 'Ma proxy'}
          maxLength={80}
          aria-describedby="saved-proxy-hint"
        />
      </label>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={busy || !card}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
      >
        {action === 'save' ? 'Sauvegarde…' : 'Sauvegarder la carte'}
      </button>

      <p id="saved-proxy-hint" className="mt-2 text-[11px] leading-relaxed text-stone-400">
        La carte en cours est restaurée automatiquement à l’ouverture. Une sauvegarde nommée
        conserve aussi l’illustration.
      </p>

      {status && (
        <p role="status" className="mt-2 text-xs text-emerald-300">
          {status}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {proxies === null ? (
        <p className="mt-3 text-xs text-stone-400">Chargement des sauvegardes…</p>
      ) : proxies.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-stone-400">
          Aucune sauvegarde pour l’instant.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {proxies.map((proxy) => (
            <li
              key={proxy.id}
              className="rounded-xl border border-stone-800 bg-stone-950/40 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-stone-200">{proxy.name}</p>
                  <p className="mt-0.5 text-[11px] text-stone-400">
                    {proxy.cardName} · {dateFormatter.format(new Date(proxy.updatedAt))}
                    {proxy.hasArt ? ' · illustration' : ''}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => void handleLoad(proxy.id)}
                    disabled={busy}
                    className="rounded-lg border border-stone-700 px-2.5 py-1.5 text-xs text-stone-300 transition hover:border-stone-500 hover:text-stone-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    {action === 'load' && actionId === proxy.id ? 'Chargement…' : 'Charger'}
                  </button>
                  <button
                    type="button"
                    id={`saved-proxy-delete-${proxy.id}`}
                    onClick={() => setPendingDelete(proxy.id)}
                    disabled={busy}
                    className="rounded-lg border border-stone-800 px-2.5 py-1.5 text-xs text-stone-400 transition hover:border-red-500/40 hover:text-red-300 disabled:cursor-wait disabled:opacity-60"
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              {pendingDelete === proxy.id && (
                <div className="mt-2 rounded-lg border border-red-500/25 bg-red-500/5 p-2.5">
                  <p className="text-xs leading-relaxed text-stone-300">
                    Supprimer définitivement « {proxy.name} » ?
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleDelete(proxy.id)}
                      disabled={action === 'delete' && actionId === proxy.id}
                      className="rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs text-red-200 transition hover:bg-red-500/10 disabled:cursor-wait disabled:opacity-60"
                    >
                      {action === 'delete' && actionId === proxy.id
                        ? 'Suppression…'
                        : 'Confirmer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelDelete(proxy.id)}
                      disabled={busy}
                      className="rounded-lg border border-stone-700 px-2.5 py-1.5 text-xs text-stone-300 transition hover:border-stone-500 hover:text-stone-100 disabled:cursor-wait disabled:opacity-60"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
