import type {AmazonOptionsConfig} from './Converters';
import type {ParsedLabelsTyped} from './LabelParser';
import type {StandardTransactionTypeWithLabelElements} from './LabelTypes';
import type {
  LabelTransactionMatchFinalized,
  LabelTransactionMatchNonNullable,
} from './Matching';
import type {UpdateLogChunkV1} from './Sync';
import type {YNABErrorType} from './YnabHelpers';

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import Card from '@mui/joy/Card';
import CardActions from '@mui/joy/CardActions';
import CardContent from '@mui/joy/CardContent';
import CardOverflow from '@mui/joy/CardOverflow';
import Checkbox from '@mui/joy/Checkbox';
import Divider from '@mui/joy/Divider';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import Grid from '@mui/joy/Grid';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
// import ListItemButton from '@mui/joy/ListItemButton';
import Option from '@mui/joy/Option';
import Radio from '@mui/joy/Radio';
import RadioGroup from '@mui/joy/RadioGroup';
import Select from '@mui/joy/Select';
// import Button from '@mui/joy/Button';
import Sheet from '@mui/joy/Sheet';
import Snackbar from '@mui/joy/Snackbar';
import Stack from '@mui/joy/Stack';
import {useColorScheme} from '@mui/joy/styles';
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
import ColorSchemeToggle from './ColorSchemeToggle';
import config from './config.json';
import {
  convertParsedLabelsToStandardTransaction,
  convertYnabTransactionToStandardTransactionWithLabelElements,
} from './Converters';
import {getDateTimeString, getTimePrettyString} from './DateUtils';
import FinalizedMatchesDataGrid from './FinalizedMatchesDataGrid';
import initiateUserJSONDownload from './initiateUserJSONDownlaod';
import InputFileUpload from './InputFileUpload';
import {
  renderFinalizedMatches,
  renderStandardTransactionFromLabelElements,
} from './LabelElements';
import {
  getMatchCandidatesForAllLabels,
  resolveBestMatchForLabels,
} from './Matching';
import {MAXIMUM_YNAB_MEMO_LENGTH, syncLabelsToYnab} from './Sync';
import TransactionDataGrid from './TransactionDataGrid';
import UpdateLogList from './UpdateLogList';
import {
  budgetCompareFunctionForSort,
  getYNABErrorHandler,
  YNAB_TOKEN_EXPIRATION_TIMESTAMP_LOCAL_STORAGE_KEY,
  YNAB_TOKEN_LOCAL_STORAGE_KEY,
} from './YnabHelpers';

const YNAB_DEFAULT_TOKEN_EXPIRATION_TIME_SECONDS = 7200;
// Err on the side of telling the user it expires earlier than it does
const TOKEN_EXPIRATION_REDUCTION_MS = 1000 * 60;

