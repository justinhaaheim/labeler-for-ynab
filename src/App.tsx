import type {StandardTransactionType} from './LabelTypes';
import type {UpdateLog} from './Sync';
import type {Account, BudgetSummary, TransactionDetail} from 'ynab';

import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import Checkbox from '@mui/joy/Checkbox';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import Grid from '@mui/joy/Grid';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
// import ListItemButton from '@mui/joy/ListItemButton';
import Option from '@mui/joy/Option';
import Select from '@mui/joy/Select';
// import Button from '@mui/joy/Button';
import Sheet from '@mui/joy/Sheet';
import Stack from '@mui/joy/Stack';
import Typography from '@mui/joy/Typography';
import {useCallback, useEffect, useMemo, useState} from 'react';
import * as ynab from 'ynab';

import packageJson from '../package.json';
// accounts for budgetID 21351b66-d7c6-4e53-895b-b8cd753c2347
import accountsCachedJson from './accountsCached.local.json';
import amazonLabels2024Local from './amazonLabels2024.local';
import budgetsCachedJson from './budgetsCached.local.json';
import ColorSchemeToggle from './ColorSchemeToggle';
import {
  convertYnabCsvToStandardTransaction,
  convertYnabToStandardTransaction,
} from './Converters';
import getDateTimeString from './getDateTimeString';
import {getParsedLabels} from './getParsedLabels';
import initiateUserJSONDownload from './initiateUserJSONDownlaod';
import InputFileUpload from './InputFileUpload';
import LabelTransactionMatchTable from './LabelTransactionMatchTable';
import MatchCandidateTable from './MatchCandidateTable';
import {
  getMatchCandidatesForAllLabels,
  resolveBestMatchForLabels,
} from './Matching';
import {syncLabelsToYnab, undoSyncLabelsToYnab} from './Sync';
import TransactionDataGrid from './TransactionDataGrid';

const budgetIDForCachedAccounts = '21351b66-d7c6-4e53-895b-b8cd753c2347';

const USE_CACHED_RESPONSES = true; // true;
const CACHED_RESPONSE_ARTIFICIAL_DELAY_MS = 500;

const UNDERSCORE_STRING = '__';

const YNAB_ACCESS_TOKEN = import.meta.env.VITE_YNAB_ACCESS_TOKEN;

const ynabAPI = new ynab.API(YNAB_ACCESS_TOKEN);

type LabelSyncFilterConfig = {
  omitAlreadyCategorized: boolean;
  omitNonemptyMemo: boolean;
  omitReconciled: boolean;
};

// @ts-ignore - remove later
window.ynabAPI = ynabAPI;

