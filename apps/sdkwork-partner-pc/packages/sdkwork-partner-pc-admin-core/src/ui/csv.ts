/** CSV export helper for admin tables (client-side, BOM-prefixed UTF-8). */

function escapeCell(value: string | number | null | undefined): string {
  let text = String(value ?? '');
  // CSV formula injection guard: cells beginning with spreadsheet formula
  // markers are prefixed with a single quote so Excel/Sheets render them as
  // literal text instead of evaluating them as formulas.
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Serializes rows (ordered objects) into a CSV string and triggers a
 * browser download. Column order follows the first row's keys.
 */
export function exportCsv(filename: string, rows: ReadonlyArray<Record<string, string | number | null | undefined>>): void {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]!);
  const lines = [
    columns.map(escapeCell).join(','),
    ...rows.map((row) => columns.map((column) => escapeCell(row[column])).join(',')),
  ];
  // Prepend BOM so Excel opens UTF-8 content correctly.
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Defer the revoke: some browsers (Firefox, older Safari) resolve the
  // download asynchronously and abort it if the object URL is revoked
  // synchronously after click().
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
