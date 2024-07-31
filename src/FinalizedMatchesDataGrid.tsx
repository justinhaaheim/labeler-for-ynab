import type {LabelTransactionMatchFinalized} from './Matching';

import Box from '@mui/joy/Box';
import Sheet from '@mui/joy/Sheet';
import Stack from '@mui/joy/Stack';
import Table from '@mui/joy/Table';
import {useState} from 'react';

import getFormattedAmount from './getFormattedAmount';

type Props = {
  // label: string;
  finalizedMatches: LabelTransactionMatchFinalized[];
  size?: 'lg' | 'md' | 'sm';
};

const COLUMN_IDS = [
  'labelDate',
  'labelAmount',
  'transactionDate',
  'transactionPayee',
  'newMemo',
  'warnings',
] as const;
type ColumnID = (typeof COLUMN_IDS)[number];

type ValueGetter = (match: LabelTransactionMatchFinalized) => unknown;

type GridColumnDef = {
  columnID: ColumnID;
  getNode: (match: LabelTransactionMatchFinalized) => React.ReactNode;
  getValue: ValueGetter;
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

const columns: Readonly<GridColumnDef[]> = [
  // {field: 'id', headerName: 'ID'},
  {
    columnID: 'labelDate',
    getNode: (m) => m.label.date,
    getValue: (m) => m.label.date,
    headerName: 'Label Date',
    sx: {width: '8em'},
    truncatable: false,
  },
  // {
  //   field: 'labelMemo',
  //   getValue: (m) => renderLabel(m.label.memo, Infinity),
  //   headerName: 'Label Text',
  //   sx: {width: '15em'},
  // },
  {
    columnID: 'labelAmount',
    getNode: (m) => getFormattedAmount(m.label.amount),
    getValue: (m) => m.label.amount,
    // Label Amount and Transaction amount should be identical, so let's just show one
    headerName: 'Amount',
    sx: {textAlign: 'end', width: '7em'},
    truncatable: false,
  },
  {
    columnID: 'transactionDate',
    getNode: (m) =>
      m.transactionMatch != null ? m.transactionMatch.date ?? '' : '-',
    getValue: (m) => m.transactionMatch?.date,
    headerName: 'Matching YNAB TXN Date',
    sx: {width: '10em'},
    truncatable: false,
  },
  {
    columnID: 'transactionPayee',
    getNode: (m) =>
      m.transactionMatch != null ? m.transactionMatch.payee_name ?? '' : '-',
    getValue: (m) => m.transactionMatch?.payee_name,
    headerName: 'Matching YNAB TXN Payee',
    sx: {width: '9em'},
  },
  // {
  //   field: 'transactionMemo',
  //   getValue: (m) => m.transactionMatch.memo ?? '',
  //   headerName: 'YNAB TXN Memo',
  //   // sx: {width: '40%'},
  // },
  {
    columnID: 'newMemo',
    getNode: (m) => m.newMemo,
    getValue: (m) => m.newMemo,
    headerName: 'YNAB Memo + Label',
    // sx: {width: '40%'},
  },
  {
    columnID: 'warnings',
    getNode: (m) => {
      if (m.warnings.length <= 1) {
        return m.warnings[0]?.message ?? '';
      }

      return (
        <Stack spacing={0.5}>
          {m.warnings.map((w, i) => (
            <Box
              key={String(i) + w}
              sx={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{`${i + 1}) ${
              w.message
            }`}</Box>
          ))}
        </Stack>
      );
    },
    getValue: (m) => m.warnings.join('; '),
    headerName: 'Warnings',
    sx: {width: '14em'},
  },
] as const;

const fieldGetterLookup = columns.reduce<Record<ColumnID, ValueGetter>>(
  (acc, col) => {
    acc[col.columnID] = col.getValue;
    return acc;
  },
  {} as Record<ColumnID, ValueGetter>,
);

export default function FinalizedMatchesDataGrid({
  finalizedMatches,
  size = 'md',
}: Props): React.ReactElement {
  // finalizedMatches.length > 0
  //   ? finalizedMatches
  //   : [{amount: 0, date: '-', id: '-', memo: '-', payee: '-'}];
  const [rowIsWrapped, setRowIsWrapped] = useState<Record<string, boolean>>({});

  const [sortByColumn, setSortByColumn] = useState<ColumnID | null>(null);

  const data =
    sortByColumn == null
      ? finalizedMatches
      : finalizedMatches.slice().sort((aMatch, bMatch) => {
          // TODO: Not sure if null coalescing to 0 is the best way to handle this
          const a = fieldGetterLookup[sortByColumn](aMatch) ?? 0;
          const b = fieldGetterLookup[sortByColumn](bMatch) ?? 0;

          if (a < b) {
            return -1;
          }
          if (a > b) {
            return 1;
          }
          return 0;
        });

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
                <th
                  key={c.columnID}
                  onClick={() => setSortByColumn(c.columnID)}
                  style={{...ROW_WRAP_STYLE, ...c.sx}}>
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
                  const newSelectionLength =
                    window.getSelection()?.toString().length ?? null;

                  // Don't toggle the row if we're trying to select something
                  if (newSelectionLength != null && newSelectionLength > 0) {
                    return;
                  }

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
                    {col.getNode(finalizedMatch)}
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
