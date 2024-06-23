import type {StandardTransactionType} from './LabelTypes';

import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';

import getFormattedAmount from './getFormattedAmount';

type Props = {
  transactions: StandardTransactionType[];
};

export default function TransactionListItems({transactions}: Props) {
  return (
    <>
      {transactions.map((t, i) => (
        <>
          <ListItem key={t.id} secondaryAction={getFormattedAmount(t.amount)}>
            <ListItemText
              primary={`[${t.date}] ${t.payee}`}
              secondary={t.memo}
            />
          </ListItem>
          {i !== transactions.length - 1 && <Divider />}
        </>
      ))}
    </>
  );
}
