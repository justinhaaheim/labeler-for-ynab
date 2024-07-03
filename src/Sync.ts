import type {StandardTransactionType} from './LabelTypes';
import type {
  LabelTransactionMatch,
  LabelTransactionMatchNonNullable,
} from './Matching';
import type {API, SaveTransactionWithId} from 'ynab';

const MAXIMUM_YNAB_MEMO_LENGTH = 200;
const SPACER_STRING = ' ';
export const SEPARATOR_BEFORE_LABEL = '##';

type SyncConfig = {
  budgetID: string;
  finalizedMatches: LabelTransactionMatch[];
  ynabAPI: API;
};

type UndoConfig = {
  budgetID: string;
  updateLogChunk: UpdateLogChunk;
  ynabAPI: API;
};

export type UpdateLogEntry = {
  id: string;
  label: string | null;
  method: 'append' | 'truncate';
  newMemo: string;
  previousMemo: string | null | undefined;
  updateSucceeded?: boolean;
};

export type UpdateLogChunk = {
  logs: UpdateLogEntry[];
  timestamp: number;
  type: 'sync' | 'undo-sync';
};

export function generateStandardLabel(label: StandardTransactionType): string {
  return SEPARATOR_BEFORE_LABEL + SPACER_STRING + label.memo;
}

export async function syncLabelsToYnab({
  budgetID,
  ynabAPI,
  finalizedMatches,
}: SyncConfig): Promise<UpdateLogChunk> {
  console.log('syncLabelsToYnab');

  let updateLogs: UpdateLogEntry[] = [];

  const saveTransactionsToExecute: SaveTransactionWithId[] = (
    finalizedMatches.filter(
      (m) => m.transactionMatch != null,
    ) as LabelTransactionMatchNonNullable[]
  ).map((match) => {
    const ynabTransactionToUpdate = match.transactionMatch;

    const charactersRemainingForLabel =
      MAXIMUM_YNAB_MEMO_LENGTH -
      ((ynabTransactionToUpdate.memo?.length ?? 0) + SPACER_STRING.length);

    // This should include any space or separator between the original memo and the label
    const labelToAppend =
      SPACER_STRING +
      generateStandardLabel(match.label).slice(0, charactersRemainingForLabel);
    const newMemo = `${ynabTransactionToUpdate.memo}${labelToAppend}`;

    console.debug({
      lostCharacters: Math.max(
        match.label.memo.length - charactersRemainingForLabel,
        0,
      ),
      newMemo,
      newMemoLength: newMemo.length,
    });

    updateLogs.push({
      id: ynabTransactionToUpdate.id,
      label: match.label.memo,
      method: 'append',
      newMemo,
      previousMemo: ynabTransactionToUpdate.memo,
    });

    return {
      id: ynabTransactionToUpdate.id,
      memo: newMemo,
    };
  });

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

  updateLogs = updateLogs.map((log) => ({
    ...log,
    updateSucceeded: successfulTransactionsSet.has(log.id),
  }));

  console.debug('saveTransactionResponse', saveTransactionResponse);

  return {logs: updateLogs, timestamp: Date.now(), type: 'sync'};
}

export async function undoSyncLabelsToYnab({
  budgetID,
  ynabAPI,
  updateLogChunk,
}: UndoConfig): Promise<UpdateLogChunk> {
  console.log('undoSyncLabelsToYnab');

  let undoUpdateLogs: UpdateLogEntry[] = [];

  const saveTransactionsToExecute: SaveTransactionWithId[] =
    updateLogChunk.logs.map((log) => {
      undoUpdateLogs.push({
        id: log.id,
        label: log.label,
        method: 'truncate',
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

  undoUpdateLogs = undoUpdateLogs.map((log) => ({
    ...log,
    updateSucceeded: successfulTransactionsSet.has(log.id),
  }));

  console.debug(
    '[undoSyncLabelsToYnab] saveTransactionResponse',
    saveTransactionResponse,
  );

  return {
    logs: undoUpdateLogs,
    timestamp: Date.now(),
    type: 'undo-sync',
  };
}
