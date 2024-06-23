import type {SelectChangeEvent} from '@mui/material/Select';
import type {Account, BudgetSummary} from 'ynab';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
// import List from '@mui/material/List';
// import ListItem from '@mui/material/ListItem';
// import ListItemButton from '@mui/material/ListItemButton';
// import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
// import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {useEffect, useState} from 'react';
import * as ynab from 'ynab';

import packageJson from '../package.json';
// accounts for budgetID 21351b66-d7c6-4e53-895b-b8cd753c2347
import accountsCachedJson from './accountsCached.local.json';
import budgetsCachedJson from './budgetsCached.local.json';

const budgetIDForCachedAccounts = '21351b66-d7c6-4e53-895b-b8cd753c2347';

const USE_CACHED_RESPONSES = true;
const CACHED_RESPONSE_ARTIFICIAL_DELAY_MS = 500;

const YNAB_ACCESS_TOKEN = import.meta.env.VITE_YNAB_ACCESS_TOKEN;

const ynabAPI = new ynab.API(YNAB_ACCESS_TOKEN);

function App() {
  const [budgets, setBudgets] = useState<BudgetSummary[] | null>(null);
  const [selectedBudgetID, setSelectedBudgetID] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [selectedAccountID, setSelectedAccountID] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (budgets == null) {
      if (!USE_CACHED_RESPONSES) {
        (async function () {
          console.debug('📡 Fetching budgets data...');
          const budgetsResponse = await ynabAPI.budgets.getBudgets();
          setBudgets(budgetsResponse.data.budgets);
        })();
      } else {
        console.debug('Using cached budgets data');
        setTimeout(() => {
          setBudgets(budgetsCachedJson);
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
        <Paper
          elevation={10}
          sx={{
            margin: {sm: 3, xs: 2},
            paddingX: {sm: 3, xs: 1},
            paddingY: {sm: 8, xs: 6},
          }}>
          <Stack spacing={{sm: 10, xs: 7}}>
            <Box>
              <Typography variant="h1">YNAB Labeler</Typography>
            </Box>

            <Box sx={{minWidth: 120}}>
              <FormControl fullWidth>
                <InputLabel id="budget-selector-label-id">
                  Select your budget
                </InputLabel>
                <Select
                  id="budget-selector"
                  label="Select your budget"
                  labelId="budget-selector-label-id"
                  onChange={(event: SelectChangeEvent) => {
                    console.log(event);
                    setSelectedBudgetID(event.target.value as string);
                  }}
                  value={selectedBudgetID ?? ''}>
                  {
                    // TODO: better handling when empty array is returned
                    budgets == null || budgets.length === 0 ? (
                      <MenuItem key="loading">{'Loading budgets...'}</MenuItem>
                    ) : (
                      budgets?.map((budget) => (
                        <MenuItem key={budget.id} value={budget.id}>
                          {budget.name}
                        </MenuItem>
                      ))
                    )
                  }
                </Select>
              </FormControl>
            </Box>

            {selectedBudgetID != null && (
              <Box sx={{minWidth: 120}}>
                <FormControl fullWidth>
                  <InputLabel id="account-selector-label-id">
                    Select your account
                  </InputLabel>
                  <Select
                    id="account-selector"
                    label="Select your account"
                    labelId="account-selector-label-id"
                    onChange={(event: SelectChangeEvent) => {
                      console.log(event);
                      setSelectedAccountID(event.target.value as string);
                    }}
                    value={selectedAccountID ?? ''}>
                    {
                      // TODO: better handling when empty array is returned
                      accounts == null || accounts.length === 0 ? (
                        <MenuItem key="loading">
                          {'Loading accounts...'}
                        </MenuItem>
                      ) : (
                        accounts?.map((account) => (
                          <MenuItem key={account.id} value={account.id}>
                            {account.name}
                          </MenuItem>
                        ))
                      )
                    }
                  </Select>
                </FormControl>
              </Box>
            )}
          </Stack>
        </Paper>
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
