import type {StandardTransactionTypeWithLabelElements} from './LabelTypes';

import {Typography} from '@mui/joy';
import Divider from '@mui/joy/Divider';
import ListItem from '@mui/joy/ListItem';
import ListItemContent from '@mui/joy/ListItemContent';
import React from 'react';

import {getFormattedAmount} from './Currency';
import {renderLabel} from './LabelElements';

type Props = {
  transactions: StandardTransactionTypeWithLabelElements[];
};

export default function TransactionListItems({
  transactions,
}: Props): React.ReactElement | React.ReactElement[] {
  if (transactions.length === 0) {
    return (
      <ListItem key="single-item">
        <ListItemContent>No transactions found</ListItemContent>
      </ListItem>
    );
  }

  return transactions.map((t, i) => (
    <React.Fragment key={t.id}>
      <ListItem endAction={getFormattedAmount(t.amount)}>
        <ListItemContent>
          <Typography level="title-sm">{`[${t.date}] ${t.payee}`}</Typography>
          <Typography level="body-sm">
            {renderLabel(t.memo, Infinity)}
          </Typography>
        </ListItemContent>
      </ListItem>
      {i !== transactions.length - 1 && <Divider />}
    </React.Fragment>
  ));
}
