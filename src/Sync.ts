import type {LabelElement} from './LabelElements';
import type {LabelTransactionMatchFinalized} from './Matching';
import type {API, SaveTransactionWithIdOrImportId} from 'ynab';

import {v4 as uuidv4} from 'uuid';

import isNonNullable from './isNonNullable';

export const MAXIMUM_YNAB_MEMO_LENGTH = 200;

export const UPDATE_TYPE_PRETTY_STRING = {
  sync: 'Sync',
  'undo-sync': 'Undo Sync',
} as const;

export type UpdateType = keyof typeof UPDATE_TYPE_PRETTY_STRING;

export const CURRENT_UPDATE_LOG_VERSION = 1 as const;

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

export type UpdateLogEntryV1 = {
  id: string;

  label: LabelElement[];

  method: 'append-label' | 'remove-label';
  newMemo: string;
  previousMemo: string | undefined;
  updateSucceeded: boolean;
};

type UpdateLogEntryInProgressV1 = Omit<UpdateLogEntryV1, 'updateSucceeded'>;

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

        const newMemo = match.newMemo;

        console.debug({
          newMemo,
          newMemoLength: newMemo.length,
        });

        updateLogs.push({
          id: ynabTransactionToUpdate.id,
          label: match.label.memo,
          method: 'append-label',
          newMemo: newMemo,
          // Use the exact previous memo here (whether it's whitespace, undefined, null, etc)
          previousMemo: ynabTransactionToUpdate.memo,
        });

        return {
          id: ynabTransactionToUpdate.id,
          memo: newMemo,
        };
      })
      .filter(isNonNullable);

  console.debug('saveTransactionsToExecute', saveTransactionsToExecute);
  console.debug('updateLogs', updateLogs);

  // console.log('No update made.');

  const saveTransactionResponse = await ynabAPI.transactions.updateTransactions(
    budgetID,
    {
      transactions: saveTransactionsToExecute,
    },
  );

  const successfulTransactionsSet = new Set(
    saveTransactionResponse.data.transaction_ids,
  );

  const updateLogsFinalized: UpdateLogEntryV1[] = updateLogs.map((log) => ({
    ...log,
    updateSucceeded: successfulTransactionsSet.has(log.id),
  }));

  console.debug('saveTransactionResponse', saveTransactionResponse);

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

  const saveTransactionsToExecute: SaveTransactionWithIdOrImportId[] =
    updateLogChunk.logs.map((log) => {
      undoUpdateLogs.push({
        id: log.id,
        label: log.label,
        method: 'remove-label',
        newMemo: log.previousMemo ?? '',
        previousMemo: log.newMemo,
      });

      return {
        id: log.id,
        /**
         * NOTE: there are a lot of ways we could do this, and probably the safest is to search the
         * current memo for the appended string and remove it if it's present or leave it if it's
         * not (ie the user manually edited the memo in the meantime)
         */
        memo: log.previousMemo,
      };
    });

  console.debug(
    '[undoSyncLabelsToYnab] saveTransactionsToExecute',
    saveTransactionsToExecute,
  );

  const saveTransactionResponse = await ynabAPI.transactions.updateTransactions(
    budgetID,
    {transactions: saveTransactionsToExecute},
  );

  const successfulTransactionsSet = new Set(
    saveTransactionResponse.data.transaction_ids,
  );

  const undoUpdateLogsFinalized = undoUpdateLogs.map((log) => ({
    ...log,
    updateSucceeded: successfulTransactionsSet.has(log.id),
  }));

  console.debug(
    '[undoSyncLabelsToYnab] saveTransactionResponse',
    saveTransactionResponse,
  );

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
