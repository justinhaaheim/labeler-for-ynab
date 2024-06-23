import type {MatchCandidate} from './Matching';

import {Typography} from '@mui/material';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';

import {convertYnabToStandardTransaction} from './Converters';
import TransactionListItems from './TransactionListItems';

type Props = {
  label: string;
  matchCandidates: MatchCandidate[];
};

export default function MatchCandidateTable({
  label,
  matchCandidates,
}: Props): React.ReactElement {
  return (
    <Box>
      <Typography variant="h3">{label}</Typography>
      {matchCandidates.map((matchCandidate) => (
        <Grid
          container
          key={matchCandidate.label.id}
          sx={{borderBottom: '1px solid white'}}>
          <Grid item xs={6}>
            <List>
              <TransactionListItems transactions={[matchCandidate.label]} />
            </List>
          </Grid>

          <Grid item xs={6}>
            <List>
              <TransactionListItems
                transactions={convertYnabToStandardTransaction(
                  matchCandidate.candidates,
                )}
              />
            </List>
          </Grid>
        </Grid>
      ))}
    </Box>
  );
}
