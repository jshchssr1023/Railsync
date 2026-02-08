/**
 * useExportCSV — pure browser-based CSV export hook.
 *
 * Builds a CSV string from structured data + column definitions,
 * wraps it in a Blob with a UTF-8 BOM for Excel compatibility,
 * and triggers a download via a temporary <a> element.
 *
 * No external dependencies.
 */

export interface ExportColumn {
  /** Property key on each data row */
  key: string;
  /** Header label shown in the first CSV row */
  header: string;
  /** Optional formatter — receives the raw cell value, returns a string */
  format?: (value: any) => string;
}

function escapeCSVValue(value: string): string {
  // If the value contains a comma, double-quote, or newline, wrap it in
  // double-quotes and escape any internal double-quotes by doubling them.
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function useExportCSV() {
  const exportCSV = (
    data: Record<string, any>[],
    columns: ExportColumn[],
    filename: string,
  ) => {
    if (data.length === 0) return;

    // 1. Header row
    const headerRow = columns.map((col) => escapeCSVValue(col.header)).join(',');

    // 2. Data rows
    const dataRows = data.map((row) =>
      columns
        .map((col) => {
          const raw = row[col.key];
          const formatted = col.format
            ? col.format(raw)
            : raw === null || raw === undefined
              ? ''
              : String(raw);
          return escapeCSVValue(formatted);
        })
        .join(','),
    );

    const csvContent = [headerRow, ...dataRows].join('\r\n');

    // 3. UTF-8 BOM + Blob for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // 4. Create a temporary download link and trigger it
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();

    // 5. Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return { exportCSV };
}
