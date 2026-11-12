import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Artwork, CardData } from '../types';
import {
  createCardStorage,
  describeStorageError,
  openProxySmithDatabase,
  toStoredSession,
} from './storage';

const CARD: CardData = {
  scryfallId: 'card-id',
  name: 'Foudre',
  manaCost: '{1}{R}',
  typeLine: 'Éphémère',
  oracleText: 'La Foudre inflige 3 blessures à n’importe quelle cible.',
  colors: ['R'],
  colorIdentity: ['R'],
  setCode: 'msc',
  setName: 'Mystery Booster 2',
  collectorNumber: '806',
  rarity: 'common',
  layout: 'normal',
  lang: 'fr',
  isFrontFaceOnly: false,
};

const ART: Artwork = {
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  fileName: 'art.png',
  zoom: 1.25,
  offsetX: -4,
  offsetY: 12,
};

function newStorage() {
  const name = `proxysmith-test-${crypto.randomUUID()}`;
  return { name, storage: createCardStorage(name) };
}

describe('toStoredSession', () => {
  it('keeps the artwork framing without duplicating the data URL', () => {
    const session = toStoredSession({
      card: CARD,
      template: 'classic',
      frame: 'dark',
      accent: 'R',
      art: ART,
    });

    expect(session.version).toBe(1);
    expect(session.card).toEqual(CARD);
    expect(session.template).toBe('classic');
    expect(session.art).toEqual({
      fileName: 'art.png',
      zoom: 1.25,
      offsetX: -4,
      offsetY: 12,
    });
    expect(session.art).not.toHaveProperty('dataUrl');
  });

  it('stores a null artwork when no illustration is selected', () => {
    const session = toStoredSession({
      card: CARD,
      template: 'signature',
      frame: 'minimal',
      accent: 'auto',
      art: null,
    });

    expect(session.art).toBeNull();
  });
});

describe('workspace persistence', () => {
  it('round-trips the card, preferences and artwork image', async () => {
    const { storage } = newStorage();
    const session = toStoredSession({
      card: CARD,
      template: 'modern',
      frame: 'minimal',
      accent: 'U',
      art: ART,
    });

    await storage.saveArtDataUrl(ART.dataUrl);
    await storage.saveSession(session);

    const workspace = await storage.loadWorkspace();
    expect(workspace.session).toEqual(session);
    expect(workspace.artDataUrl).toBe(ART.dataUrl);
  });

  it('drops the artwork image when no artwork is part of the session', async () => {
    const { storage } = newStorage();
    await storage.saveArtDataUrl(ART.dataUrl);
    await storage.saveSession(
      toStoredSession({
        card: CARD,
        template: 'signature',
        frame: 'minimal',
        accent: 'auto',
        art: null,
      }),
    );

    const workspace = await storage.loadWorkspace();
    expect(workspace.session?.art).toBeNull();
    expect(workspace.artDataUrl).toBeNull();
  });

  it('clears the workspace when the card is reset', async () => {
    const { storage } = newStorage();
    await storage.saveArtDataUrl(ART.dataUrl);
    await storage.saveSession(
      toStoredSession({
        card: CARD,
        template: 'signature',
        frame: 'minimal',
        accent: 'auto',
        art: ART,
      }),
    );

    await storage.saveSession(null);

    await expect(storage.loadWorkspace()).resolves.toEqual({
      session: null,
      artDataUrl: null,
    });
  });

  it('ignores a session written by an unknown schema version', async () => {
    const { name, storage } = newStorage();
    const db = await openProxySmithDatabase(name);
    await db.put('session', { version: 99 } as never, 'current');

    await expect(storage.loadWorkspace()).resolves.toEqual({
      session: null,
      artDataUrl: null,
    });
  });
});

describe('saved proxies', () => {
  it('lists lightweight summaries, newest first', async () => {
    const { storage } = newStorage();
    await storage.saveProxy({
      name: 'Première',
      card: CARD,
      template: 'signature',
      frame: 'minimal',
      accent: 'auto',
      art: ART,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await storage.saveProxy({
      name: '',
      card: { ...CARD, name: 'Contresort' },
      template: 'classic',
      frame: 'dark',
      accent: 'U',
      art: null,
    });

    const summaries = await storage.listProxies();
    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toEqual(second);
    expect(summaries[0].name).toBe('Contresort');
    expect(summaries[0].hasArt).toBe(false);
    expect(summaries[1]).toMatchObject({ name: 'Première', cardName: 'Foudre', hasArt: true });
    expect(summaries[0]).not.toHaveProperty('card');
  });

  it('loads a proxy with its full artwork image', async () => {
    const { storage } = newStorage();
    const summary = await storage.saveProxy({
      name: 'Foudre custom',
      card: CARD,
      template: 'modern',
      frame: 'minimal',
      accent: 'R',
      art: ART,
    });

    const proxy = await storage.getProxy(summary.id);
    expect(proxy?.art).toEqual(ART);
    expect(proxy?.card).toEqual(CARD);
    expect(proxy?.template).toBe('modern');
  });

  it('returns null for an unknown proxy', async () => {
    const { storage } = newStorage();
    await expect(storage.getProxy('missing')).resolves.toBeNull();
  });

  it('deletes both the metadata and the artwork image', async () => {
    const { name, storage } = newStorage();
    const summary = await storage.saveProxy({
      name: 'À supprimer',
      card: CARD,
      template: 'signature',
      frame: 'minimal',
      accent: 'auto',
      art: ART,
    });

    await storage.deleteProxy(summary.id);

    await expect(storage.getProxy(summary.id)).resolves.toBeNull();
    const db = await openProxySmithDatabase(name);
    await expect(db.get('proxyArt', summary.id)).resolves.toBeUndefined();
  });
});

describe('describeStorageError', () => {
  it('explains a quota exceeded error', () => {
    const error = new DOMException('quota', 'QuotaExceededError');
    expect(describeStorageError(error)).toContain('Espace de stockage local insuffisant');
  });

  it('falls back to a generic French message', () => {
    expect(describeStorageError(new Error('boom'))).toContain('sauvegarde locale');
  });
});
