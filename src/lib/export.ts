import { toPng } from 'html-to-image';
import type { Artwork } from '../types';

export const CARD_WIDTH_PX = 750;
export const CARD_HEIGHT_PX = 1050;
export const MM_TO_PT = 72 / 25.4;
export const CARD_WIDTH_MM = 63.5;
export const CARD_HEIGHT_MM = 88.9;
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const SHEET_COLUMNS = 3;
export const SHEET_ROWS = 3;
export const SHEET_CARD_COUNT = SHEET_COLUMNS * SHEET_ROWS;

export type SheetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropMark = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type SheetLayout = {
  pageWidth: number;
  pageHeight: number;
  cards: SheetRect[];
  cropMarks: CropMark[];
};

/**
 * Planche A4 3 × 3 : les cartes sont jointives (63 × 88,2 mm, soit le ratio
 * 750 × 1050 px à ~302 DPI) et centrées. Les traits de coupe sont placés dans
 * les marges, alignés sur chaque ligne et colonne de la grille.
 */
export function computeSheetLayout(
  pageWidth = A4_WIDTH_MM,
  pageHeight = A4_HEIGHT_MM,
): SheetLayout {
  const blockWidth = CARD_WIDTH_MM * SHEET_COLUMNS;
  const blockHeight = CARD_HEIGHT_MM * SHEET_ROWS;
  const left = (pageWidth - blockWidth) / 2;
  const top = (pageHeight - blockHeight) / 2;

  const cards: SheetRect[] = [];
  for (let row = 0; row < SHEET_ROWS; row += 1) {
    for (let column = 0; column < SHEET_COLUMNS; column += 1) {
      cards.push({
        x: left + column * CARD_WIDTH_MM,
        y: top + row * CARD_HEIGHT_MM,
        width: CARD_WIDTH_MM,
        height: CARD_HEIGHT_MM,
      });
    }
  }

  const tickLength = Math.min(6, Math.min(left, top));
  const cropMarks: CropMark[] = [];

  // Repères verticaux (bords haut et bas de la page).
  for (let column = 0; column <= SHEET_COLUMNS; column += 1) {
    const x = left + column * CARD_WIDTH_MM;
    cropMarks.push({ x1: x, y1: 0, x2: x, y2: tickLength });
    cropMarks.push({ x1: x, y1: pageHeight, x2: x, y2: pageHeight - tickLength });
  }

  // Repères horizontaux (bords gauche et droit de la page).
  for (let row = 0; row <= SHEET_ROWS; row += 1) {
    const y = top + row * CARD_HEIGHT_MM;
    cropMarks.push({ x1: 0, y1: y, x2: tickLength, y2: y });
    cropMarks.push({ x1: pageWidth, y1: y, x2: pageWidth - tickLength, y2: y });
  }

  return { pageWidth, pageHeight, cards, cropMarks };
}

export function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'carte'
  );
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * html-to-image ne renseigne pas la résolution du PNG. On ajoute un chunk pHYs
 * (300 DPI = 11811 px/m) pour que les logiciels d'impression proposent la
 * bonne taille par défaut.
 */
