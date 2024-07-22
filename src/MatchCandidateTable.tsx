import type {MatchCandidate} from './Matching';

import {Typography} from '@mui/joy';
import Box from '@mui/joy/Box';
import Grid from '@mui/joy/Grid';
import List from '@mui/joy/List';

import {convertYnabTransactionArrayToStandardTransactionWithLabelElements} from './Converters';
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
      <Typography level="h3">{label}</Typography>
      {matchCandidates.map((matchCandidate) => (
        <Grid
          container
          key={matchCandidate.label.id}
          sx={{borderBottom: '1px solid white'}}>
          <Grid xs={6}>
            <List>
              <TransactionListItems transactions={[matchCandidate.label]} />
            </List>
          </Grid>

          <Grid xs={6}>
            <List>
              <TransactionListItems
                transactions={convertYnabTransactionArrayToStandardTransactionWithLabelElements(
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
