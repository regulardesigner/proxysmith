import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { searchCards, ScryfallError } from '../lib/scryfall';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useCardStore } from '../store/useCardStore';
import type { CardData } from '../types';
import { ManaCost } from './Mana';

const EXAMPLES = ['Foudre', 'Ange de Serra', 'Nécropotence'];
const EMPTY_RESULTS: CardData[] = [];

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const setCard = useCardStore((state) => state.setCard);

  const debouncedQuery = useDebouncedValue(query, 450);

  const {
    data = EMPTY_RESULTS,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ['card-search', debouncedQuery],
    queryFn: ({ signal }) => searchCards(debouncedQuery, signal),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const waitingForDebounce = query.trim() !== debouncedQuery.trim();
  const loading = isFetching || waitingForDebounce;
  const safeActiveIndex = Math.max(0, Math.min(activeIndex, data.length - 1));

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function updateQuery(value: string) {
    setQuery(value);
    setOpen(value.trim().length >= 2);
    setActiveIndex(0);
  }

  function selectCard(card: CardData) {
    setCard(card);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (!open) {
      if (event.key === 'ArrowDown' && data.length > 0) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(data.length === 0 ? 0 : Math.min(safeActiveIndex + 1, data.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(Math.max(safeActiveIndex - 1, 0));
    } else if (event.key === 'Enter' && data[safeActiveIndex]) {
      event.preventDefault();
      selectCard(data[safeActiveIndex]);
    }
  }

  const showDropdown = open && query.trim().length >= 2;
  const hasResults = !isError && data.length > 0;
  const listboxVisible = showDropdown && hasResults;
  const activeCard = listboxVisible ? data[safeActiveIndex] : undefined;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label htmlFor="card-search" className="sr-only">
        Rechercher une carte Magic
      </label>

      <div className="relative">
        <svg
          className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-stone-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          id="card-search"
          type="text"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Foudre, Ange de Serra, Lightning Bolt…"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxVisible ? 'card-search-results' : undefined}
          aria-activedescendant={
            activeCard ? `card-search-option-${activeCard.scryfallId}` : undefined
          }
          aria-autocomplete="list"
          className="w-full rounded-2xl border border-stone-700/80 bg-stone-900/80 py-4 pr-24 pl-12 text-base text-stone-100 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.9)] outline-none transition placeholder:text-stone-400 focus:border-amber-500/60 focus:ring-4 focus:ring-amber-500/10"
        />

        <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
          {loading && (
            <>
              <span role="status" className="sr-only">
                Recherche en cours
              </span>
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-stone-600 border-t-amber-400"
              />
            </>
          )}
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                updateQuery('');
                inputRef.current?.focus();
              }}
              className="rounded-full p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-stone-200"
              aria-label="Effacer la recherche"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <kbd className="hidden rounded-md border border-stone-700 bg-stone-950 px-2 py-1 text-[10px] text-stone-400 sm:inline">
            ↵
          </kbd>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-stone-400">
        <span>Essayez :</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              updateQuery(example);
              inputRef.current?.focus();
            }}
            className="rounded-full border border-stone-800 bg-stone-900/60 px-2.5 py-1 text-stone-400 transition hover:border-amber-500/40 hover:text-amber-200"
          >
            {example}
          </button>
        ))}
        <span className="ml-auto hidden items-center gap-1.5 sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
          Scryfall · FR/EN
        </span>
      </div>

      {showDropdown && (
        <div className="absolute z-30 mt-3 max-h-[22rem] w-full overflow-y-auto rounded-2xl border border-stone-700/80 bg-stone-900/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur">
          {isError && (
            <p role="alert" className="px-3 py-4 text-sm text-red-300">
              {error instanceof ScryfallError
                ? error.message
                : 'Impossible de contacter Scryfall. Vérifiez votre connexion.'}
            </p>
          )}

          {!isError && !loading && !waitingForDebounce && data.length === 0 && (
            <p role="status" className="px-3 py-4 text-sm text-stone-400">
              Aucune carte trouvée. Essayez un autre nom ou la version anglaise.
            </p>
          )}

          {hasResults && (
            <div id="card-search-results" role="listbox">
              {data.map((card, index) => (
                <button
                  key={card.scryfallId}
                  id={`card-search-option-${card.scryfallId}`}
                  type="button"
                  role="option"
                  aria-selected={index === safeActiveIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectCard(card)}
                  className={clsx(
                    'flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition',
                    index === safeActiveIndex ? 'bg-stone-800' : 'hover:bg-stone-800/70',
                  )}
                >
                  <span className="flex items-center justify-between gap-4">
                    <span className="truncate text-sm font-medium text-stone-100">{card.name}</span>
                    <ManaCost cost={card.manaCost} className="shrink-0 text-[13px]" />
                  </span>
                  <span className="flex items-center gap-2 text-xs text-stone-400">
                    <span className="truncate">{card.typeLine}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] tracking-wider uppercase">
                      {card.setCode}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
