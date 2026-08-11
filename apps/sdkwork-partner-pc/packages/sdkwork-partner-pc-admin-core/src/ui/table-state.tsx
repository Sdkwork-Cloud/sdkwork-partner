import { Loader2 } from 'lucide-react';

/** Table empty/loading row. */
export function TableState({ loading, empty, colSpan }: { loading: boolean; empty: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="h-48 text-center text-sm text-slate-500 dark:text-slate-400">
        {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : empty}
      </td>
    </tr>
  );
}
