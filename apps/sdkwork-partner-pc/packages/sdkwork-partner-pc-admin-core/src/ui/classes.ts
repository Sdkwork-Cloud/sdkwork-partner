/**
 * Shared Tailwind class constants for partner admin surfaces.
 * Mirrors the Cloud Router admin visual language (slate/indigo palette,
 * dark-mode aware) so embedded pages match the host console.
 */

export const inputClass =
  'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-[#111] dark:text-white';
export const selectClass = inputClass;
export const textAreaClass =
  'min-h-20 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-[#111] dark:text-white';
/**
 * Compact toolbar control base (no width utility — callers append a fixed
 * `w-*` class). Do NOT use `inputClass` here: its `w-full` wins over any
 * appended `w-*` in the compiled stylesheet and stretches the control,
 * breaking the single-line filter bar layout.
 */
export const toolbarInputClass =
  'h-8 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-[#111] dark:text-white';
export const toolbarSelectClass = toolbarInputClass;
export const secondaryButtonClass =
  'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#171717] dark:text-slate-200 dark:hover:bg-white/5';
export const primaryButtonClass =
  'inline-flex h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';
export const dangerButtonClass =
  'inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10';
