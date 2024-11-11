import type {LabelElement} from './LabelElements';
import type {LabelTransactionMatchFinalized} from './Matching';
import type {
  API,
  SaveTransactionWithIdOrImportId,
  TransactionDetail,
} from 'ynab';

import nullthrows from 'nullthrows';
import {v4 as uuidv4} from 'uuid';

import isNonNullable from './isNonNullable';

export const YNAB_MAX_MEMO_LENGTH = 200;

export const UPDATE_TYPE_PRETTY_STRING = {
  sync: 'Sync',
  'undo-sync': 'Undo Sync',
} as const;

export type UpdateType = keyof typeof UPDATE_TYPE_PRETTY_STRING;

export const CURRENT_UPDATE_LOG_VERSION = 2 as const;

export type UpdateLogChunkV1 = {
  _updateLogVersion: typeof CURRENT_UPDATE_LOG_VERSION;

  // NOTE: accountID isn't used when making transaction updates, so it's inclusion here is just for informational/debugging purposes
  accountID: string;

  budgetID: string;
  logs: UpdateLogEntryV1[];
  revertSourceInfo?: {
    timestamp: number;
    updateID: string;
  };
  timestamp: number;
  type: UpdateType;
  updateID: string;
};

export type UpdateMethod = 'delete-and-recreate' | 'update';

export type UpdateLogEntryV1 = {
  error?: Error;
  label: LabelElement[] | null;
  newTransactionDetail: TransactionDetail | null;
  previousTransactionDetail: TransactionDetail;
  transactionID: string;
  transactionUpdatesApplied: SaveTransactionWithIdOrImportId | null;
  updateMethod: UpdateMethod;
  updateSucceeded: boolean;
};

// const a = {} as TransactionDetail;
// const b: NewTransaction = a;

// https://stackoverflow.com/a/54178819/18265617
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type UpdateLogEntryInProgressV1 = PartialBy<
  UpdateLogEntryV1,
  'newTransactionDetail' | 'updateSucceeded'
>;

type SyncConfig = {
  accountID: string;
  budgetID: string;
  finalizedMatches: LabelTransactionMatchFinalized[];
  ynabAPI: API;
};

type UndoConfig = {
  updateLogChunk: UpdateLogChunkV1;
  ynabAPI: API;
};

export function trimToYNABMaxMemoLength(memo: string): string {
  return memo.slice(0, YNAB_MAX_MEMO_LENGTH);
}

type ExecuteTransactionUpdatesProps = {
  budgetID: string;
  saveTransactionsToExecute: SaveTransactionWithIdOrImportId[];
  updateLogsInProgress: UpdateLogEntryInProgressV1[];
  ynabAPI: API;
};

async function executeTransactionUpdatesAndUpdateUpdateLogs({
  ynabAPI,
  budgetID,
  saveTransactionsToExecute,
  updateLogsInProgress,
}: ExecuteTransactionUpdatesProps): Promise<UpdateLogEntryV1[]> {
  const saveTransactionResponse = await ynabAPI.transactions.updateTransactions(
    budgetID,
    {
      transactions: saveTransactionsToExecute,
    },
  );

  console.debug('saveTransactionResponse', saveTransactionResponse);

  const newTransactionDetailLookup =
    saveTransactionResponse.data.transactions?.reduce<
      Record<string, TransactionDetail>
    >((acc, currentValue) => {
      acc[currentValue.id] = currentValue;
      return acc;
    }, {}) ?? {};

  // Theoretically this should be the same as Object.keys(newTransactionDetailLookup) (except this is a set, not an array)
  const successfulTransactionsSet = new Set(
    saveTransactionResponse.data.transaction_ids,
  );

  const updateLogsFinalized: UpdateLogEntryV1[] = updateLogsInProgress.map(
    (log) => ({
      ...log,
      newTransactionDetail:
        newTransactionDetailLookup[log.transactionID] ?? null,
      updateSucceeded: successfulTransactionsSet.has(log.transactionID),
    }),
  );
  return updateLogsFinalized;
}