export function withPngDpi(dataUrl: string, dpi = 300): string {
  const separator = dataUrl.indexOf(',');
  if (separator === -1) return dataUrl;

  const binary = atob(dataUrl.slice(separator + 1));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  // Signature PNG (8) + IHDR (4 longueur + 4 type + 13 données + 4 CRC).
  const ihdrEnd = 33;
  if (bytes.length < ihdrEnd || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') {
    return dataUrl;
  }

  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const chunkData = new Uint8Array(9);
  const dataView = new DataView(chunkData.buffer);
  dataView.setUint32(0, pixelsPerMeter);
  dataView.setUint32(4, pixelsPerMeter);
  chunkData[8] = 1; // unité : mètre

  const type = new TextEncoder().encode('pHYs');
  const crcInput = new Uint8Array(type.length + chunkData.length);
  crcInput.set(type, 0);
  crcInput.set(chunkData, type.length);

  const chunk = new Uint8Array(4 + 4 + chunkData.length + 4);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, chunkData.length);
  chunk.set(type, 4);
  chunk.set(chunkData, 8);
  chunkView.setUint32(17, crc32(crcInput));

  const output = new Uint8Array(bytes.length + chunk.length);
  output.set(bytes.subarray(0, ihdrEnd), 0);
  output.set(chunk, ihdrEnd);
  output.set(bytes.subarray(ihdrEnd), ihdrEnd + chunk.length);

  let encoded = '';
  const sliceSize = 0x8000;
  for (let offset = 0; offset < output.length; offset += sliceSize) {
    encoded += String.fromCharCode(...output.subarray(offset, offset + sliceSize));
  }

  return `data:image/png;base64,${btoa(encoded)}`;
}

export async function exportCardPng(
  node: HTMLElement,
  name: string,
  art: Artwork | null,
): Promise<void> {
  const canvas = await renderCardCanvas(node, art);

  const link = document.createElement('a');
  link.download = `${slugify(name)}-proxy.png`;
  link.href = withPngDpi(canvas.toDataURL('image/png'), 300);
  link.click();
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Impossible de charger l'illustration pour l'export."));
    image.src = source;
  });
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const corner = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.quadraticCurveTo(x + width, y, x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  context.lineTo(x + corner, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - corner);
  context.lineTo(x, y + corner);
  context.quadraticCurveTo(x, y, x + corner, y);
  context.closePath();
}

/**
 * html-to-image ne rend pas toujours les <img> intégrés de façon fiable selon
 * le navigateur (ou lorsque la source est volumineuse). On exclut donc
 * l'illustration du rendu DOM et on la compose nous-mêmes sur le canvas, avec
 * le même cadrage que l'aperçu (object-fit: cover + zoom + décalage).
 */
async function drawArtwork(
  context: CanvasRenderingContext2D,
  card: HTMLElement,
  art: Artwork | null,
): Promise<void> {
  if (!art) return;

  const artElement = card.querySelector<HTMLElement>('.mtg-art');
  if (!artElement) return;

  const artStyle = getComputedStyle(artElement);
  const imageElement = artElement.querySelector<HTMLImageElement>('.mtg-art-img');
  const border = imageElement
    ? imageElement.offsetLeft
    : Number.parseFloat(artStyle.borderLeftWidth) || 0;

  const x = artElement.offsetLeft + border;
  const y = artElement.offsetTop + (imageElement ? imageElement.offsetTop : border);
  const width = imageElement?.offsetWidth || artElement.clientWidth;
  const height = imageElement?.offsetHeight || artElement.clientHeight;
  if (!width || !height) return;

  const outerRadius = Number.parseFloat(artStyle.borderTopLeftRadius) || 0;
  const clipRadius = Math.max(0, outerRadius - border);

  const source = await loadImage(art.dataUrl);

  // object-fit: cover — l'image remplit la zone, centrée, en conservant son ratio.
  const coverScale = Math.max(width / source.naturalWidth, height / source.naturalHeight);
  const drawWidth = source.naturalWidth * coverScale;
  const drawHeight = source.naturalHeight * coverScale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const translateX = (art.offsetX / 100) * width;
  const translateY = (art.offsetY / 100) * height;

  context.save();
  roundedRect(context, x, y, width, height, clipRadius);
  context.clip();
  context.translate(centerX + translateX, centerY + translateY);
  context.scale(art.zoom, art.zoom);
  context.translate(-centerX, -centerY);
  context.drawImage(source, drawX, drawY, drawWidth, drawHeight);
  context.restore();

  // Le liseré clair est un overlay DOM : on le redessine par-dessus l'image.
  const frame = artElement.querySelector<HTMLElement>('.mtg-art-frame');
  if (frame) {
    const style = getComputedStyle(frame);
    const borderWidth = Number.parseFloat(style.borderTopWidth) || 0;
    if (borderWidth > 0) {
      context.save();
      context.strokeStyle = style.borderTopColor;
      context.lineWidth = borderWidth;
      const inset = borderWidth / 2;
      const frameRadius = Number.parseFloat(style.borderTopLeftRadius) || 0;
      roundedRect(
        context,
        x + inset,
        y + inset,
        width - borderWidth,
        height - borderWidth,
        frameRadius,
      );
      context.stroke();
      context.restore();
    }
  }
}

