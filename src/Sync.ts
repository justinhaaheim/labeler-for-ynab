import type {LabelElement} from './LabelElements';
import type {LabelTransactionMatchFinalized} from './Matching';

import nullthrows from 'nullthrows';
import {v4 as uuidv4} from 'uuid';
import {
  type API,
  type NewTransaction,
  type SaveTransactionWithIdOrImportId,
  type TransactionDetail,
} from 'ynab';

// import {CustomRateLimiter} from './CustomRateLimiter';
import isNonNullable from './isNonNullable';
import {getRemainingServerRequests} from './YnabHelpers';

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

const SAVE_TRANSACTION_FIELDS_THAT_DONT_MODIFY = ['id', 'import_id'] as const;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type SaveTransactionFieldsThatDontModify =
  (typeof SAVE_TRANSACTION_FIELDS_THAT_DONT_MODIFY)[number];

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

function getActualChangesFromSaveTransaction(
  saveTransaction: SaveTransactionWithIdOrImportId,
): {
  changes: SaveTransactionWithIdOrImportId;
  keysChanged: Array<keyof SaveTransactionWithIdOrImportId>;
} {
  const {
    id: _id,
    import_id: _import_id,
    ...saveTransactionFieldsThatWereModified
  } = saveTransaction;

  return {
    changes: saveTransactionFieldsThatWereModified,
    keysChanged: Object.getOwnPropertyNames(
      saveTransactionFieldsThatWereModified,
    ) as Array<keyof SaveTransactionWithIdOrImportId>,
  };
}

function isFinalizedUpdateLog(
  log: UpdateLogEntryInProgressV1,
): log is UpdateLogEntryV1 {
  const {newTransactionDetail, updateSucceeded} = log;
  return newTransactionDetail != null && updateSucceeded != null;
}

type SaveTransactionWithUpdateLogInProgress = {
  saveTransaction: SaveTransactionWithIdOrImportId;
  updateLogInProgress: UpdateLogEntryInProgressV1;
};

type ExecuteTransactionUpdatesProps = {
  budgetID: string;
  saveTransactionsWithUpdateLogInProgress: Array<SaveTransactionWithUpdateLogInProgress>;
  ynabAPI: API;
};