export async function syncLabelsToYnab({
  accountID,
  budgetID,
  ynabAPI,
  finalizedMatches,
}: SyncConfig): Promise<UpdateLogChunkV1> {
  console.log('syncLabelsToYnab');

  let updateLogs: UpdateLogEntryInProgressV1[] = [];

  const saveTransactionsToExecute: SaveTransactionWithIdOrImportId[] =
    finalizedMatches
      .map((match) => {
        if (match.transactionMatch == null) {
          return null;
        }

        const ynabTransactionToUpdate = match.transactionMatch;

        // Let's truncate here just to be sure, even though we're already doing that elsewhere in the codebase
        const newMemo = trimToYNABMaxMemoLength(match.newMemo);

        if (newMemo !== match.newMemo) {
          console.warn(
            `[syncLabelsToYnab] match.newMemo was over YNAB's memo length limit and was truncated from ${match.newMemo.length} to ${newMemo.length}.`,
            match,
          );
        }

        // console.debug({
        //   newMemo,
        //   newMemoLength: newMemo.length,
        // });

        const newTransactionUpdatesToApply = {
          id: ynabTransactionToUpdate.id,
          memo: newMemo,
          subtransactions: match.label.subTransactions,
        };

        updateLogs.push({
          label: match.label.memo,
          previousTransactionDetail: ynabTransactionToUpdate,
          transactionID: ynabTransactionToUpdate.id,
          transactionUpdatesApplied: newTransactionUpdatesToApply,
          updateMethod: 'update',
        });

        return newTransactionUpdatesToApply;
      })
      .filter(isNonNullable);

  console.debug('saveTransactionsToExecute', saveTransactionsToExecute);
  console.debug('updateLogs (in progress)', updateLogs);

  // console.log('No update made.');

  const updateLogsFinalized: UpdateLogEntryV1[] =
    await executeTransactionUpdatesAndUpdateUpdateLogs({
      budgetID,
      saveTransactionsToExecute,
      updateLogsInProgress: updateLogs,
      ynabAPI,
    });

  return {
    _updateLogVersion: CURRENT_UPDATE_LOG_VERSION,
    accountID,
    budgetID,
    logs: updateLogsFinalized,
    timestamp: Date.now(),
    type: 'sync',
    updateID: uuidv4(),
  };
}

export async function undoSyncLabelsToYnab({
  ynabAPI,
  updateLogChunk,
}: UndoConfig): Promise<UpdateLogChunkV1> {
  console.log('undoSyncLabelsToYnab');

  const {accountID, budgetID} = updateLogChunk;

  let undoUpdateLogs: UpdateLogEntryInProgressV1[] = [];

  const saveTransactionsToExecute: SaveTransactionWithIdOrImportId[] = [];

  await Promise.all(
    updateLogChunk.logs.map(async (log) => {
      if (!log.updateSucceeded) {
        console.debug(
          `[undoSyncLabelsToYnab] log.updateSucceeded was false. This means there's nothing to undo.`,
          log,
        );
        return;
      }

      if (log.newTransactionDetail == null) {
        console.warn(
          '[undoSyncLabelsToYnab] log.newTransactionDetail was null. This should not happen.',
          log,
        );
        return;
      }

      if (
        log.transactionUpdatesApplied != null &&
        log.transactionUpdatesApplied.subtransactions == null
      ) {
        const newTransactionUpdatesToApply = {
          id: log.transactionID,
          /**
           * NOTE: there are a lot of ways we could do this, and probably the safest is to search the
           * current memo for the appended string and remove it if it's present or leave it if it's
           * not (ie the user manually edited the memo in the meantime)
           */
          memo: log.previousTransactionDetail.memo,
        };
        saveTransactionsToExecute.push(newTransactionUpdatesToApply);

        undoUpdateLogs.push({
          label: log.label,
          previousTransactionDetail: log.newTransactionDetail,
          transactionID: log.transactionID,
          transactionUpdatesApplied: newTransactionUpdatesToApply,
          updateMethod: 'update',
        });
        return;
      }

      /**
       * If there are subtransactions, we need to delete the transaction and then recreate it with the previous subtransactions
       */
      try {
        console.log(
          'Attempting to undo sync by deleting and then reconstituting transaction...',
          log,
        );
        const deleteTransactionResponse =
          await ynabAPI.transactions.deleteTransaction(
            budgetID,
            log.transactionID,
          );
        const createTransactionResponse =
          await ynabAPI.transactions.createTransaction(budgetID, {
            transaction: {
              ...log.previousTransactionDetail,
            },
          });
        undoUpdateLogs.push({
          label: log.label,
          newTransactionDetail: createTransactionResponse.data.transaction,
          previousTransactionDetail: deleteTransactionResponse.data.transaction,
          transactionID: nullthrows(
            createTransactionResponse.data.transaction?.id,
          ),
          transactionUpdatesApplied: null,
          updateMethod: 'delete-and-recreate',
          updateSucceeded: true,
        });
      } catch (e) {
        console.error('Failed to delete or recreate transaction', e);

        undoUpdateLogs.push({
          error: e as Error,
          label: log.label,
          previousTransactionDetail: log.newTransactionDetail,
          transactionID: log.transactionID,
          transactionUpdatesApplied: null,
          updateMethod: 'delete-and-recreate',
          updateSucceeded: false,
        });
        return;
      }
    }),
  );

  console.debug(
    '[undoSyncLabelsToYnab] saveTransactionsToExecute',
    saveTransactionsToExecute,
  );

  const undoUpdateLogsFinalized: UpdateLogEntryV1[] =
    await executeTransactionUpdatesAndUpdateUpdateLogs({
      budgetID,
      saveTransactionsToExecute,
      updateLogsInProgress: undoUpdateLogs,
      ynabAPI,
    });

  return {
    _updateLogVersion: CURRENT_UPDATE_LOG_VERSION,
    accountID,
    budgetID,
    logs: undoUpdateLogsFinalized,
    revertSourceInfo: {
      timestamp: updateLogChunk.timestamp,
      updateID: updateLogChunk.updateID,
    },
    timestamp: Date.now(),
    type: 'undo-sync',
    updateID: uuidv4(),
  };
}
