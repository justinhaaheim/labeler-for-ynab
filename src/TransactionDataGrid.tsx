import type {StandardTransactionType} from './LabelTypes';
// import type {LabelTransactionMatch} from './Matching';
// import {Typography} from '@mui/material';
// import Box from '@mui/material/Box';
// import Grid from '@mui/material/Grid';
// import List from '@mui/material/List';
import type {GridColDef} from '@mui/x-data-grid';

import {DataGrid} from '@mui/x-data-grid';

// import {convertYnabToStandardTransaction} from './Converters';
// import TransactionListItems from './TransactionListItems';

type Props = {
  // label: string;
  transactions: StandardTransactionType[];
};

// const columnLabels = ['date', 'payee', 'memo', 'amount', 'id'];

const columns: GridColDef<StandardTransactionType[][number]>[] = [
  {field: 'date', headerName: 'Date', width: 150},
  {field: 'payee', headerName: 'Payee', width: 150},
  {field: 'memo', headerName: 'Memo', width: 150},
  {field: 'amount', headerName: 'Amount', width: 150},
  {field: 'id', headerName: 'ID', width: 150},
];

export default function TransactionDataGrid({
  transactions,
}: Props): React.ReactElement {
  return <DataGrid columns={columns} rows={transactions} />;
}
