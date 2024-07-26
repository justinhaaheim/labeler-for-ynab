import type * as ynab from 'ynab';

import {getDateTimeString} from './DateUtils';
import initiateUserJSONDownload from './initiateUserJSONDownlaod';

export type FullBudgetExport = {
  accounts: ynab.Account[];
  budget: ynab.BudgetDetail;
  budgetMonths: ynab.MonthSummary[];
  categories: ynab.CategoryGroupWithCategories[];
  payeeLocations: ynab.PayeeLocation[];
  payees: ynab.Payee[];
  scheduledTransactions: ynab.ScheduledTransactionDetail[];
  transactions: ynab.TransactionDetail[];
  user: ynab.User;
};

type ExportConfig = {
  budgetID: string;
  ynabApi: ynab.API;
};

export async function downloadAllBudgetData(
  config: ExportConfig,
): Promise<void> {
  console.log('📡 Fetching all budget data...');
  const budgetData = await getAllBudgetData(config);

  if (budgetData == null) {
    console.error('Failed to get all budget data. budgetData is nullish');
    return;
  }

  const filename = `${getDateTimeString()}__YNAB-full-budget-export-${
    config.budgetID
  }.json`;
  console.log('⬇️ Initiating json download...');
  initiateUserJSONDownload(filename, budgetData, {prettyFormat: true});
}

export async function getAllBudgetData({
  ynabApi,
  budgetID,
}: ExportConfig): Promise<FullBudgetExport | null> {
  let result = null;

  try {
    console.log('Fetching user data...');
    const user = await ynabApi.user.getUser();

    console.log('Fetching budgets...');
    const budget = await ynabApi.budgets.getBudgetById(budgetID);

    console.log('Fetching accounts...');
    const accounts = await ynabApi.accounts.getAccounts(budgetID);

    console.log('Fetching categories...');
    const categories = await ynabApi.categories.getCategories(budgetID);

    console.log('Fetching payees...');
    const payees = await ynabApi.payees.getPayees(budgetID);

    console.log('Fetching payee locations...');
    const payeeLocations =
      await ynabApi.payeeLocations.getPayeeLocations(budgetID);

    console.log('Fetching budget months...');
    const budgetMonths = await ynabApi.months.getBudgetMonths(budgetID);

    console.log('Fetching transactions...');
    const transactions = await ynabApi.transactions.getTransactions(budgetID);

    console.log('Fetching scheduled transactions...');
    const scheduledTransactions =
      await ynabApi.scheduledTransactions.getScheduledTransactions(budgetID);

    /* eslint-disable sort-keys-fix/sort-keys-fix */
    result = {
      user: user.data.user,
      budget: budget.data.budget,
      accounts: accounts.data.accounts,
      categories: categories.data.category_groups,
      payees: payees.data.payees,
      payeeLocations: payeeLocations.data.payee_locations,
      budgetMonths: budgetMonths.data.months,
      transactions: transactions.data.transactions,
      scheduledTransactions: scheduledTransactions.data.scheduled_transactions,
    };
    /* eslint-disable sort-keys-fix/sort-keys-fix */
  } catch (error) {
    console.error('Error getting all budget data:', error);
    return null;
  }

  if (result == null) {
    console.error(
      'Budget data is null even though all requests succeeded. This should not happen.',
    );
  }

  return result;
}
