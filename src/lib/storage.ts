import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AccentChoice, Artwork, CardData, CardTemplate, FrameStyle } from '../types';

export const DB_NAME = 'proxysmith';
const DB_VERSION = 1;
const WORKSPACE_KEY = 'current';
const VALUES = {
  template: ['signature', 'classic', 'modern'],
  frame: ['minimal', 'dark'],
  accent: ['auto', 'W', 'U', 'B', 'R', 'G', 'C', 'M'],
} as const satisfies Record<string, readonly string[]>;

export type StoredArtwork = Omit<Artwork, 'dataUrl'>;

export type StoredSession = {
  version: 1;
  card: CardData;
  template: CardTemplate;
  frame: FrameStyle;
  accent: AccentChoice;
  art: StoredArtwork | null;
  updatedAt: number;
};

export type Workspace = {
  session: StoredSession | null;
  artDataUrl: string | null;
};

export type SavedProxySummary = {
  id: string;
  name: string;
  cardName: string;
  hasArt: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SavedProxy = SavedProxySummary & {
  card: CardData;
  template: CardTemplate;
  frame: FrameStyle;
  accent: AccentChoice;
  art: Artwork | null;
};

type SavedProxyRecord = {
  id: string;
  name: string;
  cardName: string;
  hasArt: boolean;
  createdAt: number;
  updatedAt: number;
  card: CardData;
  template: CardTemplate;
  frame: FrameStyle;
  accent: AccentChoice;
  art: StoredArtwork | null;
};

type ArtImage = { dataUrl: string };

interface ProxySmithDatabase extends DBSchema {
  session: { key: string; value: StoredSession };
  sessionArt: { key: string; value: ArtImage };
  proxies: { key: string; value: SavedProxyRecord; indexes: { 'by-updated': number } };
  proxyArt: { key: string; value: ArtImage };
}

export type CardStorage = {
  loadWorkspace: () => Promise<Workspace>;
  saveSession: (session: StoredSession | null) => Promise<void>;
  saveArtDataUrl: (dataUrl: string | null) => Promise<void>;
  listProxies: () => Promise<SavedProxySummary[]>;
  getProxy: (id: string) => Promise<SavedProxy | null>;
  saveProxy: (input: SaveProxyInput) => Promise<SavedProxySummary>;
  deleteProxy: (id: string) => Promise<void>;
};

type SaveProxyInput = {
  name: string;
  card: CardData;
  template: CardTemplate;
  frame: FrameStyle;
  accent: AccentChoice;
  art: Artwork | null;
};

export function toStoredSession(input: {
  card: CardData;
  template: CardTemplate;
  frame: FrameStyle;
  accent: AccentChoice;
  art: Artwork | null;
}): StoredSession {
  return {
    version: DB_VERSION,
    card: input.card,
    template: input.template,
    frame: input.frame,
    accent: input.accent,
    art: input.art ? toStoredArtwork(input.art) : null,
    updatedAt: Date.now(),
  };
}

export function toStoredArtwork(art: Artwork): StoredArtwork {
  return {
    fileName: art.fileName,
    zoom: art.zoom,
    offsetX: art.offsetX,
    offsetY: art.offsetY,
  };
}

export async function openProxySmithDatabase(name = DB_NAME): Promise<IDBPDatabase<ProxySmithDatabase>> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB indisponible');
  }

  return openDB<ProxySmithDatabase>(name, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('session');
      database.createObjectStore('sessionArt');
      database
        .createObjectStore('proxies', { keyPath: 'id' })
        .createIndex('by-updated', 'updatedAt');
      database.createObjectStore('proxyArt');
    },
  });
}

