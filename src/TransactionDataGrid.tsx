import type {StandardTransactionType} from './LabelTypes';
// import type {LabelTransactionMatch} from './Matching';
// import {Typography} from '@mui/joy';
// import Box from '@mui/joy/Box';
// import Grid from '@mui/joy/Grid';
// import List from '@mui/joy/List';
import type {GridColDef} from '@mui/x-data-grid';

import Box from '@mui/joy/Box';
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
  return (
    <Box
      sx={{
        height: 400,
        width: 800,
      }}>
      <DataGrid
        columns={columns}
        density="compact"
        onResize={(containerSize, event, details) => {
          console.debug('[onResize]', {containerSize, details, event});
        }}
        resizeThrottleMs={1000}
        // paginationMode="server"
        // initialState={}
        // disableEval
        // disableVirtualization
        rows={transactions}
      />
    </Box>
  );
}
