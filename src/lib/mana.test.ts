import { describe, expect, it } from 'vitest';
import { manaSymbolClass, parseManaCost } from './mana';

describe('manaSymbolClass', () => {
  it('maps the five colors and generic mana', () => {
    expect(manaSymbolClass('W')).toBe('ms-w');
    expect(manaSymbolClass('u')).toBe('ms-u');
    expect(manaSymbolClass('B')).toBe('ms-b');
    expect(manaSymbolClass('r')).toBe('ms-r');
    expect(manaSymbolClass('G')).toBe('ms-g');
    expect(manaSymbolClass('2')).toBe('ms-2');
    expect(manaSymbolClass('10')).toBe('ms-10');
  });

  it('maps hybrid, phyrexian and special symbols', () => {
    expect(manaSymbolClass('W/U')).toBe('ms-wu');
    expect(manaSymbolClass('2/W')).toBe('ms-2w');
    expect(manaSymbolClass('W/P')).toBe('ms-wp');
    expect(manaSymbolClass('W/U/P')).toBe('ms-wup');
    expect(manaSymbolClass('X')).toBe('ms-x');
    expect(manaSymbolClass('C')).toBe('ms-c');
    expect(manaSymbolClass('T')).toBe('ms-tap');
    expect(manaSymbolClass('Q')).toBe('ms-untap');
  });

  it('returns null for unknown symbols', () => {
    expect(manaSymbolClass('foo')).toBeNull();
  });
});

describe('parseManaCost', () => {
  it('parses a classic cost', () => {
    expect(parseManaCost('{2}{R}')).toEqual([
      { raw: '2', className: 'ms-2', label: '2' },
      { raw: 'R', className: 'ms-r', label: 'rouge' },
    ]);
  });

  it('labels hybrid and phyrexian symbols', () => {
    expect(parseManaCost('{W/U}')).toEqual([
      { raw: 'W/U', className: 'ms-wu', label: 'blanc ou bleu' },
    ]);
    expect(parseManaCost('{W/P}')).toEqual([
      { raw: 'W/P', className: 'ms-wp', label: 'blanc ou phyrexien' },
    ]);
  });

  it('keeps unknown symbols readable', () => {
    expect(parseManaCost('{foo}')).toEqual([{ raw: 'foo', className: null, label: 'foo' }]);
  });

  it('ignores text outside of braces', () => {
    expect(parseManaCost('coût : {X}{X}')).toHaveLength(2);
  });
});