const EXPORTING_CLASS = 'is-exporting';

async function renderCardCanvas(
  node: HTMLElement,
  art: Artwork | null,
): Promise<HTMLCanvasElement> {
  await document.fonts.ready;

  // L'ombre portée est neutralisée par CSS (`.mtg-card.is-exporting`) afin de
  // conserver les reliefs internes, que `boxShadow: none` supprimait aussi.
  node.classList.add(EXPORTING_CLASS);
  let baseUrl: string;
  try {
    baseUrl = await toPng(node, {
      width: CARD_WIDTH_PX,
      height: CARD_HEIGHT_PX,
      pixelRatio: 1,
      cacheBust: true,
      style: {
        transform: 'none',
        transformOrigin: 'top left',
        margin: '0',
      },
      filter: (domNode) =>
        !(domNode instanceof HTMLImageElement && domNode.classList.contains('mtg-art-img')),
    });
  } finally {
    node.classList.remove(EXPORTING_CLASS);
  }

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH_PX;
  canvas.height = CARD_HEIGHT_PX;
  const context = canvas.getContext('2d');
  if (!context) throw new Error("Le canvas d'export n'est pas disponible.");

  const base = await loadImage(baseUrl);
  context.drawImage(base, 0, 0, CARD_WIDTH_PX, CARD_HEIGHT_PX);
  await drawArtwork(context, node, art);

  return canvas;
}

export async function exportCardsPdf(
  node: HTMLElement,
  name: string,
  art: Artwork | null,
): Promise<void> {
  const canvas = await renderCardCanvas(node, art);
  const dataUrl = canvas.toDataURL('image/png');

  const { PDFDocument, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${name} — planche A4 9-up`);
  pdf.setAuthor('ProxySmith');
  pdf.setCreator('ProxySmith');
  pdf.setProducer('ProxySmith');
  pdf.setSubject('Planche de 9 proxies à imprimer à 100 % sur A4');
  pdf.setKeywords(['proxy', 'Magic: The Gathering', 'A4', '9-up']);

  const layout = computeSheetLayout();
  const page = pdf.addPage([layout.pageWidth * MM_TO_PT, layout.pageHeight * MM_TO_PT]);

  const image = await pdf.embedPng(dataUrl);
  const cardWidth = CARD_WIDTH_MM * MM_TO_PT;
  const cardHeight = CARD_HEIGHT_MM * MM_TO_PT;

  for (const rect of layout.cards) {
    page.drawImage(image, {
      x: rect.x * MM_TO_PT,
      y: (layout.pageHeight - rect.y - rect.height) * MM_TO_PT,
      width: cardWidth,
      height: cardHeight,
    });
  }

  const markColor = rgb(0.45, 0.45, 0.45);
  for (const mark of layout.cropMarks) {
    page.drawLine({
      start: {
        x: mark.x1 * MM_TO_PT,
        y: (layout.pageHeight - mark.y1) * MM_TO_PT,
      },
      end: {
        x: mark.x2 * MM_TO_PT,
        y: (layout.pageHeight - mark.y2) * MM_TO_PT,
      },
      thickness: 0.4,
      color: markColor,
    });
  }

  const bytes = await pdf.save();
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${slugify(name)}-planche-a4.pdf`;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
