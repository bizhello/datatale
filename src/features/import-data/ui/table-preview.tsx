import { Table } from "@heroui/react";
import type { Dataset } from "@/entities/dataset";
import { scalarTypeLabel } from "../config/import-workspace";

type TablePreviewProps = { data: Dataset };

export function TablePreview({ data }: TablePreviewProps) {
  const sample = data.rows.slice(0, 12);
  return (
    <Table className="table-wrap" variant="secondary">
      <p className="sample-label">
        Показаны первые {sample.length} строк из{" "}
        {data.rows.length.toLocaleString("ru-RU")}
      </p>
      <Table.ScrollContainer>
        <Table.Content aria-label="Предпросмотр данных">
          <Table.Header columns={data.columns}>
            {(column) => (
              <Table.Column isRowHeader={column === data.columns[0]}>
                {column.label}
                <small>{scalarTypeLabel[column.scalarType]}</small>
              </Table.Column>
            )}
          </Table.Header>
          <Table.Body items={sample}>
            {(row) => (
              <Table.Row>
                <Table.Collection items={data.columns}>
                  {(column) => (
                    <Table.Cell>
                      {row.values[column.id] === null
                        ? "—"
                        : String(row.values[column.id])}
                    </Table.Cell>
                  )}
                </Table.Collection>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
