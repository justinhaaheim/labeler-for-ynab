import * as ynab from 'ynab';

export const YNAB_TOKEN_LOCAL_STORAGE_KEY = 'ynab_access_token';
export const YNAB_TOKEN_EXPIRATION_TIMESTAMP_LOCAL_STORAGE_KEY =
  YNAB_TOKEN_LOCAL_STORAGE_KEY + '_expiration';

const API_BASE_URL = 'https://api.ynab.com/v1';
const API_USER_ENDPOINT = '/user';

export type YNABErrorType = {error: ynab.ErrorDetail};

type APIInfo = {
  api: ynab.API | null;
  token: string | null;
  tokenExpirationTimestamp: number | null;
};

const YNAB_DEFAULT_TOKEN_EXPIRATION_TIME_SECONDS = 7200;
// Err on the side of telling the user it expires earlier than it does
const TOKEN_EXPIRATION_REDUCTION_MS = 1000 * 60;

const YNAB_ACCESS_TOKEN_URL_HASH_KEY = 'access_token';

export function clearTokenStorage(): void {
  console.debug('Clearing YNAB token from session storage');
  sessionStorage.removeItem(YNAB_TOKEN_LOCAL_STORAGE_KEY);
  sessionStorage.removeItem(YNAB_TOKEN_EXPIRATION_TIMESTAMP_LOCAL_STORAGE_KEY);
}

export function getYNABApi(): APIInfo {
  // Check for the YNAB token provided when we're redirected back from the YNAB OAuth page
  let token = null;
  let tokenExpirationTimestamp = null;

  // NOTE: window.location.hash includes the "#"
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  // console.debug('Parsing url hash:', {
  //   hashOriginalString: window.location.hash,
  //   hashParams: Array.from(hashParams.entries()),
  // });

  // NOTE: .get returns null if there's no item
  const hashToken = hashParams.get(YNAB_ACCESS_TOKEN_URL_HASH_KEY);

  if (hashToken != null && hashToken.length > 0) {
    token = hashToken;

    const expiresInSeconds =
      Number(hashParams.get('expires_in')) ??
      YNAB_DEFAULT_TOKEN_EXPIRATION_TIME_SECONDS;

    tokenExpirationTimestamp =
      Date.now() + expiresInSeconds * 1000 - TOKEN_EXPIRATION_REDUCTION_MS;

    console.debug('YNAB token retrieved from URL:', {
      token,
      tokenExpirationTimestamp,
    });

    // TODO: store when it expires and use that to warn the client when calls to the API will start failing; prompt to reauthorize
    sessionStorage.setItem(YNAB_TOKEN_LOCAL_STORAGE_KEY, token);
    sessionStorage.setItem(
      YNAB_TOKEN_EXPIRATION_TIMESTAMP_LOCAL_STORAGE_KEY,
      tokenExpirationTimestamp.toString(),
    );

    const newURL = new URL(window.location.href);
    // Remove the token from the url
    newURL.hash = '';
    window.history.replaceState(null, '', newURL.toString());
  } else {
    // Otherwise try sessionStorage
    const tokenFromStorage = sessionStorage.getItem(
      YNAB_TOKEN_LOCAL_STORAGE_KEY,
    );
    const tokenExpirationFromStorage = sessionStorage.getItem(
      YNAB_TOKEN_EXPIRATION_TIMESTAMP_LOCAL_STORAGE_KEY,
    );

    const tokenExpirationTimestampFromStorage =
      tokenExpirationFromStorage == null
        ? null
        : Number(tokenExpirationFromStorage);

    const tokenIsExpired =
      tokenExpirationTimestampFromStorage != null &&
      tokenExpirationTimestampFromStorage - Date.now() <= 0;

    // Only use the token from storage if both token and timestamp are nonnull and the token is not expired
    if (
      tokenFromStorage != null &&
      tokenExpirationTimestampFromStorage != null &&
      !tokenIsExpired
    ) {
      token = tokenFromStorage;
      tokenExpirationTimestamp = tokenExpirationTimestampFromStorage;

      console.debug('YNAB token retrieved from session storage:', {
        token,
        tokenExpirationTimestamp,
      });
    } else {
      if (
        tokenFromStorage == null &&
        tokenExpirationTimestampFromStorage == null
      ) {
        console.debug('No YNAB token found in session storage.');
      } else {
        if (tokenIsExpired) {
          console.debug('YNAB token from storage is expired.');
        }
        clearTokenStorage();
      }
    }
  }

  return {
    api: token != null ? new ynab.API(token) : null,
    token,
    tokenExpirationTimestamp,
  };
}

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
      // @ts-ignore TODO: Come back to this type issue re: errors
      if (ynab.instanceOfErrorDetail(error?.error)) {
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

export async function getRemainingServerRequestsManually(
  token: string,
): Promise<number | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${API_USER_ENDPOINT}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const remainingRequestsFraction = response.headers.get('X-Rate-Limit');
    if (
      remainingRequestsFraction == null ||
      remainingRequestsFraction.length === 0
    ) {
      return null;
    }
    const remainingRequestsFractionParsed = remainingRequestsFraction
      .split('/')
      .map((s) => parseInt(s))
      .filter((n) => !isNaN(n));

    const [requestsMade, totalRequests] = remainingRequestsFractionParsed;

    if (requestsMade == null || totalRequests == null) {
      throw new Error(
        'Unable to parse remaining requests fraction: ' +
          remainingRequestsFraction,
      );
    }

    const remainingRequests = totalRequests - requestsMade;
    console.debug(
      `📡🔒 Remaining requests from YNAB: ${remainingRequests} / ${totalRequests}`,
    );
    return remainingRequests;
  } catch (error) {
    console.error('📡❌ Error fetching remaining requests from YNAB:', error);
    return null;
  }
}

export async function getRemainingServerRequests(
  ynabApi: ynab.API,
): Promise<number | null> {
  try {
    const {raw: response} = await ynabApi.user.getUserRaw();
    const remainingRequestsFraction = response.headers.get('X-Rate-Limit');
    if (
      remainingRequestsFraction == null ||
      remainingRequestsFraction.length === 0
    ) {
      return null;
    }
    const remainingRequestsFractionParsed = remainingRequestsFraction
      .split('/')
      .map((s) => parseInt(s))
      .filter((n) => !isNaN(n));

    const [requestsMade, totalRequests] = remainingRequestsFractionParsed;

    if (requestsMade == null || totalRequests == null) {
      throw new Error(
        'Unable to parse remaining requests fraction: ' +
          remainingRequestsFraction,
      );
    }

    const remainingRequests = totalRequests - requestsMade;
    console.debug(
      `📡🔒 Remaining requests from YNAB: ${remainingRequests} / ${totalRequests}`,
    );
    return remainingRequests;
  } catch (error) {
    console.error('📡❌ Error fetching remaining requests from YNAB:', error);
    return null;
  }
}
