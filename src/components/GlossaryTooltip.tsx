import { useState, useRef, useCallback, type ReactNode } from 'react';
import './GlossaryTooltip.css';

interface Props {
  term: string;
  definition: string;
  children: ReactNode;
}

export function GlossaryTooltip({ term, definition, children }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    const el = spanRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <span
      className="glossary-term"
      ref={spanRef}
      aria-label={`${term}: ${definition}`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {pos && (
        <span
          className="glossary-tooltip"
          style={{ top: pos.top, left: pos.left }}
        >
          {definition}
        </span>
      )}
    </span>
  );
}
