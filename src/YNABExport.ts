import type * as ynab from 'ynab';

import {getDateTimeString} from './DateUtils';
import initiateUserJSONDownload from './initiateUserJSONDownlaod';

export type FullBudgetExport = {
  budget: ynab.BudgetDetail;
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

  const sanitizedBudgetName = budgetData.budget.name.replace(
    /[^a-z0-9]/gi,
    '_',
  );
  const filename = `${getDateTimeString()}__YNAB-full-budget-export__${sanitizedBudgetName}.json`;
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

    console.log(
      'Fetching all budget data (this may take a while depending on the size/age of your budget)...',
    );
    const budget = await ynabApi.budgets.getBudgetById(budgetID);

    /* eslint-disable sort-keys-fix/sort-keys-fix */
    result = {
      user: user.data.user,
      budget: budget.data.budget,
    };
    /* eslint-enable sort-keys-fix/sort-keys-fix */
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
