import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

type AutoFitTextProps = {
  text: string;
  className?: string;
  min?: number;
  max?: number;
  mode?: 'height' | 'width';
  render?: (text: string) => ReactNode;
};

/**
 * Reduces the font size until the content fits its container.
 * Measurements happen on the unscaled 750 × 1050 stage, so the result is
 * identical on screen and in the exported PNG.
 */
export function AutoFitText({
  text,
  className,
  min = 15,
  max = 30,
  mode = 'height',
  render,
}: AutoFitTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(max);
  const [fontsVersion, setFontsVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    document.fonts?.ready.then(() => {
      if (!cancelled) setFontsVersion((version) => version + 1);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    let size = max;
    element.style.fontSize = `${size}px`;

    const overflows = () =>
      mode === 'width'
        ? element.scrollWidth > element.clientWidth + 0.5
        : element.scrollHeight > element.clientHeight + 0.5;

    while (size > min && overflows()) {
      size -= 1;
      element.style.fontSize = `${size}px`;
    }

    setFontSize(size);
  }, [text, min, max, mode, fontsVersion]);

  return (
    <div ref={ref} className={className} style={{ fontSize }}>
      {render ? render(text) : text}
    </div>
  );
}
