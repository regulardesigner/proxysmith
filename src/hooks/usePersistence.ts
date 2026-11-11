import { useEffect, useState } from 'react';
import { cardStorage, describeStorageError, toStoredSession } from '../lib/storage';
import { useCardStore } from '../store/useCardStore';

const STORAGE_TIMEOUT_MS = 3000;
const AUTOSAVE_DELAY_MS = 600;

/**
 * Restaure la session locale au démarrage puis l'enregistre après chaque
 * modification. L'image est écrite séparément des métadonnées : sans cela,
 * chaque frappe réécrirait une data URL de 20 Mo.
 */
export function usePersistence() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      if (!active) return;
      active = false;
      setReady(true);
    }, STORAGE_TIMEOUT_MS);

    cardStorage
      .loadWorkspace()
      .then(({ session, artDataUrl }) => {
        if (!active || !session) return;

        // Une sélection faite avant la fin de la restauration est prioritaire.
        if (useCardStore.getState().card !== null) return;

        useCardStore.getState().restore({
          card: session.card,
          template: session.template,
          frame: session.frame,
          accent: session.accent,
          art:
            session.art && artDataUrl ? { ...session.art, dataUrl: artDataUrl } : null,
        });
      })
      .catch((reason: unknown) => {
        if (active) setError(describeStorageError(reason));
      })
      .finally(() => {
        if (!active) return;
        active = false;
        clearTimeout(timeout);
        setReady(true);
      });

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    let lastDataUrl = useCardStore.getState().art?.dataUrl ?? null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let queue = Promise.resolve();
    let unmounted = false;

    async function flush() {
      const state = useCardStore.getState();

      try {
        if (!state.card) {
          await cardStorage.saveSession(null);
          lastDataUrl = null;
        } else {
          const dataUrl = state.art?.dataUrl ?? null;

          if (dataUrl !== lastDataUrl) {
            await cardStorage.saveArtDataUrl(dataUrl);
            lastDataUrl = dataUrl;
          }

          await cardStorage.saveSession(
            toStoredSession({
              card: state.card,
              template: state.template,
              frame: state.frame,
              accent: state.accent,
              art: state.art,
            }),
          );
        }

        if (!unmounted) setError(null);
      } catch (reason) {
        if (!unmounted) setError(describeStorageError(reason));
      }
    }

    function saveNow() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      queue = queue.then(flush);
    }

    const unsubscribe = useCardStore.subscribe((state, previous) => {
      if (
        state.card === previous.card &&
        state.art === previous.art &&
        state.template === previous.template &&
        state.frame === previous.frame &&
        state.accent === previous.accent
      ) {
        return;
      }

      if (timer) clearTimeout(timer);
      timer = setTimeout(saveNow, AUTOSAVE_DELAY_MS);
    });

    const onPageHide = () => saveNow();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };

    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unmounted = true;
      unsubscribe();
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      saveNow();
    };
  }, [ready]);

  return { ready, error };
}