async function executeTransactionUpdatesAndUpdateUpdateLogs({
  ynabAPI,
  budgetID,
  saveTransactionsWithUpdateLogInProgress,
}: ExecuteTransactionUpdatesProps): Promise<UpdateLogEntryV1[]> {
  const updateLogsInProgress = saveTransactionsWithUpdateLogInProgress.map(
    (s) => s.updateLogInProgress,
  );
  const saveTransactionsToExecute = saveTransactionsWithUpdateLogInProgress.map(
    (s) => s.saveTransaction,
  );

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

  const transactionsToExecuteSet = new Set(
    saveTransactionsToExecute.map((transaction) => transaction.id),
  );
  // Theoretically this should be the same as Object.keys(newTransactionDetailLookup) (except this is a set, not an array)
  const successfulTransactionsSet = new Set(
    saveTransactionResponse.data.transaction_ids,
  );

  const updateLogsFinalized: UpdateLogEntryV1[] = updateLogsInProgress.map(
    (log) => {
      // NOTE: This shouldn't happen anymore, but I'll keep the checks and logging here just in case
      // There can be transactions that were not in the transactionsToExecute list, so we should just return them as is
      if (isFinalizedUpdateLog(log)) {
        return log;
      }
      if (!transactionsToExecuteSet.has(log.transactionID)) {
        console.warn(
          '[executeTransactionUpdatesAndUpdateUpdateLogs] log.transactionID was not found in transactionsToExecuteSet. This should not happen.',
          log,
        );
        return log as UpdateLogEntryV1;
      }
      return {
        ...log,
        newTransactionDetail:
          newTransactionDetailLookup[log.transactionID] ?? null,
        updateSucceeded: successfulTransactionsSet.has(log.transactionID),
      };
    },
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

  const saveTransactionsWithUpdateLogInProgress: Array<SaveTransactionWithUpdateLogInProgress> =
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

        const newSubtransactions = match.label.subTransactions;

        const newTransactionUpdatesToApply = {
          id: ynabTransactionToUpdate.id,
          memo: newMemo,
          ...(newSubtransactions != null
            ? {subtransactions: newSubtransactions}
            : {}),
        };

        const updateLogInProgress: UpdateLogEntryInProgressV1 = {
          label: match.label.memo,
          previousTransactionDetail: ynabTransactionToUpdate,
          transactionID: ynabTransactionToUpdate.id,
          transactionUpdatesApplied: newTransactionUpdatesToApply,
          updateMethod: 'update',
        };

        return {
          saveTransaction: newTransactionUpdatesToApply,
          updateLogInProgress,
        };
      })
      .filter(isNonNullable);

  console.debug(
    'saveTransactionsWithUpdateLogInProgress',
    saveTransactionsWithUpdateLogInProgress,
  );

  const updateLogsFinalized: UpdateLogEntryV1[] =
    await executeTransactionUpdatesAndUpdateUpdateLogs({
      budgetID,
      saveTransactionsWithUpdateLogInProgress,
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

function convertTransactionDetailToNewTransaction(
  transactionDetail: TransactionDetail,
): NewTransaction {
  const {import_id: _import_id, id: _id, ...newTransaction} = transactionDetail;

  return newTransaction;

  // return {
  //   account_id: transactionDetail.account_id,
  //   amount: transactionDetail.amount,
  //   approved: transactionDetail.approved,
  //   category_id: transactionDetail.category_id,
  //   cleared: transactionDetail.cleared,
  //   date: transactionDetail.date,
  //   flag_color: transactionDetail.flag_color,
  //   // import_id: transactionDetail.import_id,
  //   memo: transactionDetail.memo,
  //   payee_id: transactionDetail.payee_id,
  //   payee_name: transactionDetail.payee_name,
  //   subtransactions: transactionDetail.subtransactions,
  //   // subtransactions: transactionDetail.subtransactions?.map((sub) => ({
  //   //   amount: sub.amount,
  //   //   category_id: sub.category_id,
  //   //   memo: sub.memo,
  //   //   payee_id: sub.payee_id,
  //   //   payee_name: sub.payee_name,
  //   // })),
  // };
}

async function undoSyncStepViaDeleteAndRecreate({
  ynabAPI,
  log,
  budgetID,
  rateLimiter,
}: {
  budgetID: string;
  log: UpdateLogEntryV1;
  rateLimiter: () => Promise<void>;
  ynabAPI: API;
}): Promise<UpdateLogEntryV1 | null> {
  if (!log.updateSucceeded) {
    console.debug(
      `[undoSyncStepViaDeleteAndRecreate] log.updateSucceeded was false. This means there's nothing to undo.`,
      log,
    );
    return null;
  }

  if (log.newTransactionDetail == null) {
    console.error(
      '[undoSyncStepViaDeleteAndRecreate] log.newTransactionDetail was null. This should not happen.',
      log,
    );
    return null;
  }

  /**
   * If there are subtransactions, we need to delete the transaction and then recreate it with the previous subtransactions
   */
  try {
    console.log(
      'Attempting to undo sync by deleting and then reconstituting transaction...',
      log,
    );

    if (log.transactionUpdatesApplied == null) {
      const message =
        '[undoSyncStepViaDeleteAndRecreate] log.transactionUpdatesApplied was null. This should not happen.';
      console.error(message, log);
      throw new Error(message);
    }

    const {changes: _changes, keysChanged} =
      getActualChangesFromSaveTransaction(log.transactionUpdatesApplied);

    await rateLimiter();
    const deleteTransactionResponse =
      await ynabAPI.transactions.deleteTransaction(budgetID, log.transactionID);

    const newTransactionBase = convertTransactionDetailToNewTransaction(
      deleteTransactionResponse.data.transaction,
    );

    const newTransactionUpdatesToApply =
      keysChanged.reduce<SaveTransactionWithIdOrImportId>(
        (acc, currentKey) => ({
          ...acc,
          // Get the value from the previous transaction detail so we know what to change it back to
          [currentKey]: log.previousTransactionDetail[currentKey],
        }),
        {},
      );

    const newTransactionCombined = {
      ...newTransactionBase,
      ...newTransactionUpdatesToApply,
    };

    await rateLimiter();
    const createTransactionResponse =
      await ynabAPI.transactions.createTransaction(budgetID, {
        transaction: newTransactionCombined,
      });

    return {
      label: log.label,
      newTransactionDetail: createTransactionResponse.data.transaction ?? null,
      previousTransactionDetail: deleteTransactionResponse.data.transaction,
      transactionID: nullthrows(createTransactionResponse.data.transaction?.id),
      transactionUpdatesApplied: newTransactionUpdatesToApply,
      updateMethod: 'delete-and-recreate',
      updateSucceeded: true,
    };
  } catch (e) {
    console.error(
      '[undoSyncStepViaDeleteAndRecreate] Failed to delete or recreate transaction',
      e,
    );

    return {
      error: e as Error,
      label: log.label,
      newTransactionDetail: null,
      previousTransactionDetail: log.newTransactionDetail,
      transactionID: log.transactionID,
      transactionUpdatesApplied: null,
      updateMethod: 'delete-and-recreate',
      updateSucceeded: false,
    };
  }
}

export async function undoSyncLabelsToYnab({
  ynabAPI,
  updateLogChunk,
}: UndoConfig): Promise<UpdateLogChunkV1> {
  console.log('undoSyncLabelsToYnab');

  const {accountID, budgetID} = updateLogChunk;

  // If we're just changing the memo let's queue up the actions and reuse the executeTransactionUpdates function
  const saveTransactionsWithUpdateLogInProgress: Array<SaveTransactionWithUpdateLogInProgress> =
    [];

  const deleteAndRecreateActions: Array<
    () => Promise<UpdateLogEntryV1 | null>
  > = [];

  const updateLogChunkResult = {
    _updateLogVersion: CURRENT_UPDATE_LOG_VERSION,
    accountID,
    budgetID,
    logs: [],
    revertSourceInfo: {
      timestamp: updateLogChunk.timestamp,
      updateID: updateLogChunk.updateID,
    },
    timestamp: Date.now(),
    type: 'undo-sync' as const,
    updateID: uuidv4(),
  };

  const remainingServerRequestsAtStart =
    await getRemainingServerRequests(ynabAPI);

  if (remainingServerRequestsAtStart == null) {
    console.error(
      `[undoSyncLabelsToYnab] remainingServerRequestsAtStart was null. That should not happen. Bailing on undo sync.`,
      remainingServerRequestsAtStart,
    );
    // Return the chunk with no logs included
    return updateLogChunkResult;
  }

  // const rateLimiter = CustomRateLimiter(
  //   1, // 1 request per unit of time (below)
  //   {
  //     timeUnit: 1500, // milliseconds
  //     // uniformDistribution = true means that we'll allow 1 request per timeUnit / rps ms
  //     uniformDistribution: true,
  //   },
  // );

  // Since we're only doing 1 request at a time right now, we don't need to rate limit
  const rateLimiter = async () => {};

  updateLogChunk.logs.forEach((log) => {
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

    if (log.transactionUpdatesApplied == null) {
      console.warn(
        '[undoSyncLabelsToYnab] log.transactionUpdatesApplied was null. This should not happen.',
        log,
      );
      return;
    }

    const {changes: _changes, keysChanged} =
      getActualChangesFromSaveTransaction(log.transactionUpdatesApplied);

    if (keysChanged.includes('subtransactions')) {
      // Push a deleteAndRecreate action onto the queue
      deleteAndRecreateActions.push(async () => {
        const undoUpdateLog = await undoSyncStepViaDeleteAndRecreate({
          budgetID,
          log,
          rateLimiter,
          ynabAPI,
        });

        return undoUpdateLog;
      });

      return;
    }

    /**
     * If all we changed was the memo, then let's simply re-write over the memo
     */
    if (
      log.transactionUpdatesApplied != null &&
      log.transactionUpdatesApplied.subtransactions == null
    ) {
      /**
       * NOTE: There's some type coercion going on here, because
       * we don't *actually* know that previousTransactionDetail[key] is the
       * correct type to assign to SaveTransactionWithIdOrImportId[key]. But it
       * should be, so let's not worry about it.
       */
      const newTransactionUpdatesToApply =
        keysChanged.reduce<SaveTransactionWithIdOrImportId>(
          (acc, currentKey) => ({
            ...acc,
            // Get the value from the previous transaction detail so we know what to change it back to
            [currentKey]: log.previousTransactionDetail[currentKey],
          }),
          {},
        );

      newTransactionUpdatesToApply.id = log.transactionID;

      const updateLogInProgress: UpdateLogEntryInProgressV1 = {
        label: log.label,
        previousTransactionDetail: log.newTransactionDetail,
        transactionID: log.transactionID,
        transactionUpdatesApplied: newTransactionUpdatesToApply,
        updateMethod: 'update',
      };

      saveTransactionsWithUpdateLogInProgress.push({
        saveTransaction: newTransactionUpdatesToApply,
        updateLogInProgress,
      });

      return;
    }
  });

  // 1 for the grouped transaction updates, and 2 for each deleteAndRecreate action
  const totalRequestsNeeded = 1 + deleteAndRecreateActions.length * 2;

  if (totalRequestsNeeded > remainingServerRequestsAtStart) {
    console.error(
      `[undoSyncLabelsToYnab] ${totalRequestsNeeded} requests needed to undo sync, but only ${remainingServerRequestsAtStart} remain. Bailing.`,
      {remainingServerRequestsAtStart, totalRequestsNeeded},
    );
    return updateLogChunkResult;
  }

  console.log(
    `${totalRequestsNeeded} server requests needed to undo sync. ${remainingServerRequestsAtStart} remaining.`,
  );

  console.debug(
    `Executing transaction updates that don't require deleting and recreating...`,
  );

  // If all goes according to plan we should have at least 1 (or `requestsToReserve`) server
  // requests left to use for this final step.
  const finalizedUndoUpdateLogsFromUpdates: UpdateLogEntryV1[] =
    saveTransactionsWithUpdateLogInProgress.length > 0
      ? await executeTransactionUpdatesAndUpdateUpdateLogs({
          budgetID,
          saveTransactionsWithUpdateLogInProgress,
          ynabAPI,
        })
      : [];

  // const undoLogsFromDeleteAndRecreateActions: UpdateLogEntryV1[] = (
  //   await Promise.all(deleteAndRecreateActions.map((action) => action()))
  // ).filter(isNonNullable);
  const undoLogsFromDeleteAndRecreateActions: UpdateLogEntryV1[] = [];

  // Let's go through these sequentially for now
  for (let action of deleteAndRecreateActions) {
    const result = await action();
    if (result != null) {
      undoLogsFromDeleteAndRecreateActions.push(result);
    }
  }

  const undoUpdateLogsCombined = [
    ...finalizedUndoUpdateLogsFromUpdates,
    ...undoLogsFromDeleteAndRecreateActions,
  ];

  console.log('undoUpdateLogsCombined', undoUpdateLogsCombined);

  return {
    _updateLogVersion: CURRENT_UPDATE_LOG_VERSION,
    accountID,
    budgetID,
    logs: undoUpdateLogsCombined,
    revertSourceInfo: {
      timestamp: updateLogChunk.timestamp,
      updateID: updateLogChunk.updateID,
    },
    timestamp: Date.now(),
    type: 'undo-sync',
    updateID: uuidv4(),
  };
}
