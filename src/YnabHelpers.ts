import * as ynab from 'ynab';

export const YNAB_TOKEN_LOCAL_STORAGE_KEY = 'ynab_access_token';

export function getYNABErrorHandler(
  onAuthError?: (e: unknown) => void,
): (error: unknown) => void {
  return (error: unknown) => {
    if (typeof error === 'object' && error != null) {
      if (
        ynab.instanceOfErrorDetail(error) &&
        (error as {error: ynab.ErrorDetail}).error?.id === '401'
      ) {
        console.warn(
          '📡❌ Error fetching data from YNAB. Probably need to reauthorize',
          error,
        );
        console.debug('Removing expired auth token from session storage');
        sessionStorage.removeItem(YNAB_TOKEN_LOCAL_STORAGE_KEY);
        onAuthError != null && onAuthError(error);
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
