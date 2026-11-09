import { describe, expect, it } from 'vitest';
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  SHEET_CARD_COUNT,
  computeSheetLayout,
  slugify,
  withPngDpi,
} from './export';

// PNG 1 × 1 pixel valide, sans chunk pHYs.
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

type PngChunk = { type: string; data: Uint8Array };

function readChunks(dataUrl: string): PngChunk[] {
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (character) =>
    character.charCodeAt(0),
  );
  const view = new DataView(bytes.buffer);
  const chunks: PngChunk[] = [];
  let offset = 8;

  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += length + 12;
  }

  return chunks;
}

describe('slugify', () => {
  it('removes accents and punctuation', () => {
    expect(slugify('Épée de feu et de glace')).toBe('epee-de-feu-et-de-glace');
    expect(slugify('  Jace, the Mind Sculptor  ')).toBe('jace-the-mind-sculptor');
    expect(slugify('???')).toBe('carte');
  });
});

describe('computeSheetLayout', () => {
  const layout = computeSheetLayout();

  it('places a centered 3 × 3 grid of contiguous cards on A4', () => {
    expect(layout.cards).toHaveLength(SHEET_CARD_COUNT);
    expect(layout.pageWidth).toBe(A4_WIDTH_MM);
    expect(layout.pageHeight).toBe(A4_HEIGHT_MM);

    const first = layout.cards[0];
    expect(first.x).toBeCloseTo((A4_WIDTH_MM - CARD_WIDTH_MM * 3) / 2);
    expect(first.y).toBeCloseTo((A4_HEIGHT_MM - CARD_HEIGHT_MM * 3) / 2);
    expect(first.width).toBe(CARD_WIDTH_MM);
    expect(first.height).toBe(CARD_HEIGHT_MM);

    const last = layout.cards[layout.cards.length - 1];
    expect(last.x + last.width).toBeCloseTo(A4_WIDTH_MM - first.x);
    expect(last.y + last.height).toBeCloseTo(A4_HEIGHT_MM - first.y);
  });

  it('keeps cards inside the sheet without overlap', () => {
    for (const card of layout.cards) {
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.y).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(A4_WIDTH_MM);
      expect(card.y + card.height).toBeLessThanOrEqual(A4_HEIGHT_MM);
    }

    for (let index = 0; index < layout.cards.length; index += 1) {
      for (let other = index + 1; other < layout.cards.length; other += 1) {
        const a = layout.cards[index];
        const b = layout.cards[other];
        const overlapX = a.x < b.x + b.width && b.x < a.x + a.width;
        const overlapY = a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });

  it('draws crop marks inside the page margins', () => {
    expect(layout.cropMarks.length).toBeGreaterThan(0);
    for (const mark of layout.cropMarks) {
      for (const value of [mark.x1, mark.x2]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(A4_WIDTH_MM);
      }
      for (const value of [mark.y1, mark.y2]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(A4_HEIGHT_MM);
      }
    }
  });
});

describe('withPngDpi', () => {
  it('inserts a 300 DPI pHYs chunk after IHDR', () => {
    const output = withPngDpi(`data:image/png;base64,${TINY_PNG}`, 300);
    const chunks = readChunks(output);

    expect(chunks.map((chunk) => chunk.type)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);

    const phys = chunks.find((chunk) => chunk.type === 'pHYs');
    expect(phys).toBeDefined();

    const view = new DataView(phys!.data.buffer, phys!.data.byteOffset, phys!.data.byteLength);
    expect(view.getUint32(0)).toBe(11811);
    expect(view.getUint32(4)).toBe(11811);
    expect(view.getUint8(8)).toBe(1);
  });

  it('leaves non-PNG input untouched', () => {
    const input = 'data:image/jpeg;base64,AAAA';
    expect(withPngDpi(input)).toBe(input);
  });
});
