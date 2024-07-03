import type {ParsedLabelsTyped} from './LabelParser';
import type {StandardTransactionType} from './LabelTypes';
import type {UpdateLogChunk} from './Sync';

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
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as ynab from 'ynab';

import packageJson from '../package.json';
// accounts for budgetID 21351b66-d7c6-4e53-895b-b8cd753c2347
import accountsCachedJson from './accountsCached.local.json';
import amazonLabels2024Local from './amazonLabels2024.local';
import budgetsCachedJson from './budgetsCached.local.json';
import ColorSchemeToggle from './ColorSchemeToggle';
import config from './config.json';
import {
  convertParsedLabelsToStandardTransaction,
  convertYnabToStandardTransaction,
  getLabelsFromCsv,
} from './Converters';
import {getDateTimeString} from './DateUtils';
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

const USE_CACHED_RESPONSES = false; // true;
const CACHED_RESPONSE_ARTIFICIAL_DELAY_MS = 500;

const UNDERSCORE_STRING = '__';
const LABEL_PREFIX_SEPARATOR = ' ';

const YNAB_TOKEN_LOCAL_STORAGE_KEY = 'ynab_access_token';
const YNAB_ACCESS_TOKEN_URL_HASH_KEY = 'access_token';

// const YNAB_ACCESS_TOKEN = import.meta.env.VITE_YNAB_ACCESS_TOKEN;

// const ynabAPI = new ynab.API(YNAB_ACCESS_TOKEN);

type LabelSyncFilterConfig = {
  omitAlreadyCategorized: boolean;
  omitNonemptyMemo: boolean;
  omitReconciled: boolean;
};

// // @ts-ignore - remove later
// window.ynabAPI = ynabAPI;

