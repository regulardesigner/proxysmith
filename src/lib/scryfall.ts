import type { CardData } from '../types';

const API = 'https://api.scryfall.com';
const PAGE_SIZE = 8;
const MIN_REQUEST_GAP = 500;

type RawFace = {
  name?: string;
  printed_name?: string;
  mana_cost?: string;
  type_line?: string;
  printed_type_line?: string;
  oracle_text?: string;
  printed_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors?: string[];
};

export type RawCard = RawFace & {
  id: string;
  name: string;
  lang?: string;
  color_identity?: string[];
  set?: string;
  set_name?: string;
  collector_number?: string;
  rarity?: string;
  layout?: string;
  card_faces?: RawFace[];
};

type SearchResponse = {
  object: 'list';
  data: RawCard[];
  has_more: boolean;
  total_cards?: number;
};

export class ScryfallError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ScryfallError';
    this.status = status;
  }
}

let nextRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSlot(signal?: AbortSignal): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + MIN_REQUEST_GAP;

  if (wait > 0) {
    await sleep(wait);
  }

  if (signal?.aborted) {
    throw new DOMException('Requête annulée', 'AbortError');
  }
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  await waitForSlot(signal);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (response.status === 404) return null;

  if (response.status === 429) {
    throw new ScryfallError(
      'Scryfall limite les requêtes. Patientez quelques secondes puis réessayez.',
      429,
    );
  }

  if (!response.ok) {
    throw new ScryfallError(`Scryfall a répondu avec le statut ${response.status}.`, response.status);
  }

  return (await response.json()) as T;
}

async function searchRaw(query: string, signal?: AbortSignal): Promise<RawCard[]> {
  const base = `${API}/cards/search?unique=cards&order=name&dir=asc&q=`;

  // On cherche d'abord dans les impressions françaises, puis on bascule sur
  // l'ensemble des langues si aucune carte ne correspond.
  const french = await fetchJson<SearchResponse>(
    `${base}${encodeURIComponent(`${query} lang:fr`)}`,
    signal,
  );

  if (french?.data.length) return french.data;

  const all = await fetchJson<SearchResponse>(`${base}${encodeURIComponent(query)}`, signal);
  return all?.data ?? [];
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function relevance(raw: RawCard, query: string): number {
  const names = [
    raw.printed_name,
    raw.name,
    raw.card_faces?.[0]?.printed_name,
    raw.card_faces?.[0]?.name,
  ]
    .flatMap((name) => (name ? name.split(' // ') : []))
    .map(normalizeText);

  let best = 0;
  for (const name of names) {
    if (name === query) {
      best = Math.max(best, 1000);
    } else if (name.startsWith(query)) {
      best = Math.max(best, 700);
    } else if (name.split(/\s+/).some((word) => word.startsWith(query))) {
      best = Math.max(best, 500);
    } else if (name.includes(query)) {
      best = Math.max(best, 300);
    }
  }

  return best;
}

export async function searchCards(query: string, signal?: AbortSignal): Promise<CardData[]> {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  if (normalizedQuery.length < 2) return [];

  const rawCards = await searchRaw(normalizedQuery, signal);
  const queryKey = normalizeText(normalizedQuery);

  // L'API trie par nom, ce qui peut placer « Ondefoudre » avant « Foudre ».
  // On reclasse localement : correspondance exacte, puis préfixe, puis contenu.
  return rawCards
    .map((raw, index) => ({ raw, index, score: relevance(raw, queryKey) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, PAGE_SIZE)
    .map(({ raw }) => normalizeCard(raw));
}

export function normalizeCard(raw: RawCard): CardData {
  const face = raw.card_faces?.[0];

  return {
    scryfallId: raw.id,
    name: face?.printed_name ?? face?.name ?? raw.printed_name ?? raw.name.split(' // ')[0],
    manaCost: raw.mana_cost ?? face?.mana_cost ?? '',
    typeLine:
      face?.printed_type_line ??
      face?.type_line ??
      raw.printed_type_line ??
      raw.type_line ??
      '',
    oracleText:
      face?.printed_text ?? face?.oracle_text ?? raw.printed_text ?? raw.oracle_text ?? '',
    power: face?.power ?? raw.power,
    toughness: face?.toughness ?? raw.toughness,
    loyalty: face?.loyalty ?? raw.loyalty,
    colors: face?.colors ?? raw.colors ?? [],
    colorIdentity: raw.color_identity ?? [],
    setCode: raw.set ?? '',
    setName: raw.set_name ?? '',
    collectorNumber: raw.collector_number ?? '',
    rarity: raw.rarity ?? '',
    layout: raw.layout ?? 'normal',
    lang: raw.lang ?? 'en',
    isFrontFaceOnly: Boolean(raw.card_faces?.length),
  };
}
