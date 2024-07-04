import * as ynab from 'ynab';

export const YNAB_TOKEN_LOCAL_STORAGE_KEY = 'ynab_access_token';
export const YNAB_TOKEN_EXPIRATION_TIMESTAMP_LOCAL_STORAGE_KEY =
  YNAB_TOKEN_LOCAL_STORAGE_KEY + '_expiration';

export type YNABErrorType = {error: ynab.ErrorDetail};

export function budgetCompareFunctionForSort(
  b1: ynab.BudgetSummary,
  b2: ynab.BudgetSummary,
): number {
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
}

export function getYNABErrorHandler(
  onAuthError?: (e: YNABErrorType) => void,
): (error: unknown) => void {
  return (error: unknown) => {
    if (typeof error === 'object' && error != null) {
      if (ynab.instanceOfErrorDetail(error)) {
        switch ((error as YNABErrorType).error?.id) {
          case '401': {
            console.warn(
              '📡❌ Authentication Error when fetching data from YNAB. Reauthorization needed.',
              error,
            );
            console.debug('Removing expired auth token from session storage');
            sessionStorage.removeItem(YNAB_TOKEN_LOCAL_STORAGE_KEY);
            onAuthError != null && onAuthError(error as YNABErrorType);
            break;
          }
          case '429': {
            console.warn(
              '📡❌ YNAB API rate limit exceeded when fetching data from YNAB.',
              error,
            );
            // TODO: Anything else I should do here?
            break;
          }
        }
      } else {
        console.debug(
          'FYI: Error fetching data from YNAB is not auth related:',
          error,
        );
      }
    } else {
      console.error('📡❌ Error is nullish or not an object', error);
    }
  };
}