function App() {
  const [budgets, setBudgets] = useState<BudgetSummary[] | null>(null);
  const [selectedBudgetID, setSelectedBudgetID] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [selectedAccountID, setSelectedAccountID] = useState<string | null>(
    null,
  );

  const [transactions, setTransactions] = useState<TransactionDetail[] | null>(
    null,
  );

  const [labels, setLabels] = useState<StandardTransactionType[] | null>(() =>
    USE_CACHED_RESPONSES
      ? convertYnabCsvToStandardTransaction(
          getParsedLabels(amazonLabels2024Local),
        )
      : null,
  );

  const [labelSyncFilterConfig, setLabelSyncFilterConfig] =
    useState<LabelSyncFilterConfig>({
      omitAlreadyCategorized: true,
      omitNonemptyMemo: false,
      omitReconciled: true,
    });

  const [updateLogs, setUpdateLogs] = useState<UpdateLog[] | null>(null);

  const [undoUpdateLogs, setUndoUpdateLogs] = useState<UpdateLog[] | null>(
    null,
  );

  const [showAllLabelsAndTransactions, setShowAllLabelsAndTransactions] =
    useState<boolean>(false);

  const matchCandidates = useMemo(
    () =>
      labels == null || transactions == null
        ? null
        : getMatchCandidatesForAllLabels(labels, transactions),
    [labels, transactions],
  );

  const finalizedMatches = useMemo(
    () =>
      matchCandidates != null ? resolveBestMatchForLabels(matchCandidates) : [],
    [matchCandidates],
  );

  const finalizedMatchesFiltered = useMemo(
    () =>
      finalizedMatches.filter((match) => {
        if (match.transactionMatch == null) {
          return false;
        }

        // Filter this transaction out if we're NOT supposed to apply
        // to transactions with a nonempty memo, AND the memo is not empty
        if (
          labelSyncFilterConfig.omitNonemptyMemo &&
          (match.transactionMatch.memo ?? '').trim().length > 0
        ) {
          return false;
        }

        if (
          labelSyncFilterConfig.omitAlreadyCategorized &&
          match.transactionMatch.category_id != null
        ) {
          return false;
        }

        if (
          labelSyncFilterConfig.omitReconciled &&
          match.transactionMatch.cleared === 'reconciled'
        ) {
          return false;
        }

        return true;
      }),
    [
      finalizedMatches,
      labelSyncFilterConfig.omitAlreadyCategorized,
      labelSyncFilterConfig.omitNonemptyMemo,
      labelSyncFilterConfig.omitReconciled,
    ],
  );

  const successfulMatchesCount = finalizedMatches.filter(
    (match) => match.transactionMatch != null,
  ).length;

  const successfulMatchesThatPassFiltersCount = finalizedMatchesFiltered.length;

  const successfulSyncsCount: number | null =
    updateLogs?.filter((log) => log.updateSucceeded).length ?? null;

  const successfulUndosCount: number | null =
    undoUpdateLogs?.filter((log) => log.updateSucceeded).length ?? null;

  useEffect(() => {
    if (budgets == null) {
      const budgetSortFn = (b1: BudgetSummary, b2: BudgetSummary) => {
        // Use the unary to convert date to number https://github.com/microsoft/TypeScript/issues/5710#issuecomment-157886246
        const d1 =
          b1.last_modified_on != null
            ? +new Date(b1.last_modified_on)
            : Number.NEGATIVE_INFINITY;
        const d2 =
          b2.last_modified_on != null
            ? +new Date(b2.last_modified_on)
            : Number.NEGATIVE_INFINITY;
        // We want dates in descending order
        return d2 - d1;
      };
      if (!USE_CACHED_RESPONSES) {
        (async function () {
          console.debug('📡 Fetching budgets data...');
          const budgetsResponse = await ynabAPI.budgets.getBudgets();
          setBudgets(budgetsResponse.data.budgets.sort(budgetSortFn));
        })();
      } else {
        console.debug('Using cached budgets data');
        setTimeout(() => {
          setBudgets(budgetsCachedJson.sort(budgetSortFn));
        }, CACHED_RESPONSE_ARTIFICIAL_DELAY_MS);
      }
    }
  }, [budgets]);

  useEffect(() => {
    if (selectedBudgetID != null && accounts == null) {
      if (
        USE_CACHED_RESPONSES &&
        selectedBudgetID === budgetIDForCachedAccounts
      ) {
        console.debug('Using cached accounts data');
        setTimeout(() => {
          setAccounts(accountsCachedJson as Account[]);
        }, CACHED_RESPONSE_ARTIFICIAL_DELAY_MS);
      } else {
        (async function () {
          console.debug('📡 Fetching accounts data...');
          const accountsResponse =
            await ynabAPI.accounts.getAccounts(selectedBudgetID);
          setAccounts(accountsResponse.data.accounts);
        })();
      }
    }
  }, [accounts, selectedBudgetID]);

  useEffect(() => {
    if (
      selectedBudgetID != null &&
      selectedAccountID != null &&
      transactions == null
    ) {
      (async function () {
        console.debug('📡 Fetching transactions data...');
        const transactionsResponse =
          await ynabAPI.transactions.getTransactionsByAccount(
            selectedBudgetID,
            selectedAccountID,
          );
        const transactions = transactionsResponse.data.transactions;
        console.debug(`${transactions.length} transactions fetched`);
        console.debug('transactions:', transactions);
        setTransactions(transactions);
        // @ts-ignore - remove later
        window.transactions = transactions;
      })();
    }
  }, [selectedAccountID, selectedBudgetID, transactions]);

  /////////////////////////////////////////////////
  // Functions
  /////////////////////////////////////////////////

  const onFileText = useCallback((text: string) => {
    setLabels(convertYnabCsvToStandardTransaction(getParsedLabels(text)));
  }, []);

  return (
    <>
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '100dvh',
          position: 'relative',
        }}>
        <Sheet
          sx={{
            margin: {sm: 3, xs: 2},
            paddingX: {sm: 5, xs: 2},
            paddingY: {sm: 8, xs: 6},
          }}
          variant="plain">
          <Stack alignItems="center" spacing={{sm: 3, xs: 7}}>
            <Box
            // sx={{alignItems: 'flex-end', display: 'flex', width: '100%'}}
            >
              <ColorSchemeToggle />
            </Box>

            <Box>
              <Typography level="h1" sx={{marginBottom: 2}}>
                YNAB Labeler
              </Typography>
            </Box>

            <Card
              color="primary"
              invertedColors={true}
              size="lg"
              sx={{width: 'fit-content'}}
              variant="solid">
              <CardContent>
                <Typography level="title-lg" sx={{marginBottom: 2}}>
                  Status
                </Typography>

                <Box sx={{mb: 2, textAlign: 'left'}}>
                  <Typography>{`${
                    transactions?.length ?? UNDERSCORE_STRING
                  } YNAB transactions fetched`}</Typography>

                  <Typography>{`${
                    labels?.length ?? UNDERSCORE_STRING
                  } labels loaded`}</Typography>

                  <Typography>{`${
                    matchCandidates == null
                      ? UNDERSCORE_STRING
                      : successfulMatchesCount
                  }/${
                    labels?.length ?? UNDERSCORE_STRING
                  } labels matched to a YNAB transaction`}</Typography>

                  <Typography>{`${
                    matchCandidates == null || labels == null
                      ? UNDERSCORE_STRING
                      : labels.length - successfulMatchesCount
                  } labels had no match`}</Typography>
                </Box>

                <Box sx={{mb: 2, textAlign: 'left'}}>
                  <Typography>{`${
                    matchCandidates == null
                      ? UNDERSCORE_STRING
                      : successfulMatchesThatPassFiltersCount
                  }/${
                    matchCandidates == null
                      ? UNDERSCORE_STRING
                      : successfulMatchesCount
                  } labels will be synced based on filter criteria`}</Typography>
                </Box>

                <Box sx={{textAlign: 'left'}}>
                  <Typography>{`${successfulSyncsCount ?? UNDERSCORE_STRING}/${
                    updateLogs?.length ?? UNDERSCORE_STRING
                  } YNAB transaction updates successful`}</Typography>

                  <Typography>{`${successfulUndosCount ?? UNDERSCORE_STRING}/${
                    undoUpdateLogs?.length ?? UNDERSCORE_STRING
                  } YNAB undo updates successful`}</Typography>
                </Box>
              </CardContent>
            </Card>

            <Box>
              <InputFileUpload onFileText={onFileText} />
            </Box>

            <Box sx={{minWidth: 240}}>
              <FormControl>
                <FormLabel id="budget-selector-label-id">
                  Select your budget
                </FormLabel>
                <Select
                  id="budget-selector"
                  onChange={(
                    event: React.SyntheticEvent | null,
                    newValue: string | null,
                  ) => {
                    console.log(event);
                    const newBudgetID = newValue;
                    if (selectedBudgetID !== newBudgetID) {
                      console.debug(
                        'New budgetID selected. Clearing accounts and transactions',
                      );
                      setSelectedAccountID(null);
                      setAccounts(null);
                      setTransactions(null);
                      setSelectedBudgetID(newBudgetID);
                    }
                  }}
                  placeholder="Select budget..."
                  value={selectedBudgetID}>
                  {
                    // TODO: better handling when empty array is returned
                    budgets == null || budgets.length === 0 ? (
                      <Option key="loading" value="">
                        {'Loading budgets...'}
                      </Option>
                    ) : (
                      budgets?.map((budget) => (
                        <Option key={budget.id} value={budget.id}>
                          {budget.name}
                        </Option>
                      ))
                    )
                  }
                </Select>
              </FormControl>
            </Box>

            <Box sx={{minWidth: 240}}>
              <FormControl disabled={selectedBudgetID == null}>
                <FormLabel id="account-selector-label-id">
                  Select your account
                </FormLabel>
                <Select
                  onChange={(
                    event: React.SyntheticEvent | null,
                    newValue: string | null,
                  ) => {
                    console.log(event);
                    const newAccountID = newValue;
                    if (selectedAccountID !== newAccountID) {
                      console.debug(
                        'New accountID selected. Clearing transactions',
                      );
                      setTransactions(null);
                      setSelectedAccountID(newAccountID);
                    }
                  }}
                  placeholder="Select account..."
                  value={selectedAccountID}>
                  {
                    // TODO: better handling when empty array is returned
                    selectedBudgetID != null && accounts == null ? (
                      <Option key="loading" value="">
                        {'Loading accounts...'}
                      </Option>
                    ) : (
                      accounts?.map((account) => (
                        <Option key={account.id} value={account.id}>
                          {account.name}
                        </Option>
                      ))
                    )
                  }
                </Select>
              </FormControl>
            </Box>

            <Box role="group">
              <Typography component="legend">
                Do not apply labels to...
              </Typography>
              <List size="sm">
                <ListItem>
                  <Checkbox
                    checked={labelSyncFilterConfig.omitNonemptyMemo}
                    label="Transactions With Pre-existing Memos"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLabelSyncFilterConfig((prev) => ({
                        ...prev,
                        omitNonemptyMemo: e.target.checked,
                      }))
                    }
                  />
                </ListItem>
                <ListItem>
                  <Checkbox
                    checked={labelSyncFilterConfig.omitAlreadyCategorized}
                    label="Transactions That Are Already Categorized"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLabelSyncFilterConfig((prev) => ({
                        ...prev,
                        omitAlreadyCategorized: e.target.checked,
                      }))
                    }
                  />
                </ListItem>
                <ListItem>
                  <Checkbox
                    checked={labelSyncFilterConfig.omitReconciled}
                    label="Reconciled Transactions"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLabelSyncFilterConfig((prev) => ({
                        ...prev,
                        omitReconciled: e.target.checked,
                      }))
                    }
                  />
                </ListItem>
              </List>
            </Box>

            <Box>
              <Button
                disabled={
                  transactions == null ||
                  transactions.length === 0 ||
                  labels == null ||
                  labels.length === 0 ||
                  successfulMatchesCount === 0
                }
                onClick={() => {
                  if (selectedBudgetID == null) {
                    console.error('[Sync labels] No budget selected');
                    return;
                  }
                  setUpdateLogs(null);
                  setUndoUpdateLogs(null);

                  syncLabelsToYnab({
                    budgetID: selectedBudgetID,
                    finalizedMatches: finalizedMatchesFiltered,
                    ynabAPI,
                  })
                    .then((updateLogs) => {
                      setUpdateLogs(updateLogs);
                    })
                    .catch((error) => {
                      console.error('syncLabelsToYnab error:', error);
                    });
                }}
                variant="solid">
                Sync labels to YNAB
              </Button>
            </Box>

            <Box>
              <Button
                disabled={
                  updateLogs == null ||
                  updateLogs.length === 0 ||
                  undoUpdateLogs != null
                }
                onClick={() => {
                  if (selectedBudgetID == null) {
                    console.error('[Undo Sync labels] No budget selected');
                    return;
                  }
                  if (updateLogs == null) {
                    console.error(
                      '[Undo Sync labels] No update logs available',
                    );
                    return;
                  }

                  undoSyncLabelsToYnab({
                    budgetID: selectedBudgetID,
                    updateLogs,
                    ynabAPI,
                  })
                    .then((undoUpdateLogs) => {
                      setUndoUpdateLogs(undoUpdateLogs);
                    })
                    .catch((error) => {
                      console.error('undoSyncLabelsToYnab error:', error);
                    });
                }}
                variant="solid">
                UNDO Sync
              </Button>
            </Box>

            <Box>
              <Button
                // disabled={updateLogs == null}
                onClick={() =>
                  initiateUserJSONDownload(
                    getDateTimeString() + '__YNAB-Labeler-update-logs.json',
                    {testKey: 'testValue'},
                  )
                }>
                Download update logs
              </Button>
            </Box>

            <Box>
              <Checkbox
                checked={showAllLabelsAndTransactions}
                label="Show all labels, transactions and matches"
                onChange={({
                  target: {checked},
                }: React.ChangeEvent<HTMLInputElement>) =>
                  setShowAllLabelsAndTransactions(checked)
                }
              />
            </Box>

            {showAllLabelsAndTransactions && (
              <>
                <Grid container spacing={2}>
                  <Grid xs={12}>
                    <Typography level="h3" sx={{mb: 2}}>
                      Labels With No Match
                    </Typography>

                    <TransactionDataGrid
                      transactions={finalizedMatches
                        .filter((m) => m.transactionMatch == null)
                        .map((m) => m.label)}
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid xs={6}>
                    <Typography level="h3" sx={{mb: 2}}>
                      Transactions
                    </Typography>

                    <Typography>{`${
                      transactions?.length ?? 0
                    } transactions fetched`}</Typography>

                    {transactions != null && (
                      <TransactionDataGrid
                        size="sm"
                        transactions={convertYnabToStandardTransaction(
                          transactions,
                        )}
                      />
                    )}
                  </Grid>

                  <Grid xs={6}>
                    <Typography level="h3" sx={{mb: 2}}>
                      Labels
                    </Typography>

                    <Typography>{`${
                      labels?.length ?? 0
                    } labels loaded`}</Typography>

                    {labels != null && (
                      <TransactionDataGrid size="sm" transactions={labels} />
                    )}
                  </Grid>
                </Grid>
                {matchCandidates != null &&
                  (matchCandidates.length === 0 ? (
                    <Typography>No matches found</Typography>
                  ) : (
                    <MatchCandidateTable
                      label="Match Candidates"
                      matchCandidates={matchCandidates}
                    />
                  ))}
                {matchCandidates != null &&
                  (matchCandidates.length === 0 ? (
                    <Typography>No matches found</Typography>
                  ) : (
                    <LabelTransactionMatchTable
                      label="Finalized Matches"
                      matches={finalizedMatches}
                    />
                  ))}
              </>
            )}
          </Stack>
        </Sheet>
      </Box>

      <Typography
        component="div"
        sx={{
          bottom: '2px',
          fontSize: 12,
          left: '50%',
          opacity: 0.1,
          position: 'absolute',
          transform: 'translateX(-50%)',
        }}>
        {`v${packageJson.version}`}
      </Typography>
    </>
  );
}

export default App;
