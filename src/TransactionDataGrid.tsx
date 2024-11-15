import type {StandardTransactionType} from './LabelTypes';

import Sheet from '@mui/joy/Sheet';
import Table from '@mui/joy/Table';
import {useState} from 'react';

import {getFormattedAmount} from './Currency';

type Props = {
  size?: 'lg' | 'md' | 'sm';
  // label: string;
  transactions: StandardTransactionType[];
};

type GridColumnDef = {
  field: keyof StandardTransactionType;
  formatter?: (value: any) => string;
  headerName: string;
  sx?: Record<string, number | string>;
  // textAlign?: 'center' | 'end' | 'start';
  truncatable?: boolean;
  // width?: string;
};

const ROW_NO_WRAP_STYLE = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const ROW_WRAP_STYLE = {whiteSpace: 'pre-wrap'};

const columns: GridColumnDef[] = [
  {field: 'id', headerName: 'ID'},
  {
    field: 'date',
    headerName: 'Date',
    sx: {width: '8em'},
    truncatable: false,
  },
  {field: 'payee', headerName: 'Payee'},
  {field: 'memo', headerName: 'Memo', sx: {width: '40%'}},
  {
    field: 'amount',
    formatter: (amountNumber: number) => getFormattedAmount(amountNumber),
    headerName: 'Amount',
    sx: {textAlign: 'end', width: '5em'},
    truncatable: false,
  },
];

export default function TransactionDataGrid({
  transactions,
  size = 'md',
}: Props): React.ReactElement {
  const data =
    transactions.length > 0
      ? transactions
      : [{amount: 0, date: '-', id: '-', memo: '-', payee: '-'}];
  const [rowIsWrapped, setRowIsWrapped] = useState<Record<string, boolean>>({});

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

          textAlign: 'start',

          // Ensure that multiple spaces in a row are actually rendered in HTML
          whiteSpace: 'pre-wrap',
        }}>
        <thead>
          <tr>
            {columns.map((c) => {
              return (
                <th key={c.headerName} style={c.sx}>
                  {c.headerName}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {data.map((t) => {
            const rowShouldWrap = rowIsWrapped[t.id] ?? false;

            return (
              <tr
                key={t.id}
                onClick={(_e: React.MouseEvent<HTMLTableRowElement>) => {
                  const newSelectionLength =
                    window.getSelection()?.toString().length ?? null;

                  // Don't toggle the row if we're trying to select something
                  if (newSelectionLength != null && newSelectionLength > 0) {
                    return;
                  }

                  if (rowIsWrapped[t.id] == null) {
                    // Row is currently in default of true, let's change to false

                    setRowIsWrapped((prev) => ({...prev, [t.id]: true}));
                    return;
                  }

                  setRowIsWrapped((prev) => ({...prev, [t.id]: !prev[t.id]}));
                }}>
                {columns.map((col) => (
                  <td
                    key={col.field}
                    style={{
                      ...(rowShouldWrap || !(col.truncatable ?? true)
                        ? ROW_WRAP_STYLE
                        : ROW_NO_WRAP_STYLE),
                      ...(col.sx ?? {}),
                    }}>
                    {col.formatter != null
                      ? col.formatter(t[col.field])
                      : t[col.field]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Sheet>
  );
}
