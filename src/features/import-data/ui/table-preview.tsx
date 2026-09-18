import type { Dataset } from "@/entities/dataset";
import { scalarTypeLabel } from "../config/import-workspace";

type TablePreviewProps = { data: Dataset };

export function TablePreview({ data }: TablePreviewProps) {
  const sample = data.rows.slice(0, 12);
  return (
    <div className="table-wrap">
      <p className="sample-label">
        Показаны первые {sample.length} строк из{" "}
        {data.rows.length.toLocaleString("ru-RU")}
      </p>
      <table>
        <thead>
          <tr>
            {data.columns.map((column) => (
              <th key={column.id} scope="col">
                {column.label}
                <small>{scalarTypeLabel[column.scalarType]}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sample.map((row) => (
            <tr key={row.id}>
              {data.columns.map((column) => (
                <td key={column.id}>
                  {row.values[column.id] === null
                    ? "—"
                    : String(row.values[column.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
