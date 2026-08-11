/** Domain-neutral status pill. The label and tone come from the owning page. */
export function StatusBadge({
  label,
  tone = 'slate',
}: {
  label: string;
  tone?: 'emerald' | 'amber' | 'red' | 'blue' | 'slate' | 'indigo';
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
  };
  return (
    <span className={`inline-flex min-w-16 justify-center rounded-full px-2 py-1 text-xs font-semibold ${tones[tone] ?? tones.slate}`}>
      {label}
    </span>
  );
}
