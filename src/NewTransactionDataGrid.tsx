import type {GridColumnDef, ParsedData, ParsedDataRow} from './DataTypes';
import type {StandardTransactionType} from './LabelTypes';

import {getFormattedAmount} from './Currency';
import DataTable from './DataTable';

type Props = {
  size?: 'lg' | 'md' | 'sm';
  // label: string;
  transactions: StandardTransactionType[];
};

const columns: GridColumnDef[] = [
  // {columnID: 'id', headerName: 'ID'},
  {
    columnID: 'date',
    headerName: 'Date',
    sx: {width: '6em'},
    truncatable: false,
  },
  {columnID: 'payee', headerName: 'Payee', sx: {width: '5em'}},
  {columnID: 'memo', headerName: 'Memo', sx: {width: '40%'}, truncatable: true},
  {
    columnID: 'amount',
    getNode: (row: ParsedDataRow) =>
      getFormattedAmount(row['amount'] as number),
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

  return (
    <DataTable
      columnDef={columns}
      data={
        // @ts-ignore Not sure how to handle this yet
        data as ParsedData
      }
      size={size}
    />
  );
}
