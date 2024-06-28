import type {LabelTransactionMatch} from './Matching';

import {Typography} from '@mui/joy';
import Box from '@mui/joy/Box';
import Grid from '@mui/joy/Grid';
import List from '@mui/joy/List';

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
      <Typography level="h3">{label}</Typography>
      {matches.map((match) => (
        <Grid
          container
          key={match.label.id}
          sx={{borderBottom: '1px solid white'}}>
          <Grid xs={6}>
            <List>
              <TransactionListItems transactions={[match.label]} />
            </List>
          </Grid>

          <Grid xs={6}>
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
