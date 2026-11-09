import { create } from 'zustand';
import type { AccentChoice, Artwork, CardData, CardTemplate, FrameStyle } from '../types';

type CardStore = {
  card: CardData | null;
  template: CardTemplate;
  frame: FrameStyle;
  accent: AccentChoice;
  art: Artwork | null;
  setCard: (card: CardData) => void;
  patchCard: (patch: Partial<CardData>) => void;
  setTemplate: (template: CardTemplate) => void;
  setFrame: (frame: FrameStyle) => void;
  setAccent: (accent: AccentChoice) => void;
  setArt: (art: Artwork | null) => void;
  reset: () => void;
};

const FRAME_KEY = 'proxysmith:frame';
const TEMPLATE_KEY = 'proxysmith:template';
const ACCENT_KEY = 'proxysmith:accent';
const ACCENT_VALUES: AccentChoice[] = ['auto', 'W', 'U', 'B', 'R', 'G', 'C', 'M'];

function initialFrame(): FrameStyle {
  if (typeof localStorage === 'undefined') return 'minimal';
  return localStorage.getItem(FRAME_KEY) === 'dark' ? 'dark' : 'minimal';
}

function initialTemplate(): CardTemplate {
  if (typeof localStorage === 'undefined') return 'signature';
  const stored = localStorage.getItem(TEMPLATE_KEY);
  return stored === 'classic' || stored === 'modern' ? stored : 'signature';
}

function initialAccent(): AccentChoice {
  if (typeof localStorage === 'undefined') return 'auto';
  const stored = localStorage.getItem(ACCENT_KEY);
  return ACCENT_VALUES.includes(stored as AccentChoice) ? (stored as AccentChoice) : 'auto';
}

export const useCardStore = create<CardStore>()((set) => ({
  card: null,
  template: initialTemplate(),
  frame: initialFrame(),
  accent: initialAccent(),
  art: null,

  setCard: (card) => set({ card, art: null }),

  patchCard: (patch) =>
    set((state) => (state.card ? { card: { ...state.card, ...patch } } : state)),

  setTemplate: (template) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TEMPLATE_KEY, template);
    }
    set({ template });
  },

  setFrame: (frame) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FRAME_KEY, frame);
    }
    set({ frame });
  },

  setAccent: (accent) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACCENT_KEY, accent);
    }
    set({ accent });
  },

  setArt: (art) => set({ art }),

  reset: () => set({ card: null, art: null }),
}));
