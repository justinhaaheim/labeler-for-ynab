import type {LabelTransactionMatch} from './Matching';

import {Typography} from '@mui/material';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';

import {convertYnabToStandardTransaction} from './Converters';
import TransactionListItems from './TransactionListItems';

type Props = {
  label: string;
  matches: LabelTransactionMatch[];
};

export default function LabelTransactionMatchTable({
  label,
  matches,
}: Props): React.ReactElement {
  return (
    <Box>
      <Typography variant="h3">{label}</Typography>
      {matches.map((match) => (
        <Grid
          container
          key={match.label.id}
          sx={{borderBottom: '1px solid white'}}>
          <Grid item xs={6}>
            <List>
              <TransactionListItems transactions={[match.label]} />
            </List>
          </Grid>

          <Grid item xs={6}>
            <List>
              <TransactionListItems
                transactions={
                  match.transactionMatch == null
                    ? []
                    : convertYnabToStandardTransaction([match.transactionMatch])
                }
              />
            </List>
          </Grid>
        </Grid>
      ))}
    </Box>
  );
}
