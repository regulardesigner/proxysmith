import clsx from 'clsx';
import { parseManaCost, type ParsedManaSymbol } from '../lib/mana';

export function ManaSymbol({
  symbol,
  className,
}: {
  symbol: ParsedManaSymbol;
  className?: string;
}) {
  if (!symbol.className) {
    return <span className={clsx('mana-fallback', className)}>{symbol.raw}</span>;
  }

  return (
    <i
      className={clsx('ms ms-cost', symbol.className, className)}
      title={symbol.label}
      aria-hidden="true"
    />
  );
}

export function ManaCost({ cost, className }: { cost: string; className?: string }) {
  const symbols = parseManaCost(cost);
  if (!symbols.length) return null;

  return (
    <span
      className={clsx('inline-flex items-center gap-[0.08em]', className)}
      role="img"
      aria-label={`Coût de mana : ${symbols.map((symbol) => symbol.label).join(', ')}`}
    >
      {symbols.map((symbol, index) => (
        <ManaSymbol key={`${symbol.raw}-${index}`} symbol={symbol} />
      ))}
    </span>
  );
}

export function OracleText({ text }: { text: string }) {
  const parts = text.split(/(\{[^}]+\})/g);
  const accessibleText = parts.map((part) => parseManaCost(part)[0]?.label ?? part).join('');

  return (
    <>
      <span className="sr-only">{accessibleText}</span>
      <span aria-hidden="true">
        {parts.map((part, index) => {
          const match = part.match(/^\{([^}]+)\}$/);
          if (!match) return <span key={index}>{part}</span>;

          const [symbol] = parseManaCost(part);
          if (!symbol) return <span key={index}>{part}</span>;

          return <ManaSymbol key={index} symbol={symbol} className="mtg-inline-symbol" />;
        })}
      </span>
    </>
  );
}
