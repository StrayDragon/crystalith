type DataTableCardProps = {
  columns: string[];
  rows: Array<Array<string | number | null>>;
};

function renderCell(value: string | number | null) {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value);
}

export default function DataTableCard({ columns, rows }: DataTableCardProps) {
  const rowKeyCounts = new Map<string, number>();
  const getRowKey = (row: Array<string | number | null>) => {
    const baseKey = JSON.stringify(row);
    const count = rowKeyCounts.get(baseKey) ?? 0;
    rowKeyCounts.set(baseKey, count + 1);
    return `${baseKey}:${count}`;
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold text-gray-900 dark:text-slate-100">Table</div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left text-[11px] font-semibold text-gray-700 dark:text-slate-200 border-b border-gray-200 dark:border-slate-700 py-2 pr-4"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowKey = getRowKey(row);
              return (
                <tr
                  key={rowKey}
                  className="border-b border-gray-100 dark:border-slate-800 last:border-b-0"
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={`${rowKey}:${col}`}
                      className="text-[11px] text-gray-700 dark:text-slate-200 py-2 pr-4 align-top"
                    >
                      {renderCell(row[colIndex] ?? null)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(1, columns.length)}
                  className="text-[11px] text-gray-500 dark:text-slate-300 py-2"
                >
                  No rows
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