const UNDERSCORE_STRING = '__';

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
  const {mode} = useColorScheme();

  const [_ynabToken, setYnabToken] = useState<string | null>(null);
  const [ynabTokenExpirationTimestamp, setYnabTokenExpirationTimestamp] =
    useState<number | null>(null);
  const [ynabApi, setYnabApi] = useState<ynab.API | null>(null);
  const [ynabAuthError, setYnabAuthError] = useState<YNABErrorType | null>(
    null,
  );

  const [budgets, setBudgets] = useState<ynab.BudgetSummary[] | null>(null);
  const [selectedBudgetID, setSelectedBudgetID] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<ynab.Account[] | null>(null);
  const [selectedAccountID, setSelectedAccountID] = useState<string | null>(
    null,
  );

  const [transactions, setTransactions] = useState<
    ynab.TransactionDetail[] | null
  >(null);

  const [amazonConfig, setAmazonConfig] = useState<AmazonOptionsConfig>({
    includeLinks: true,
    linkType: 'plain',
    shortenLinks: true,
  });

  const [labelData, setLabelData] = useState<ParsedLabelsTyped | null>(null);
  const labelsWithLabelElements = useMemo<
    StandardTransactionTypeWithLabelElements[] | null
  >(() => {
    if (labelData != null) {
      // Take the raw data that was parsed and determine the best label from it
      return convertParsedLabelsToStandardTransaction(labelData, {
        amazonConfig: amazonConfig,
      });
    }
    return null;
  }, [amazonConfig, labelData]);

  const [labelSyncFilterConfig, setLabelSyncFilterConfig] =
    useState<LabelSyncFilterConfig>({
      omitAlreadyCategorized: true,
      omitNonemptyMemo: false,
      omitReconciled: true,
    });

  const [labelPrefixNotDeferred, setLabelPrefixNotDeferred] =
    useState<string>('');
  const labelPrefix = useDeferredValue(labelPrefixNotDeferred);

  const [updateLogsList, setUpdateLogsList] = useState<UpdateLogChunkV1[]>([]);

  // const [updateLogs, setUpdateLogs] = useState<UpdateLogChunkV1 | null>(null);

  // const [undoUpdateLogs, setUndoUpdateLogs] = useState<UpdateLogChunkV1 | null>(
  //   null,
  // );

  const [showAllLabelsAndTransactions, setShowAllLabelsAndTransactions] =
    useState<boolean>(false);

  const matchCandidates = useMemo(
    () =>
      labelsWithLabelElements == null || transactions == null
        ? null
        : getMatchCandidatesForAllLabels(labelsWithLabelElements, transactions),
    [labelsWithLabelElements, transactions],
  );

  const finalizedMatches = useMemo(
    () =>
      matchCandidates != null ? resolveBestMatchForLabels(matchCandidates) : [],
    [matchCandidates],
  );

  const finalizedMatchesFiltered: LabelTransactionMatchFinalized[] =
    useMemo(() => {
      const matchesFiltered = finalizedMatches.filter((match) => {
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
      });

      const newFinalizedMatches = renderFinalizedMatches({
        // TODO: Write a function to assert the nonNullable type
        finalizedMatches: matchesFiltered as LabelTransactionMatchNonNullable[],
        prefix: labelPrefix,
      });

      console.debug('finalizedMatchesFiltered:', newFinalizedMatches);
      return newFinalizedMatches;
    }, [
      finalizedMatches,
      labelPrefix,
      labelSyncFilterConfig.omitAlreadyCategorized,
      labelSyncFilterConfig.omitNonemptyMemo,
      labelSyncFilterConfig.omitReconciled,
    ]);

  const successfulMatchesCount = finalizedMatches.filter(
    (match) => match.transactionMatch != null,
  ).length;

  const successfulMatchesThatPassFiltersCount = finalizedMatchesFiltered.length;

  const onAuthError = useCallback((error: YNABErrorType) => {
    setYnabAuthError(error);
    setYnabApi(null);
  }, []);

  /////////////////////////////////////////////////
  // Effects
  /////////////////////////////////////////////////

  useEffect(() => {
    // Check for the YNAB token provided when we're redirected back from the YNAB OAuth page
    let token = null;
    let tokenExpirationTimestamp = null;

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

      const expiresInSeconds =
        Number(hashParams.get('expires_in')) ??
        YNAB_DEFAULT_TOKEN_EXPIRATION_TIME_SECONDS;

      tokenExpirationTimestamp =
        Date.now() + expiresInSeconds * 1000 - TOKEN_EXPIRATION_REDUCTION_MS;

      console.debug('YNAB token from URL:', {token, tokenExpirationTimestamp});

      // TODO: store when it expires and use that to warn the client when calls to the API will start failing; prompt to reauthorize
      sessionStorage.setItem(YNAB_TOKEN_LOCAL_STORAGE_KEY, token);
      sessionStorage.setItem(
        YNAB_TOKEN_EXPIRATION_TIMESTAMP_LOCAL_STORAGE_KEY,
        tokenExpirationTimestamp.toString(),
      );

      // Remove the token from the url
      window.location.hash = '';
      // This is needed to ensure the # is also removed
      window.location.href =
        window.location.origin +
        window.location.pathname +
        window.location.search;
    } else {
      // Otherwise try sessionStorage
      token = sessionStorage.getItem(YNAB_TOKEN_LOCAL_STORAGE_KEY);
      const tokenExpirationFromStorage = sessionStorage.getItem(
        YNAB_TOKEN_EXPIRATION_TIMESTAMP_LOCAL_STORAGE_KEY,
      );
      tokenExpirationTimestamp =
        tokenExpirationFromStorage == null
          ? null
          : Number(tokenExpirationFromStorage);
      console.debug('Token from session storage:', {
        token,
        tokenExpirationTimestamp,
      });
    }

    if (token != null && token.length > 0) {
      setYnabToken(token);
      setYnabApi(new ynab.API(token));
    }

    if (tokenExpirationTimestamp != null) {
      setYnabTokenExpirationTimestamp(tokenExpirationTimestamp);
    }
  }, []);

  useEffect(() => {
    if (ynabApi != null && budgets == null) {
      (async function () {
        console.debug('📡 Fetching budgets data...');
        try {
          const budgetsResponse = await ynabApi.budgets.getBudgets();
          console.debug('📡 Budget data received', budgetsResponse);
          setBudgets(
            budgetsResponse.data.budgets.sort(budgetCompareFunctionForSort),
          );
        } catch (error: unknown) {
          const handler = getYNABErrorHandler(onAuthError);
          handler(error);
        }
      })();
    }
  }, [budgets, onAuthError, ynabApi]);

  useEffect(() => {
    if (ynabApi != null && selectedBudgetID != null && accounts == null) {
      (async function () {
        console.debug('📡 Fetching accounts data...');
        try {
          const accountsResponse =
            await ynabApi.accounts.getAccounts(selectedBudgetID);
          console.debug('📡 Accounts data received', accountsResponse);
          setAccounts(accountsResponse.data.accounts);
        } catch (error: unknown) {
          const handler = getYNABErrorHandler(onAuthError);
          handler(error);
        }
      })();
    }
  }, [accounts, onAuthError, selectedBudgetID, ynabApi]);

  useEffect(() => {
    if (
      ynabApi != null &&
      selectedBudgetID != null &&
      selectedAccountID != null &&
      transactions == null
    ) {
      (async function () {
        try {
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
        } catch (error: unknown) {
          const handler = getYNABErrorHandler(onAuthError);
          handler(error);
        }
      })();
    }
  }, [onAuthError, selectedAccountID, selectedBudgetID, transactions, ynabApi]);

  /////////////////////////////////////////////////
  // Functions
  /////////////////////////////////////////////////

  // This builds a URI to get an access token from YNAB
  // https://api.ynab.com/#outh-applications
  const authorizeWithYNAB = useCallback<
    React.MouseEventHandler<HTMLAnchorElement>
  >((e) => {
    e.preventDefault();
    const currentLocation = window.location;

    // Remove the hash from the url, including the # sign (which does not get removed if you set location.hash = '')
    const redirectUri =
      currentLocation.origin +
      currentLocation.pathname +
      currentLocation.search;
    const uri = `https://app.ynab.com/oauth/authorize?client_id=${config.clientId}&redirect_uri=${redirectUri}&response_type=token`;
    window.location.replace(uri);
    // fetch(uri, {method: 'GET', mode: 'no-cors'})
    //   .then((response) => {
    //     console.debug('response', response);
    //   })
    //   .catch((error) => {
    //     console.debug('error', error);
    //   });
  }, []);

  const cardStyle = useMemo(() => ({width: '100%'}), []);

  return (
    <>
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          // Needed?
          // justifyContent: 'center',
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
                Transaction Labeler for YNAB
              </Typography>
            </Box>

            <Grid
              container
              spacing={4}
              sx={{
                /**
                 * This means that the grid item below this will actually render on top of this,
                 * which is what we want. Status should be on the right side on wide screens, and at the
                 * top on small screens
                 */
                flexWrap: 'wrap-reverse',
              }}>
              <Grid sm={6} xs={12}>
                <Stack alignItems="start" spacing={{sm: 3, xs: 7}}>
                  <Card sx={cardStyle}>
                    <Box sx={{mb: 1}}>
                      <Typography level="title-md">
                        Step 1: Connect to YNAB
                      </Typography>
                      <Typography level="body-sm">
                        Authorize access to your YNAB account, or reconnect if
                        you've already provided the initial authorization.
                      </Typography>
                    </Box>
                    <Divider />
                    <Stack alignItems="start" spacing={2} sx={{my: 1}}>
                      <Box>
                        <Button
                          disabled={ynabApi != null}
                          onClick={authorizeWithYNAB}
                          variant="solid">
                          Authorize with YNAB
                        </Button>
                      </Box>

                      {import.meta.env.DEV && (
                        <Box>
                          <Button
                            // disabled={ynabApi != null}
                            onClick={() => {
                              if (ynabApi == null) {
                                console.warn('ynabApi is null.');
                                return;
                              }
                              ynabApi.user
                                .getUser()
                                .then((response) => {
                                  console.debug('[getUser] response', response);
                                })
                                .catch((error) => {
                                  console.debug('[getUser] error', error);
                                });
                            }}
                            variant="solid">
                            Test Connection
                          </Button>
                        </Box>
                      )}
                    </Stack>
                  </Card>

                  <Card sx={cardStyle}>
                    <Box sx={{mb: 1}}>
                      <Typography level="title-md">
                        Step 2: Select Budget & Account
                      </Typography>
                      <Typography level="body-sm">
                        Choose the budget and account to which you want to apply
                        the labels.
                      </Typography>
                    </Box>
                    <Divider />
                    <Stack alignItems="start" spacing={2} sx={{my: 1}}>
                      <Box sx={{minWidth: 240}}>
                        <FormControl
                          disabled={ynabApi == null || budgets == null}>
                          <FormLabel id="budget-selector-label-id">
                            Select your budget
                          </FormLabel>
                          <Select
                            id="budget-selector"
                            onChange={(
                              _event: React.SyntheticEvent | null,
                              newValue: string | null,
                            ) => {
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
                              _event: React.SyntheticEvent | null,
                              newValue: string | null,
                            ) => {
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
                    </Stack>
                  </Card>

                  <InputFileUpload
                    cardStyle={cardStyle}
                    labelCount={labelsWithLabelElements?.length ?? null}
                    onLabelPrefixChange={setLabelPrefixNotDeferred}
                    onNewLabelData={setLabelData}>
                    {labelData?._type === 'amazon' && (
                      <Stack alignItems="start" spacing={2} sx={{my: 1}}>
                        <Box role="group">
                          <Typography component="legend">
                            Amazon Options
                          </Typography>
                          <List size="sm">
                            <ListItem>
                              <Checkbox
                                checked={amazonConfig.includeLinks}
                                label="Include Amazon order links"
                                onChange={(
                                  e: React.ChangeEvent<HTMLInputElement>,
                                ) =>
                                  setAmazonConfig((prev) => ({
                                    ...prev,
                                    includeLinks: e.target.checked,
                                  }))
                                }
                              />
                            </ListItem>

                            {amazonConfig.includeLinks && (
                              <>
                                <ListItem sx={{ml: 4}}>
                                  <FormControl>
                                    <RadioGroup
                                      onChange={(
                                        event: React.ChangeEvent<HTMLInputElement>,
                                      ) => {
                                        setAmazonConfig((prev) => ({
                                          ...prev,
                                          linkType: event.target
                                            .value as AmazonOptionsConfig['linkType'],
                                        }));
                                      }}
                                      value={amazonConfig.linkType}>
                                      <Stack
                                        direction="row"
                                        flexWrap="wrap"
                                        spacing={2}
                                        useFlexGap>
                                        <Radio
                                          label="Plain Links"
                                          value="plain"
                                        />
                                        <Radio
                                          label="Markdown Links"
                                          value="markdown"
                                        />
                                      </Stack>
                                    </RadioGroup>
                                  </FormControl>
                                </ListItem>

                                <ListItem sx={{ml: 4, pb: 2}}>
                                  <Checkbox
                                    checked={amazonConfig.shortenLinks}
                                    label="Shorten links (experimental)"
                                    onChange={(
                                      e: React.ChangeEvent<HTMLInputElement>,
                                    ) =>
                                      setAmazonConfig((prev) => ({
                                        ...prev,
                                        shortenLinks: e.target.checked,
                                      }))
                                    }
                                  />
                                </ListItem>
                              </>
                            )}
                          </List>
                        </Box>
                      </Stack>
                    )}
                  </InputFileUpload>

                  <Card sx={cardStyle}>
                    <Box sx={{mb: 1}}>
                      <Typography level="title-md">
                        Step 4: Sync Labels to YNAB
                      </Typography>
                      <Typography level="body-sm">
                        This will update the relevant YNAB transactions with the
                        labels you provided. Download your update logs after
                        syncing to help debug any issue you may encounter, and
                        to be able to undo the sync at a later time.
                      </Typography>
                    </Box>
                    <Divider />
                    <Stack alignItems="start" spacing={2} sx={{my: 1}}>
                      <Box role="group">
                        <Typography component="legend">
                          Do not apply labels to...
                        </Typography>
                        <List size="sm">
                          <ListItem>
                            <Checkbox
                              checked={labelSyncFilterConfig.omitNonemptyMemo}
                              label="Transactions With Pre-existing Memos"
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) =>
                                setLabelSyncFilterConfig((prev) => ({
                                  ...prev,
                                  omitNonemptyMemo: e.target.checked,
                                }))
                              }
                            />
                          </ListItem>
                          <ListItem>
                            <Checkbox
                              checked={
                                labelSyncFilterConfig.omitAlreadyCategorized
                              }
                              label="Transactions That Are Already Categorized"
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) =>
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
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) =>
                                setLabelSyncFilterConfig((prev) => ({
                                  ...prev,
                                  omitReconciled: e.target.checked,
                                }))
                              }
                            />
                          </ListItem>
                        </List>
                      </Box>
                    </Stack>

                    <Divider />

                    <CardOverflow sx={{mt: '-12px'}}>
                      <CardActions sx={{alignSelf: 'flex-end', pt: 2}}>
                        <Stack spacing={2}>
                          <Stack direction="row" spacing={2}>
                            <Button
                              disabled={
                                ynabApi == null ||
                                transactions == null ||
                                transactions.length === 0 ||
                                labelsWithLabelElements == null ||
                                labelsWithLabelElements.length === 0 ||
                                successfulMatchesCount === 0 ||
                                selectedAccountID == null ||
                                selectedBudgetID == null
                              }
                              onClick={() => {
                                if (ynabApi == null) {
                                  // TODO: Show the user these errors instead of failing silently
                                  console.error(
                                    '[Sync labels] YNAB API not available',
                                  );
                                  return;
                                }
                                if (selectedBudgetID == null) {
                                  console.error(
                                    '[Sync labels] No budget selected',
                                  );
                                  return;
                                }
                                if (selectedAccountID == null) {
                                  console.error(
                                    '[Sync labels] No account selected',
                                  );
                                  return;
                                }

                                syncLabelsToYnab({
                                  accountID: selectedAccountID,
                                  budgetID: selectedBudgetID,
                                  finalizedMatches: finalizedMatchesFiltered,
                                  ynabAPI: ynabApi,
                                })
                                  .then((updateLogs) => {
                                    setUpdateLogsList((prev) => [
                                      ...prev,
                                      updateLogs,
                                    ]);
                                  })
                                  .catch((error) => {
                                    console.error(
                                      '📡❌ Error syncing labels to YNAB.',
                                      error,
                                    );
                                    getYNABErrorHandler(onAuthError)(error);
                                  });
                              }}
                              variant="solid">
                              Sync labels to YNAB
                            </Button>
                          </Stack>

                          <Button
                            disabled={updateLogsList.length === 0}
                            onClick={() =>
                              initiateUserJSONDownload(
                                getDateTimeString() +
                                  '__YNAB-Labeler-update-logs.json',
                                updateLogsList,
                                {prettyFormat: true},
                              )
                            }>
                            Download update logs
                          </Button>
                        </Stack>
                      </CardActions>
                    </CardOverflow>
                  </Card>

                  <Box></Box>

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
                </Stack>
              </Grid>

              <Grid sm={6} xs={12}>
                <Card
                  color="primary"
                  invertedColors={mode === 'dark'}
                  size="lg"
                  sx={{
                    left: '1rem',
                    position: 'sticky',
                    top: '1rem',
                    width: 'fit-content',
                  }}
                  variant={mode === 'light' ? 'soft' : 'solid'}>
                  <CardContent>
                    <Typography level="title-lg" sx={{marginBottom: 2}}>
                      Status
                    </Typography>

                    <Box sx={{mb: 2, textAlign: 'start'}}>
                      {ynabApi != null ? (
                        <Typography
                          startDecorator={
                            <CheckCircleRoundedIcon
                              color="success"
                              fontSize="large"
                            />
                          }>
                          Connected to YNAB
                        </Typography>
                      ) : (
                        <Typography
                          startDecorator={
                            <RemoveCircleOutlineRoundedIcon
                              // @ts-ignore no overload matches this call. Don't know why it's complaining about this one
                              color="danger"
                              fontSize="large"
                            />
                          }>
                          Not Connected to YNAB
                        </Typography>
                      )}
                      {ynabTokenExpirationTimestamp != null && (
                        <Typography level="body-sm">{`Authorization expires at ${getTimePrettyString(
                          new Date(ynabTokenExpirationTimestamp),
                        )}`}</Typography>
                      )}
                    </Box>

                    <Box sx={{mb: 2, textAlign: 'start'}}>
                      <Typography>{`${
                        labelsWithLabelElements?.length ?? UNDERSCORE_STRING
                      } labels loaded`}</Typography>

                      <Typography>{`${
                        transactions?.length ?? UNDERSCORE_STRING
                      } YNAB transactions fetched`}</Typography>

                      <Typography>{`${
                        matchCandidates == null
                          ? UNDERSCORE_STRING
                          : successfulMatchesCount
                      }/${
                        labelsWithLabelElements?.length ?? UNDERSCORE_STRING
                      } labels matched to a YNAB transaction`}</Typography>

                      <Typography>{`${
                        matchCandidates == null ||
                        labelsWithLabelElements == null
                          ? UNDERSCORE_STRING
                          : labelsWithLabelElements.length -
                            successfulMatchesCount
                      } labels had no match`}</Typography>
                    </Box>

                    <Box sx={{mb: 2, textAlign: 'start'}}>
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

                    {updateLogsList.length > 0 && (
                      <Box mt={2}>
                        <Typography level="title-md" sx={{mb: 1}}>
                          Updates
                        </Typography>
                        <UpdateLogList
                          onNewUpdateLogs={(newLog) =>
                            setUpdateLogsList((prev) => [...prev, newLog])
                          }
                          onYNABAuthError={onAuthError}
                          updateChunks={updateLogsList}
                          ynabApi={ynabApi}
                        />
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

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
                        // TODO NEXT: Write a converter between Label
                        transactions={finalizedMatches
                          .filter((m) => m.transactionMatch == null)
                          .map((m) =>
                            renderStandardTransactionFromLabelElements(
                              m.label,
                              Infinity,
                            ),
                          )}
                      />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2}>
                    <Grid xs={12}>
                      <Typography level="h3" sx={{mb: 1}}>
                        Finalized Matches
                      </Typography>

                      <Typography level="body-xs" sx={{mb: 3}}>
                        {
                          'This table shows the labels you provided (left) and the matching YNAB transaction (abbreviated TXN; right)'
                        }
                      </Typography>

                      <Sheet>
                        <FinalizedMatchesDataGrid
                          finalizedMatches={finalizedMatchesFiltered}
                          size="sm"
                        />
                      </Sheet>
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
                          transactions={transactions.map((t) =>
                            renderStandardTransactionFromLabelElements(
                              convertYnabTransactionToStandardTransactionWithLabelElements(
                                t,
                              ),
                            ),
                          )}
                        />
                      )}
                    </Grid>

                    <Grid xs={6}>
                      <Typography level="h3" sx={{mb: 2}}>
                        Labels
                      </Typography>

                      <Typography>{`${
                        labelsWithLabelElements?.length ?? 0
                      } labels loaded`}</Typography>

                      {labelsWithLabelElements != null && (
                        <TransactionDataGrid
                          size="sm"
                          transactions={labelsWithLabelElements.map((l) =>
                            renderStandardTransactionFromLabelElements(
                              l,
                              MAXIMUM_YNAB_MEMO_LENGTH,
                            ),
                          )}
                        />
                      )}
                    </Grid>
                  </Grid>
                </>
              )
            }
          </Stack>
        </Sheet>
      </Box>

      <Snackbar
        anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
        color="danger"
        endDecorator={
          <Button
            color="danger"
            onClick={(e) => {
              setYnabAuthError(null);
              authorizeWithYNAB(e);
            }}
            size="sm"
            variant="soft">
            Reauthorize
          </Button>
        }
        onClose={(_event, reason) => {
          if (reason === 'clickaway') {
            // Ignore clickaway
            return;
          }
          setYnabAuthError(null);
        }}
        open={ynabAuthError != null}
        sx={{maxWidth: '50%'}}
        variant="solid">
        <Box textAlign="start">
          <Typography level="title-md">
            YNAB authorization has expired. Please reauthorize.
          </Typography>
          <Typography level="body-sm" textColor="text.primary">
            Note: you will lose any work on this page when you reauthorize.
            Please download update logs before leaving the page.
          </Typography>
        </Box>
      </Snackbar>

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
