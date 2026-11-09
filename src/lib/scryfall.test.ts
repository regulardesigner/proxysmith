import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeCard, type RawCard } from './scryfall';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function searchResponse(data: RawCard[]): Response {
  return jsonResponse({ object: 'list', data, has_more: false, total_cards: data.length });
}

function queryOf(call: unknown[]): string | null {
  return new URL(String(call[0])).searchParams.get('q');
}

const lightningBolt: RawCard = {
  id: 'card-1',
  name: 'Lightning Bolt',
  printed_name: 'Foudre',
  printed_text: "La Foudre inflige 3 blessures à n'importe quelle cible.",
  oracle_text: 'Lightning Bolt deals 3 damage to any target.',
  mana_cost: '{R}',
  type_line: 'Instant',
  lang: 'fr',
  color_identity: ['R'],
  set: 'msc',
  set_name: 'Marvel Super Heroes Commander',
  collector_number: '806',
  rarity: 'uncommon',
  layout: 'normal',
};

describe('normalizeCard', () => {
  it('prefers localized printed fields', () => {
    expect(normalizeCard(lightningBolt)).toMatchObject({
      scryfallId: 'card-1',
      name: 'Foudre',
      manaCost: '{R}',
      typeLine: 'Instant',
      oracleText: "La Foudre inflige 3 blessures à n'importe quelle cible.",
      colorIdentity: ['R'],
      setCode: 'msc',
      collectorNumber: '806',
      lang: 'fr',
      isFrontFaceOnly: false,
    });
  });

  it('falls back to the English name and empty optional fields', () => {
    const raw: RawCard = {
      id: 'card-2',
      name: 'Sol Ring',
      mana_cost: '{1}',
      type_line: 'Artifact',
      oracle_text: '{T}: Add {C}{C}.',
      color_identity: [],
    };

    const card = normalizeCard(raw);
    expect(card).toMatchObject({
      name: 'Sol Ring',
      typeLine: 'Artifact',
      setCode: '',
      lang: 'en',
      isFrontFaceOnly: false,
    });
    expect(card.power).toBeUndefined();
    expect(card.toughness).toBeUndefined();
    expect(card.loyalty).toBeUndefined();
  });

  it('uses the front face of a multi-face card', () => {
    const raw: RawCard = {
      id: 'card-3',
      name: 'Delver of Secrets // Insectile Aberration',
      lang: 'en',
      color_identity: ['U'],
      layout: 'transform',
      card_faces: [
        {
          name: 'Delver of Secrets',
          printed_name: 'Fouineur de secrets',
          mana_cost: '{U}',
          type_line: 'Creature — Human Wizard',
          printed_text: 'Au début de votre entretien…',
          power: '1',
          toughness: '1',
          colors: ['U'],
        },
        {
          name: 'Insectile Aberration',
          type_line: 'Creature — Human Insect',
          power: '3',
          toughness: '2',
        },
      ],
    };

    expect(normalizeCard(raw)).toMatchObject({
      name: 'Fouineur de secrets',
      manaCost: '{U}',
      typeLine: 'Creature — Human Wizard',
      oracleText: 'Au début de votre entretien…',
      power: '1',
      toughness: '1',
      isFrontFaceOnly: true,
    });
  });
});

describe('searchCards', () => {
  beforeEach(() => {
    // A fresh module resets the module-level 500 ms request spacing.
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('queries French printings first and normalizes the localized result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      searchResponse([
        {
          id: 'fr-bolt',
          name: 'Lightning Bolt',
          printed_name: 'Foudre',
          printed_text: "La Foudre inflige 3 blessures à n'importe quelle cible.",
          printed_type_line: 'Éphémère',
          mana_cost: '{R}',
          type_line: 'Instant',
          lang: 'fr',
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { searchCards } = await import('./scryfall');
    const cards = await searchCards('foudre');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(queryOf(fetchMock.mock.calls[0])).toContain('lang:fr');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      scryfallId: 'fr-bolt',
      name: 'Foudre',
      typeLine: 'Éphémère',
      oracleText: "La Foudre inflige 3 blessures à n'importe quelle cible.",
      lang: 'fr',
    });
  });

  it('falls back to all languages when the French request returns 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ object: 'error', status: 404 }, 404))
      .mockResolvedValueOnce(
        searchResponse([
          {
            id: 'en-bolt',
            name: 'Lightning Bolt',
            mana_cost: '{R}',
            type_line: 'Instant',
            oracle_text: 'Lightning Bolt deals 3 damage to any target.',
            lang: 'en',
          },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { searchCards } = await import('./scryfall');
    const cards = await searchCards('lightning bolt');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(queryOf(fetchMock.mock.calls[0])).toContain('lang:fr');
    expect(queryOf(fetchMock.mock.calls[1])).not.toContain('lang:fr');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ scryfallId: 'en-bolt', name: 'Lightning Bolt', lang: 'en' });
  });

  it('ranks an exact name match above a partial match returned first by the API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        searchResponse([
          { id: 'partial', name: 'Ondefoudre', lang: 'fr' },
          { id: 'exact', name: 'Foudre', lang: 'fr' },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { searchCards } = await import('./scryfall');
    const cards = await searchCards('foudre');

    expect(cards.map((card) => card.scryfallId)).toEqual(['exact', 'partial']);
  });

  it('treats an accent-insensitive name match as exact', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        searchResponse([
          { id: 'fr-necro', name: 'Nécropotence', printed_name: 'Nécropotence', lang: 'fr' },
          { id: 'en-necro', name: 'Necropotence', lang: 'en' },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { searchCards } = await import('./scryfall');
    const cards = await searchCards('necropotence');

    expect(cards[0].scryfallId).toBe('fr-necro');
  });

  it('returns an empty list without calling Scryfall when the query is shorter than two characters', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { searchCards } = await import('./scryfall');

    await expect(searchCards('a')).resolves.toEqual([]);
    await expect(searchCards(' a ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
