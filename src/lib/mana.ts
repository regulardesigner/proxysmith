export type ParsedManaSymbol = {
  raw: string;
  className: string | null;
  label: string;
};

const COLORS: Record<string, string> = {
  w: 'blanc',
  u: 'bleu',
  b: 'noir',
  r: 'rouge',
  g: 'vert',
  c: 'incolore',
};

const SPECIALS: Record<string, string> = {
  x: 'X',
  y: 'Y',
  z: 'Z',
  s: 'neige',
  e: 'énergie',
  t: 'engager',
  q: 'dégager',
  p: 'vie',
  h: 'hybride',
  d: 'dégât',
  l: 'loyauté',
  infinity: 'infini',
  half: 'demi',
};

// mana-font ne suit pas toujours le nom du jeton Scryfall ({T} → ms-tap).
const CLASS_OVERRIDES: Record<string, string> = {
  t: 'ms-tap',
  q: 'ms-untap',
};

function labelFor(token: string): string {
  if (/^\d+$/.test(token)) return token;
  if (COLORS[token]) return COLORS[token];
  if (SPECIALS[token]) return SPECIALS[token];

  if (token.includes('/')) {
    return token
      .split('/')
      .map((part) => (part.toLowerCase() === 'p' ? 'phyrexien' : COLORS[part] ?? part))
      .join(' ou ');
  }

  return token;
}

/**
 * Maps a Scryfall mana symbol token (without braces) to a mana-font class.
 * Falls back to null when the symbol is unknown, so the UI can render text.
 */
export function manaSymbolClass(symbol: string): string | null {
  const token = symbol.trim().toLowerCase().replace(/\s+/g, '');
  if (!token) return null;

  const compact = token.replaceAll('/', '');
  if (/^\d{1,6}$/.test(compact)) return `ms-${compact}`;
  if (CLASS_OVERRIDES[compact]) return CLASS_OVERRIDES[compact];
  if (SPECIALS[compact]) return `ms-${compact}`;
  if (/^(?:[wubrgc]|[wubrgc]{2}|[wubrgc]p|[wubrgc]{2}p|\d[wubrgc]|\d[wubrgc]p)$/.test(compact)) {
    return `ms-${compact}`;
  }

  return null;
}

export function parseManaCost(cost: string): ParsedManaSymbol[] {
  const symbols: ParsedManaSymbol[] = [];
  const regex = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cost)) !== null) {
    const token = match[1];
    symbols.push({
      raw: token,
      className: manaSymbolClass(token),
      label: labelFor(token.trim().toLowerCase()),
    });
  }

  return symbols;
}
