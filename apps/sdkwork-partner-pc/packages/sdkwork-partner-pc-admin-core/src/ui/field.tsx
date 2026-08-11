import type { ReactNode } from 'react';

/** Form field wrapper: label (with optional required marker) + control + hint. */
export function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 ${className ?? ''}`}>
      <span>{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </label>
  );
}
