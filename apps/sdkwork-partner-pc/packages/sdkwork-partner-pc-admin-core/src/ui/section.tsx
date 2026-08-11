import type { ReactNode } from 'react';

/** Section header + content block used inside drawers and forms. */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-slate-200 pb-6 last:border-0 last:pb-0 dark:border-white/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