function App() {
  const [_ynabToken, setYnabToken] = useState<string | null>(null);
  const [ynabApi, setYnabApi] = useState<ynab.API | null>(null);

  const [budgets, setBudgets] = useState<ynab.BudgetSummary[] | null>(null);
  const [selectedBudgetID, setSelectedBudgetID] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<ynab.Account[] | null>(null);
  const [selectedAccountID, setSelectedAccountID] = useState<string | null>(
    null,
  );

  const [transactions, setTransactions] = useState<
    ynab.TransactionDetail[] | null
  >(null);

  const [labelData, setLabelData] = useState<ParsedLabelsTyped | null>(null);
  const labelsWithoutPrefix = useMemo<StandardTransactionType[] | null>(() => {
    if (USE_CACHED_RESPONSES) {
      return getLabelsFromCsv(amazonLabels2024Local);
    }
    if (labelData != null) {
      // Take the raw data that was parsed and determine the best label from it
      return convertParsedLabelsToStandardTransaction(labelData);
    }
    return null;
  }, [labelData]);

  const [labelSyncFilterConfig, setLabelSyncFilterConfig] =
    useState<LabelSyncFilterConfig>({
      omitAlreadyCategorized: true,
      omitNonemptyMemo: false,
      omitReconciled: true,
    });

  const [labelPrefixNotDeferred, setLabelPrefixNotDeferred] =
    useState<string>('');
  const labelPrefix = useDeferredValue(labelPrefixNotDeferred);

  const [updateLogs, setUpdateLogs] = useState<UpdateLogChunk | null>(null);

  const [undoUpdateLogs, setUndoUpdateLogs] = useState<UpdateLogChunk | null>(
    null,
  );

  const [showAllLabelsAndTransactions, setShowAllLabelsAndTransactions] =
    useState<boolean>(false);

  const labels: StandardTransactionType[] | null = useMemo(
    () =>
      labelsWithoutPrefix?.map((label) => ({
        ...label,
        memo:
          labelPrefix.trim().length > 0
            ? labelPrefix + LABEL_PREFIX_SEPARATOR + label.memo
            : label.memo,
      })) ?? null,
    [labelPrefix, labelsWithoutPrefix],
  );

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
    updateLogs?.logs.filter((log) => log.updateSucceeded).length ?? null;

  const successfulUndosCount: number | null =
    undoUpdateLogs?.logs.filter((log) => log.updateSucceeded).length ?? null;

  /////////////////////////////////////////////////
  // Effects
  /////////////////////////////////////////////////

  useEffect(() => {
    // Check for the YNAB token provided when we're redirected back from the YNAB OAuth page
    let token = null;

    // NOTE: window.location.hash includes the "#"
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    console.debug('parsing url hash:', {
      hashOriginalString: window.location.hash,
      hashParams: Array.from(hashParams.entries()),
    });

    // NOTE: .get returns null if there's no item
    const hashToken = hashParams.get(YNAB_ACCESS_TOKEN_URL_HASH_KEY);

    if (hashToken != null && hashToken.length > 0) {
      token = hashToken;
      console.debug('Token from URL:', token);

      // TODO: store when it expires and use that to warn the client when calls to the API will start failing; prompt to reauthorize
      sessionStorage.setItem(YNAB_TOKEN_LOCAL_STORAGE_KEY, token);

      // Remove the token from the url
      window.location.hash = '';
    } else {
      // Otherwise try sessionStorage
      token = sessionStorage.getItem(YNAB_TOKEN_LOCAL_STORAGE_KEY);
      console.debug('Token from session storage:', token);
    }

    if (token != null && token.length > 0) {
      setYnabToken(token);
      setYnabApi(new ynab.API(token));
    }
  }, []);

  useEffect(() => {
    if (ynabApi != null && budgets == null) {
      const budgetSortFn = (b1: ynab.BudgetSummary, b2: ynab.BudgetSummary) => {
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
          const budgetsResponse = await ynabApi.budgets.getBudgets();
          console.debug('📡 Budget data received', budgetsResponse);
          setBudgets(budgetsResponse.data.budgets.sort(budgetSortFn));
        })();
      } else {
        console.debug('Using cached budgets data');
        setTimeout(() => {
          setBudgets(budgetsCachedJson.sort(budgetSortFn));
        }, CACHED_RESPONSE_ARTIFICIAL_DELAY_MS);
      }
    }
  }, [budgets, ynabApi]);

  useEffect(() => {
    if (ynabApi != null && selectedBudgetID != null && accounts == null) {
      if (
        USE_CACHED_RESPONSES &&
        selectedBudgetID === budgetIDForCachedAccounts
      ) {
        console.debug('Using cached accounts data');
        setTimeout(() => {
          setAccounts(accountsCachedJson as ynab.Account[]);
        }, CACHED_RESPONSE_ARTIFICIAL_DELAY_MS);
      } else {
        (async function () {
          console.debug('📡 Fetching accounts data...');
          const accountsResponse =
            await ynabApi.accounts.getAccounts(selectedBudgetID);
          console.debug('📡 Accounts data received', accountsResponse);
          setAccounts(accountsResponse.data.accounts);
        })();
      }
    }
  }, [accounts, selectedBudgetID, ynabApi]);

  useEffect(() => {
    if (
      ynabApi != null &&
      selectedBudgetID != null &&
      selectedAccountID != null &&
      transactions == null
    ) {
      (async function () {
        console.debug('📡 Fetching transactions data...');
        const transactionsResponse =
          await ynabApi.transactions.getTransactionsByAccount(
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
  }, [selectedAccountID, selectedBudgetID, transactions, ynabApi]);

  /////////////////////////////////////////////////
  // Functions
  /////////////////////////////////////////////////

  // This builds a URI to get an access token from YNAB
  // https://api.ynab.com/#outh-applications
  const authorizeWithYNAB = useCallback<
    React.MouseEventHandler<HTMLAnchorElement>
  >((e) => {
    e.preventDefault();
    const uri = `https://app.ynab.com/oauth/authorize?client_id=${config.clientId}&redirect_uri=${config.redirectUri}&response_type=token`;
    window.location.replace(uri);
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
                    labels?.length ?? UNDERSCORE_STRING
                  } labels loaded`}</Typography>

                  <Typography>{`${
                    transactions?.length ?? UNDERSCORE_STRING
                  } YNAB transactions fetched`}</Typography>

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
                    updateLogs?.logs.length ?? UNDERSCORE_STRING
                  } YNAB transaction updates successful`}</Typography>

                  <Typography>{`${successfulUndosCount ?? UNDERSCORE_STRING}/${
                    undoUpdateLogs?.logs.length ?? UNDERSCORE_STRING
                  } YNAB undo updates successful`}</Typography>
                </Box>
              </CardContent>
            </Card>

            <Box>
              <InputFileUpload
                labelCount={labels?.length ?? null}
                onLabelPrefixChange={setLabelPrefixNotDeferred}
                onNewLabelData={setLabelData}
              />
            </Box>

            <Box>
              <Button
                disabled={ynabApi != null}
                onClick={authorizeWithYNAB}
                variant="solid">
                Authorize with YNAB
              </Button>
            </Box>

            <Box sx={{minWidth: 240}}>
              <FormControl disabled={ynabApi == null || budgets == null}>
                <FormLabel id="budget-selector-label-id">
                  Select your budget
                </FormLabel>
                <Select
                  id="budget-selector"
                  onChange={(
                    _event: React.SyntheticEvent | null,
                    newValue: string | null,
                  ) => {
                    // console.log(event);
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
                  {budgets?.map((budget) => (
                    <Option key={budget.id} value={budget.id}>
                      {budget.name}
                    </Option>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{minWidth: 240}}>
              <FormControl
                disabled={
                  ynabApi == null ||
                  selectedBudgetID == null ||
                  accounts == null
                }>
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
                  {accounts?.map((account) => (
                    <Option key={account.id} value={account.id}>
                      {account.name}
                    </Option>
                  ))}
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
                  ynabApi == null ||
                  transactions == null ||
                  transactions.length === 0 ||
                  labels == null ||
                  labels.length === 0 ||
                  successfulMatchesCount === 0
                }
                onClick={() => {
                  if (ynabApi == null) {
                    // TODO: Show the user these errors instead of failing silently
                    console.error('[Sync labels] YNAB API not available');
                    return;
                  }
                  if (selectedBudgetID == null) {
                    console.error('[Sync labels] No budget selected');
                    return;
                  }
                  setUpdateLogs(null);
                  setUndoUpdateLogs(null);

                  syncLabelsToYnab({
                    budgetID: selectedBudgetID,
                    finalizedMatches: finalizedMatchesFiltered,
                    ynabAPI: ynabApi,
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
                  updateLogs.logs.length === 0 ||
                  undoUpdateLogs != null
                }
                onClick={() => {
                  if (ynabApi == null) {
                    // TODO: Show the user these errors instead of failing silently
                    console.error('[Undo Sync labels] YNAB API not available');
                    return;
                  }
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
                    updateLogChunk: updateLogs,
                    ynabAPI: ynabApi,
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
                disabled={updateLogs == null && undoUpdateLogs == null}
                onClick={() =>
                  initiateUserJSONDownload(
                    getDateTimeString() + '__YNAB-Labeler-update-logs.json',
                    [updateLogs, undoUpdateLogs].filter(Boolean),
                    {prettyFormat: true},
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

            {
              // TODO: paginate and/or virtualize these lists to limit the cost of rerendering
              showAllLabelsAndTransactions && (
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
              )
            }
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
