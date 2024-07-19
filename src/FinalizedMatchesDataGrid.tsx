import type {LabelTransactionMatchFinalized} from './Matching';

import Sheet from '@mui/joy/Sheet';
import Table from '@mui/joy/Table';
import {useState} from 'react';

import getFormattedAmount from './getFormattedAmount';
import {renderLabel} from './LabelElements';

type Props = {
  // label: string;
  finalizedMatches: LabelTransactionMatchFinalized[];
  size?: 'lg' | 'md' | 'sm';
};

type GridColumnDef = {
  field: string;
  formatter?: (value: any) => string;
  getValue: (match: LabelTransactionMatchFinalized) => number | string;
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
  // {field: 'id', headerName: 'ID'},
  {
    field: 'labelDate',
    getValue: (m) => m.label.date,
    headerName: 'Label Date',
    sx: {width: '8em'},
    truncatable: false,
  },
  {
    field: 'labelMemo',
    getValue: (m) => renderLabel(m.label.memo, Infinity),
    headerName: 'Label Text',
    // sx: {width: '40%'},
  },
  {
    field: 'labelAmount',
    formatter: (amountNumber: number) => getFormattedAmount(amountNumber),
    getValue: (m) => m.label.amount,
    // Label Amount and Transaction amount should be identical, so let's just show one
    headerName: 'Amount',
    sx: {textAlign: 'end', width: '7em'},
    truncatable: false,
  },
  {
    field: 'transactionDate',
    getValue: (m) => m.transactionMatch.date ?? '',
    headerName: 'YNAB TXN Date',
    sx: {width: '10em'},
    truncatable: false,
  },
  {
    field: 'transactionPayee',
    getValue: (m) => m.transactionMatch.payee_name ?? '',
    headerName: 'YNAB TXN Payee',
    sx: {width: '9em'},
  },
  // {
  //   field: 'transactionMemo',
  //   getValue: (m) => m.transactionMatch.memo ?? '',
  //   headerName: 'YNAB TXN Memo',
  //   // sx: {width: '40%'},
  // },
  {
    field: 'newMemo',
    getValue: (m) => m.newMemo,
    headerName: 'New YNAB TXN Memo',
    // sx: {width: '40%'},
  },
];

export default function FinalizedMatchesDataGrid({
  finalizedMatches,
  size = 'md',
}: Props): React.ReactElement {
  const data = finalizedMatches;
  // finalizedMatches.length > 0
  //   ? finalizedMatches
  //   : [{amount: 0, date: '-', id: '-', memo: '-', payee: '-'}];
  const [rowIsWrapped, setRowIsWrapped] = useState<Record<string, boolean>>({});

  return (
    <Sheet sx={{borderRadius: 'sm', flexShrink: 1}} variant="outlined">
      <Table
        hoverRow
        size={size}
        stickyHeader
        sx={{
          '--Table-headerUnderlineThickness': '1px',
          '--TableCell-headBackground': 'var(--joy-palette-background-level1)',

          '--TableCell-paddingX': '8px',
          '--TableCell-paddingY': '4px',

          // '--TableCell-headBackground': 'var(--joy-palette-background-level1)',
          // '--Table-headerUnderlineThickness': '1px',
          // '--TableRow-hoverBackground': 'var(--joy-palette-background-level1)',
          '--TableRow-hoverBackground': 'var(--joy-palette-background-level1)',

          minWidth: '600px',

          // fontSize: {md: '1rem', xs: '0.75rem'},
          overflowWrap: 'break-word',

          textAlign: 'start',
          // Ensure that multiple spaces in a row are actually rendered in HTML
          whiteSpace: 'pre-wrap',
        }}>
        {/* <caption>
          {
            'This table shows the labels you provided (left) and the matching YNAB transaction (abbreviated TXN; right)'
          }
        </caption> */}

        <thead>
          <tr>
            {columns.map((c) => {
              return (
                <th key={c.headerName} style={{...ROW_WRAP_STYLE, ...c.sx}}>
                  {c.headerName}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {data.map((finalizedMatch) => {
            const rowID = finalizedMatch.label.id;
            const rowShouldWrap = rowIsWrapped[rowID] ?? false;

            return (
              <tr
                key={rowID}
                onClick={() => {
                  if (rowIsWrapped[rowID] == null) {
                    // Row is currently in default of true, let's change to false

                    setRowIsWrapped((prev) => ({
                      ...prev,
                      [rowID]: true,
                    }));
                    return;
                  }

                  setRowIsWrapped((prev) => ({
                    ...prev,
                    [rowID]: !prev[rowID],
                  }));
                }}>
                {columns.map((col) => (
                  <td
                    key={col.headerName}
                    style={{
                      ...(rowShouldWrap || !(col.truncatable ?? true)
                        ? ROW_WRAP_STYLE
                        : ROW_NO_WRAP_STYLE),
                      ...(col.sx ?? {}),
                    }}>
                    {col.formatter != null
                      ? col.formatter(col.getValue(finalizedMatch))
                      : col.getValue(finalizedMatch)}
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
