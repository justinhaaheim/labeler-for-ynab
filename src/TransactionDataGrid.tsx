import type {StandardTransactionType} from './LabelTypes';

import Sheet from '@mui/joy/Sheet';
import Table from '@mui/joy/Table';

type Props = {
  size?: 'lg' | 'md' | 'sm';
  // label: string;
  transactions: StandardTransactionType[];
};

type GridColumnDef = {
  field: keyof StandardTransactionType;
  headerName: string;
  width?: string;
};

const columns: GridColumnDef[] = [
  {field: 'date', headerName: 'Date'},
  {field: 'payee', headerName: 'Payee'},
  {field: 'memo', headerName: 'Memo', width: '50%'},
  {field: 'amount', headerName: 'Amount'},
  // {field: 'id', headerName: 'ID', width: 150},
];

export default function TransactionDataGrid({
  transactions,
  size = 'md',
}: Props): React.ReactElement {
  const data =
    transactions.length > 0
      ? transactions
      : [{amount: '-', date: '-', id: '-', memo: '-', payee: '-'}];

  return (
    <Sheet>
      <Table
        hoverRow
        size={size}
        sx={{
          '--Table-headerUnderlineThickness': '1px',
          '--TableCell-headBackground': 'var(--joy-palette-background-level1)',
          '--TableRow-hoverBackground': 'var(--joy-palette-background-level1)',
          overflowWrap: 'break-word',
        }}>
        <thead>
          <tr>
            {columns.map((c) => {
              const sx = c.width == null ? {} : {width: c.width};

              return (
                <th {...sx} key={c.headerName}>
                  {c.headerName}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {data.map((t) => (
            <tr key={t.id}>
              {columns.map((col) => (
                <td key={col.field}>{t[col.field]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </Sheet>
  );
}