export function createCardStorage(name = DB_NAME): CardStorage {
  let databasePromise: Promise<IDBPDatabase<ProxySmithDatabase>> | null = null;

  function database(): Promise<IDBPDatabase<ProxySmithDatabase>> {
    databasePromise ??= openProxySmithDatabase(name);
    return databasePromise;
  }

  return {
    async loadWorkspace() {
      const db = await database();
      const transaction = db.transaction(['session', 'sessionArt'], 'readonly');
      const [session, image] = await Promise.all([
        transaction.objectStore('session').get(WORKSPACE_KEY),
        transaction.objectStore('sessionArt').get(WORKSPACE_KEY),
      ]);

      if (!isStoredSession(session)) return { session: null, artDataUrl: null };

      return {
        session,
        artDataUrl: session.art && isArtImage(image) ? image.dataUrl : null,
      };
    },

    async saveSession(session) {
      const db = await database();
      const transaction = db.transaction(['session', 'sessionArt'], 'readwrite');

      if (session) {
        transaction.objectStore('session').put(session, WORKSPACE_KEY);
      } else {
        transaction.objectStore('session').delete(WORKSPACE_KEY);
        transaction.objectStore('sessionArt').delete(WORKSPACE_KEY);
      }

      await transaction.done;
    },

    async saveArtDataUrl(dataUrl) {
      const db = await database();
      const transaction = db.transaction('sessionArt', 'readwrite');

      if (dataUrl) {
        transaction.store.put({ dataUrl }, WORKSPACE_KEY);
      } else {
        transaction.store.delete(WORKSPACE_KEY);
      }

      await transaction.done;
    },

    async listProxies() {
      const db = await database();
      const records = await db.getAll('proxies');
      return records
        .filter(isSavedProxyRecord)
        .map(toSummary)
        .sort((left, right) => right.updatedAt - left.updatedAt);
    },

    async getProxy(id) {
      const db = await database();
      const transaction = db.transaction(['proxies', 'proxyArt'], 'readonly');
      const [record, image] = await Promise.all([
        transaction.objectStore('proxies').get(id),
        transaction.objectStore('proxyArt').get(id),
      ]);

      if (!isSavedProxyRecord(record)) return null;

      return {
        ...toSummary(record),
        card: record.card,
        template: record.template,
        frame: record.frame,
        accent: record.accent,
        art:
          record.art && isArtImage(image)
            ? { ...record.art, dataUrl: image.dataUrl }
            : null,
      };
    },

    async saveProxy(input) {
      const now = Date.now();
      const id = crypto.randomUUID();
      const record: SavedProxyRecord = {
        id,
        name: input.name.trim() || input.card.name,
        cardName: input.card.name,
        hasArt: input.art !== null,
        createdAt: now,
        updatedAt: now,
        card: input.card,
        template: input.template,
        frame: input.frame,
        accent: input.accent,
        art: input.art ? toStoredArtwork(input.art) : null,
      };

      const db = await database();
      const transaction = db.transaction(['proxies', 'proxyArt'], 'readwrite');
      transaction.objectStore('proxies').put(record);

      if (input.art) {
        transaction.objectStore('proxyArt').put({ dataUrl: input.art.dataUrl }, id);
      }

      await transaction.done;
      return toSummary(record);
    },

    async deleteProxy(id) {
      const db = await database();
      const transaction = db.transaction(['proxies', 'proxyArt'], 'readwrite');
      transaction.objectStore('proxies').delete(id);
      transaction.objectStore('proxyArt').delete(id);
      await transaction.done;
    },
  };
}

export const cardStorage = createCardStorage();

export function describeStorageError(error: unknown): string {
  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : '';

  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return 'Espace de stockage local insuffisant. Supprimez une proxy sauvegardée puis réessayez.';
  }

  if (typeof indexedDB === 'undefined') {
    return "Le stockage local n'est pas disponible dans ce navigateur.";
  }

  return 'La sauvegarde locale est indisponible. Vos modifications restent dans cet onglet.';
}

function toSummary(record: SavedProxyRecord): SavedProxySummary {
  return {
    id: record.id,
    name: record.name,
    cardName: record.cardName,
    hasArt: record.hasArt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!isRecord(value) || value.version !== DB_VERSION) return false;
  if (!isCardData(value.card)) return false;
  if (!isTemplate(value.template) || !isFrame(value.frame) || !isAccent(value.accent)) {
    return false;
  }
  return value.art === null || isStoredArtwork(value.art);
}

function isSavedProxyRecord(value: unknown): value is SavedProxyRecord {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return false;
  if (typeof value.cardName !== 'string' || typeof value.hasArt !== 'boolean') return false;
  if (typeof value.createdAt !== 'number' || typeof value.updatedAt !== 'number') return false;
  if (!isCardData(value.card)) return false;
  if (!isTemplate(value.template) || !isFrame(value.frame) || !isAccent(value.accent)) {
    return false;
  }
  return value.art === null || isStoredArtwork(value.art);
}

const CARD_STRING_FIELDS = [
  'scryfallId',
  'name',
  'manaCost',
  'typeLine',
  'oracleText',
  'setCode',
  'setName',
  'collectorNumber',
  'rarity',
  'layout',
  'lang',
] as const;

function isCardData(value: unknown): value is CardData {
  if (!isRecord(value)) return false;
  if (!CARD_STRING_FIELDS.every((field) => typeof value[field] === 'string')) return false;
  if (!isStringArray(value.colors) || !isStringArray(value.colorIdentity)) return false;
  if (typeof value.isFrontFaceOnly !== 'boolean') return false;

  return (['power', 'toughness', 'loyalty'] as const).every(
    (field) => value[field] === undefined || typeof value[field] === 'string',
  );
}

function isStoredArtwork(value: unknown): value is StoredArtwork {
  if (!isRecord(value)) return false;
  return (
    typeof value.fileName === 'string' &&
    isFiniteNumber(value.zoom) &&
    isFiniteNumber(value.offsetX) &&
    isFiniteNumber(value.offsetY)
  );
}

function isArtImage(value: unknown): value is ArtImage {
  return (
    isRecord(value) &&
    typeof value.dataUrl === 'string' &&
    value.dataUrl.startsWith('data:image/')
  );
}

function isTemplate(value: unknown): value is CardTemplate {
  return VALUES.template.includes(value as CardTemplate);
}

function isFrame(value: unknown): value is FrameStyle {
  return VALUES.frame.includes(value as FrameStyle);
}

function isAccent(value: unknown): value is AccentChoice {
  return VALUES.accent.includes(value as AccentChoice);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
