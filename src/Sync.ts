import type {StandardTransactionType} from './LabelTypes';
import type {
  LabelTransactionMatch,
  LabelTransactionMatchNonNullable,
} from './Matching';
import type {API, SaveTransactionWithId} from 'ynab';

type Config = {
  budgetID: string;
  finalizedMatches: LabelTransactionMatch[];
  ynabAPI: API;
};

export type UpdateLog = {
  id: string;
  labelAppended: string;
  method: 'append';
  newMemo: string;
  previousMemo: string | null | undefined;
};

export function generateStandardLabel(label: StandardTransactionType): string {
  return `## ${label.memo} ##`;
}

export async function syncLabelsToYnab({
  // budgetID,
  // ynabAPI,
  finalizedMatches,
}: Config): Promise<UpdateLog[]> {
  console.log('syncLabelsToYnab');

  const updateLogs: UpdateLog[] = [];

  const saveTransactionsToExecute: SaveTransactionWithId[] = (
    finalizedMatches.filter(
      (m) => m.transactionMatch != null,
    ) as LabelTransactionMatchNonNullable[]
  ).map((match) => {
    const ynabTransactionToUpdate = match.transactionMatch;

    // This should include any space or separator between the original memo and the label
    const labelToAppend = ' ' + generateStandardLabel(match.label);
    const newMemo = `${ynabTransactionToUpdate.memo}${labelToAppend}`;

    updateLogs.push({
      id: ynabTransactionToUpdate.id,
      labelAppended: match.label.memo,
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

  console.log('No update made.');

  return updateLogs;

  // ynabAPI.transactions.updateTransactions(budgetID);
}

export async function undoSyncLabelsToYnab(
  updateLogs: UpdateLog[],
): Promise<void> {
  console.log('undoSyncLabelsToYnab');

  const saveTransactionsToExecute: SaveTransactionWithId[] = updateLogs.map(
    (log) => {
      return {
        id: log.id,
        /**
         * NOTE: there are a lot of ways we could do this, and probably the safest is to search the
         * current memo for the appended string and remove it if it's present or leave it if it's
         * not (ie the user manually edited the memo in the meantime)
         */
        memo: log.previousMemo,
      };
    },
  );

  console.debug('saveTransactionsToExecute', saveTransactionsToExecute);
}
