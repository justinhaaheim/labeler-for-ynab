import type {StandardTransactionType} from './LabelTypes';
import type {
  LabelTransactionMatch,
  LabelTransactionMatchNonNullable,
} from './Matching';
import type {API, SaveTransactionWithIdOrImportId} from 'ynab';

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
  label: string;

  // labelSource is the original label before any separators are added
  labelSource: string;

  method: 'append-label' | 'remove-label';
  newMemo: string;
  previousMemo: string | undefined;
  updateSucceeded?: boolean;
};

export type UpdateLogChunk = {
  logs: UpdateLogEntry[];
  timestamp: number;
  type: 'sync' | 'undo-sync';
};

function getLabelWithSeparator(label: StandardTransactionType): string {
  return SEPARATOR_BEFORE_LABEL + SPACER_STRING + label.memo;
}

export async function syncLabelsToYnab({
  budgetID,
  ynabAPI,
  finalizedMatches,
}: SyncConfig): Promise<UpdateLogChunk> {
  console.log('syncLabelsToYnab');

  let updateLogs: UpdateLogEntry[] = [];

  const saveTransactionsToExecute: SaveTransactionWithIdOrImportId[] = (
    finalizedMatches.filter(
      (m) => m.transactionMatch != null,
    ) as LabelTransactionMatchNonNullable[]
  ).map((match) => {
    const ynabTransactionToUpdate = match.transactionMatch;

    // If the previous memo is just whitespace then trim it. If not, leave everything alone and simply append.
    const previousMemoTrimmed =
      (ynabTransactionToUpdate.memo ?? '').trim().length === 0
        ? ''
        : ynabTransactionToUpdate.memo ?? '';

    // If there's already a space at the end of the memo, don't add an additional space
    // Or if the previous memo is an empty string, don't add any space before our label
    const previousMemoWithSpacer =
      previousMemoTrimmed.length === 0 ||
      previousMemoTrimmed.slice(-1) === SPACER_STRING
        ? previousMemoTrimmed
        : previousMemoTrimmed + SPACER_STRING;

    const charactersRemainingForLabel =
      MAXIMUM_YNAB_MEMO_LENGTH - previousMemoWithSpacer.length;

    // This should include any space or separator between the original memo and the label
    const labelToAppend = getLabelWithSeparator(match.label).slice(
      0,
      charactersRemainingForLabel,
    );
    const newMemo = previousMemoWithSpacer + labelToAppend;

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
      label: labelToAppend,
      labelSource: match.label.memo,
      method: 'append-label',
      newMemo,
      // Use the exact previous memo here (whether it's whitespace, undefined, null, etc)
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

  const saveTransactionsToExecute: SaveTransactionWithIdOrImportId[] =
    updateLogChunk.logs.map((log) => {
      undoUpdateLogs.push({
        id: log.id,
        label: log.label,
        labelSource: log.labelSource,
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
