import { useRef, useState, type CSSProperties, type ReactNode } from 'react';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * Tooltip wrapper for icon-only action buttons.
 *
 * The tip is positioned with `position: fixed` from the trigger's measured
 * rect, so it is never clipped by table/scroll overflow, and the wrapper
 * listens for mouse/keyboard events so the tip also shows for disabled
 * buttons (native `title` is not fired on disabled elements).
 */
export function Tooltip({
  content,
  side = 'top',
  children,
}: {
  /** Tip copy; rendered in full (never truncated). */
  content: string;
  /** Where the tip appears relative to the trigger; default above. */
  side?: TooltipSide;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const positions: Record<TooltipSide, CSSProperties> = {
      top: { left: centerX, top: rect.top - margin, transform: 'translate(-50%, -100%)' },
      bottom: { left: centerX, top: rect.bottom + margin, transform: 'translate(-50%, 0)' },
      left: { left: rect.left - margin, top: centerY, transform: 'translate(-100%, -50%)' },
      right: { left: rect.right + margin, top: centerY, transform: 'translate(0, -50%)' },
    };
    setStyle(positions[side]);
    setOpen(true);
  };

  const hide = () => setOpen(false);

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          style={{ ...style, position: 'fixed' }}
          className="pointer-events-none z-[90] whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-slate-100 shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
