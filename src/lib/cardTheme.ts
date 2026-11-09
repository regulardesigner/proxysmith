import type { AccentChoice, CardTemplate, FrameStyle } from '../types';

export type CardTheme = {
  accent: string;
  accent2: string;
  titleInk: string;
};

export const ACCENT_OPTIONS: Array<{
  value: AccentChoice;
  label: string;
  swatch: string;
}> = [
  { value: 'auto', label: 'Automatique', swatch: 'auto' },
  { value: 'W', label: 'Blanc', swatch: '#e6d38f' },
  { value: 'U', label: 'Bleu', swatch: '#6fb7ff' },
  { value: 'B', label: 'Noir', swatch: '#8b6fb0' },
  { value: 'R', label: 'Rouge', swatch: '#ff8a68' },
  { value: 'G', label: 'Vert', swatch: '#79e0a1' },
  { value: 'C', label: 'Incolore', swatch: '#d6d1c5' },
  { value: 'M', label: 'Or', swatch: '#f3c96b' },
];

export const ACCENT_LABELS: Record<AccentChoice, string> = Object.fromEntries(
  ACCENT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<AccentChoice, string>;

const LIGHT_ACCENTS: Record<string, string> = {
  W: '#b3922f',
  U: '#3d76a8',
  B: '#6b5483',
  R: '#b24832',
  G: '#4f7a4c',
  C: '#8a8274',
  M: '#a67c1f',
};

const DARK_ACCENTS: Record<string, string> = {
  W: '#e6d38f',
  U: '#7ab3e6',
  B: '#b79ad4',
  R: '#ef8a6c',
  G: '#8cc487',
  C: '#c2bbae',
  M: '#e0b75c',
};

const CLASSIC_ACCENTS: Record<string, string> = {
  W: '#e8dab4',
  U: '#a6cddd',
  B: '#45403a',
  R: '#dfa28c',
  G: '#a3ba8f',
  C: '#c4b69b',
  M: '#dfc47c',
};

const MODERN_ACCENTS: Record<string, string> = {
  W: '#f5e6ad',
  U: '#6fb7ff',
  B: '#b18cff',
  R: '#ff8a68',
  G: '#79e0a1',
  C: '#d6d1c5',
  M: '#f3c96b',
};

const COLOR_KEYS = new Set(['W', 'U', 'B', 'R', 'G']);

function isDark(hex: string): boolean {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return false;
  const value = Number.parseInt(match[1], 16);
  const red = ((value >> 16) & 0xff) / 255;
  const green = ((value >> 8) & 0xff) / 255;
  const blue = (value & 0xff) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance < 0.42;
}

/**
 * Détermine la ou les couleurs du cadre.
 * - `auto` suit l'identité de couleur de la carte.
 * - Une couleur choisie manuellement est imposée à tous les templates.
 * - Le template 1993 utilise l'or pour les cartes multicolores, comme les cadres d'origine.
 * - Le template 2026 conserve deux couleurs distinctes pour produire un dégradé.
 */
export function resolveCardTheme(
  colorIdentity: string[],
  choice: AccentChoice,
  template: CardTemplate,
  frame: FrameStyle,
): CardTheme {
  const identity = colorIdentity.filter((color) => COLOR_KEYS.has(color));
  const keys = choice === 'auto' ? identity : [choice];

  const palette =
    template === 'classic'
      ? CLASSIC_ACCENTS
      : template === 'modern'
        ? MODERN_ACCENTS
        : frame === 'dark'
          ? DARK_ACCENTS
          : LIGHT_ACCENTS;

  let primaryKey: string;
  let secondaryKey: string;

  if (template === 'modern') {
    primaryKey = keys[0] ?? 'C';
    secondaryKey = keys[1] ?? primaryKey;
  } else {
    primaryKey = keys.length > 1 ? 'M' : (keys[0] ?? 'C');
    secondaryKey = primaryKey;
  }

  const accent = palette[primaryKey] ?? palette.M;
  const accent2 = palette[secondaryKey] ?? accent;

  return {
    accent,
    accent2,
    titleInk: isDark(accent) ? '#faf3e3' : '#191510',
  };
}
