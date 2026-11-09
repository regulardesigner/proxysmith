export type FrameStyle = 'minimal' | 'dark';
export type CardTemplate = 'signature' | 'classic' | 'modern';
export type AccentChoice = 'auto' | 'W' | 'U' | 'B' | 'R' | 'G' | 'C' | 'M';

export type Artwork = {
  dataUrl: string;
  fileName: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export type CardData = {
  scryfallId: string;
  name: string;
  manaCost: string;
  typeLine: string;
  oracleText: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors: string[];
  colorIdentity: string[];
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  layout: string;
  lang: string;
  isFrontFaceOnly: boolean;
};
