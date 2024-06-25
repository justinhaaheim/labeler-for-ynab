import type {StandardTransactionType} from './LabelTypes';

import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import React from 'react';

import getFormattedAmount from './getFormattedAmount';

type Props = {
  transactions: StandardTransactionType[];
};

export default function TransactionListItems({
  transactions,
}: Props): React.ReactElement | React.ReactElement[] {
  if (transactions.length === 0) {
    return (
      <ListItem key="single-item">
        <ListItemText>No transactions found</ListItemText>
      </ListItem>
    );
  }

  return transactions.map((t, i) => (
    <React.Fragment key={t.id}>
      <ListItem secondaryAction={getFormattedAmount(t.amount)}>
        <ListItemText primary={`[${t.date}] ${t.payee}`} secondary={t.memo} />
      </ListItem>
      {i !== transactions.length - 1 && <Divider />}
    </React.Fragment>
  ));
}
