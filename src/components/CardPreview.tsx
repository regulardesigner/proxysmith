import { forwardRef, type CSSProperties } from 'react';
import clsx from 'clsx';
import type { AccentChoice, Artwork, CardData, CardTemplate, FrameStyle } from '../types';
import { resolveCardTheme } from '../lib/cardTheme';
import { AutoFitText } from './AutoFitText';
import { ManaCost, OracleText } from './Mana';

type CardPreviewProps = {
  card: CardData;
  template: CardTemplate;
  frame: FrameStyle;
  accent: AccentChoice;
  art: Artwork | null;
};

export const CardPreview = forwardRef<HTMLDivElement, CardPreviewProps>(function CardPreview(
  { card, template, frame, accent, art },
  ref,
) {
  const theme = resolveCardTheme(card.colorIdentity, accent, template, frame);
  const stats = card.power && card.toughness ? `${card.power}/${card.toughness}` : null;
  const meta = [card.setCode.toUpperCase(), card.collectorNumber].filter(Boolean).join(' · ');

  return (
    <div
      ref={ref}
      lang={card.lang}
      role="group"
      aria-label={`Aperçu de la carte proxy ${card.name}`}
      className={clsx(
        'mtg-card',
        `mtg-card--${template}`,
        template === 'signature' && frame === 'dark' && 'mtg-card--dark',
      )}
      style={
        {
          '--frame-accent': theme.accent,
          '--frame-accent-2': theme.accent2,
          '--frame-title-ink': theme.titleInk,
        } as CSSProperties
      }
    >
      <div className="mtg-inner-border" />

      <header className="mtg-title">
        <AutoFitText
          text={card.name}
          mode="width"
          min={20}
          max={42}
          className="mtg-name"
        />
        <ManaCost cost={card.manaCost} className="mtg-mana" />
      </header>

      <div className="mtg-art">
        {art ? (
          <img
            src={art.dataUrl}
            alt={`Illustration de ${card.name}`}
            draggable={false}
            className="mtg-art-img"
            style={{
              transform: `translate(${art.offsetX}%, ${art.offsetY}%) scale(${art.zoom})`,
            }}
          />
        ) : (
          <div className="mtg-art-empty">
            <svg
              viewBox="0 0 24 24"
              className="h-10 w-10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="m21 16-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="mtg-art-empty-title">Votre illustration</span>
            <span className="mtg-art-empty-hint">Importez une image depuis le panneau de droite</span>
          </div>
        )}
        <div className="mtg-art-frame" />
      </div>

      <div className="mtg-type">
        <AutoFitText text={card.typeLine} mode="width" min={15} max={27} className="mtg-type-text" />
      </div>

      <div className="mtg-text">
        <AutoFitText
          text={card.oracleText}
          min={15}
          max={30}
          className="mtg-oracle"
          render={(text) => <OracleText text={text} />}
        />
      </div>

      <footer className="mtg-bottom">
        <div className="mtg-meta">
          <span className="mtg-proxy">PROXY</span>
          {meta && <span>{meta}</span>}
          {card.isFrontFaceOnly && <span>Face avant</span>}
          {art && <span>Art : vous</span>}
        </div>

        {stats && <div className="mtg-pt">{stats}</div>}
        {!stats && card.loyalty && (
          <div className="mtg-loyalty" title={`Loyauté ${card.loyalty}`}>
            {card.loyalty}
          </div>
        )}
      </footer>
    </div>
  );
});
