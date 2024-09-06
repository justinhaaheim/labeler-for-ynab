import type {
  ColumnID,
  FieldGetterLookup,
  GridColumnDef,
  ParsedData,
  ParsedDataRow,
  ValueGetter,
} from './DataTypes';

import LinearProgress from '@mui/joy/LinearProgress';
import Sheet from '@mui/joy/Sheet';
import Table from '@mui/joy/Table';
import {useState} from 'react';

type Props = {
  columnDef: Readonly<Array<GridColumnDef>>;
  // label: string;
  data: ParsedData;
  isRefetching?: boolean;
  placeholder?: React.ReactNode;
  rerenderKey?: number | string;
  shouldDim?: (
    row: ParsedDataRow,
    fieldGetterLookup: FieldGetterLookup,
  ) => boolean;
  size?: 'lg' | 'md' | 'sm';
};

const ROW_NO_WRAP_STYLE = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const ROW_WRAP_STYLE = {whiteSpace: 'pre-wrap'};

const HEADER_STYLE = {
  cursor: 'pointer',
};

const DIM_OPACITY = 0.6;

export default function DataTable({
  data,
  columnDef,
  size = 'md',
  isRefetching,
  rerenderKey: _rerenderKey,
  shouldDim,
  placeholder,
}: Props): React.ReactElement {
  // TODO: memoize
  const fieldGetterLookup = columnDef.reduce<FieldGetterLookup>(
    (acc, col) => {
      acc[col.columnID] = col.getValue ?? ((row) => row[col.columnID]);
      return acc;
    },
    {} as Record<ColumnID, ValueGetter>,
  );

  const [rowIsWrapped, setRowIsWrapped] = useState<Record<string, boolean>>({});

  // TODO: Keep track of the list of columns clicked in order so that we can sort by multiple columns in order
  const [sortByColumn, setSortByColumn] = useState<{
    ascending: boolean;
    columnID: ColumnID;
  } | null>(null);

  const dataSorted =
    sortByColumn == null
      ? data
      : data.slice().sort((aMatch, bMatch) => {
          // TODO: Not sure if null coalescing to 0 is the best way to handle this
          const a = fieldGetterLookup[sortByColumn.columnID]?.(aMatch) ?? 0;
          const b = fieldGetterLookup[sortByColumn.columnID]?.(bMatch) ?? 0;

          const orderMultiplier = sortByColumn.ascending ? 1 : -1;

          if (a < b) {
            return orderMultiplier * -1;
          }
          if (a > b) {
            return orderMultiplier * 1;
          }
          return 0;
        });

  return (
    <Sheet
      sx={{
        borderRadius: 'sm',
        flexShrink: 1,
        overflow: 'hidden',
        position: 'relative',
        width: 'fit-content',
      }}
      variant="outlined">
      {isRefetching && (
        <LinearProgress
          color="primary"
          size="sm"
          sx={{
            borderRadius: 0,
            // display: 'block',
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 11,
          }}
          value={40}
          variant="soft"
        />
      )}
      <Table
        hoverRow
        size={size}
        stickyHeader
        stripe="odd"
        sx={{
          '--Table-headerUnderlineThickness': '1px',
          '--TableCell-cornerRadius': 0,

          '--TableCell-headBackground': 'var(--joy-palette-background-level1)',
          '--TableCell-paddingX': '8px',
          '--TableCell-paddingY': '4px',

          // '--TableCell-headBackground': 'var(--joy-palette-background-level1)',
          // '--Table-headerUnderlineThickness': '1px',
          // '--TableRow-hoverBackground': 'var(--joy-palette-background-level1)',
          '--TableRow-hoverBackground': 'var(--joy-palette-background-level1)',

          // fontSize: {md: '1rem', xs: '0.75rem'},
          overflowWrap: 'break-word',

          textAlign: 'start',

          // Ensure that multiple spaces in a row are actually rendered in HTML
          whiteSpace: 'pre-wrap',

          // minWidth: '600px',
          // width: 'auto',
          // zIndex: 0,
        }}>
        {/* <caption>
          {
            'This table shows the labels you provided (left) and the matching YNAB transaction (abbreviated TXN; right)'
          }
        </caption> */}

        <thead>
          <tr>
            {columnDef.map((c) => {
              return (
                <th
                  key={c.columnID}
                  onClick={() =>
                    setSortByColumn((prev) => ({
                      ascending:
                        prev?.columnID === c.columnID ? !prev.ascending : true,
                      columnID: c.columnID,
                    }))
                  }
                  role="button"
                  style={{...HEADER_STYLE, ...ROW_WRAP_STYLE, ...c.sx}}>
                  {c.headerName}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {dataSorted.map((row, _rowIndex) => {
            // TODO: Use a unique ID for the key
            const rowID = _rowIndex.toString();
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
                }}
                style={{
                  opacity: shouldDim?.(row, fieldGetterLookup)
                    ? DIM_OPACITY
                    : 1,
                }}>
                {columnDef.map((col, _colIndex) => (
                  <td
                    key={col.headerName}
                    style={{
                      ...(rowShouldWrap || !(col.truncatable ?? true)
                        ? ROW_WRAP_STYLE
                        : ROW_NO_WRAP_STYLE),
                      ...(col.sx ?? {}),
                    }}>
                    {/* {colIndex === 0 ? String(rowIndex + 1) + ' ' : null} */}
                    {col.getNode != null
                      ? col.getNode(row)
                      : fieldGetterLookup[col.columnID]?.(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </Table>
      {placeholder}
    </Sheet>
  );
}
