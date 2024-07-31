import type {StandardTransactionTypeWithLabelElements} from './LabelTypes';
import type {TransactionDetail} from 'ynab';

import * as ynab from 'ynab';

import isNonNullable from './isNonNullable';

export type MatchCandidate = {
  candidates: TransactionDetailWithDateDiff[];
  label: StandardTransactionTypeWithLabelElements;
};

export type LabelTransactionMatch = {
  label: StandardTransactionTypeWithLabelElements;
  transactionMatch: TransactionDetail | null;
};

export interface LabelWarning {
  // _type: string;
  message: string;
}

export type LabelTransactionMatchWithWarnings = LabelTransactionMatch & {
  warnings: LabelWarning[];
};

export type LabelTransactionMatchFinalized = {
  label: StandardTransactionTypeWithLabelElements;
  newMemo: string;
  transactionMatch: TransactionDetail | null;
  warnings: LabelWarning[];
};

type TransactionDetailWithDateDiff = TransactionDetail & {
  dateDiff: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAXIMUM_MATCH_DISTANCE_MS = 10 * DAY_IN_MS;

export function getMatchCandidatesForLabel(
  label: StandardTransactionTypeWithLabelElements,
  ynabTransactions: TransactionDetail[],
  shouldLog?: boolean,
): TransactionDetailWithDateDiff[] {
  shouldLog &&
    console.debug('[getMatchCandidatesForLabel]', {
      label,
      ynabTransactionsLength: ynabTransactions.length,
    });

  const candidates: TransactionDetailWithDateDiff[] = ynabTransactions
    .map((ynabTransaction) => {
      shouldLog &&
        console.debug(
          '[getMatchCandidatesForLabel] candidate:',
          ynabTransaction,
        );
      if (
        label.amount !==
        ynab.utils.convertMilliUnitsToCurrencyAmount(ynabTransaction.amount)
      ) {
        shouldLog &&
          console.debug('[getMatchCandidatesForLabel] amount mismatch');
        return null;
      }

      const labelDate = new Date(label.date);
      const candidateDate = new Date(ynabTransaction.date);
      const dateDiff = Math.abs(labelDate.getTime() - candidateDate.getTime());
      if (ynabTransaction.amount === -74970) {
        console.log('found!');
        console.debug('[getMatchCandidatesForLabel] dateDiff:', {
          dateDiff,
          dateDiffInDays: dateDiff / DAY_IN_MS,
        });
      }
      shouldLog &&
        console.debug('[getMatchCandidatesForLabel] dateDiff:', {
          dateDiff,
          dateDiffInDays: dateDiff / DAY_IN_MS,
        });

      if (dateDiff > MAXIMUM_MATCH_DISTANCE_MS) {
        shouldLog &&
          console.debug(
            '[getMatchCandidatesForLabel] candidate is out of date range',
          );
        return null;
      }

      shouldLog &&
        console.debug(
          '[getMatchCandidatesForLabel] MATCH! candidate is WITHIN date range!',
        );
      return {...ynabTransaction, dateDiff};
    })
    .filter(isNonNullable);

  shouldLog &&
    console.debug('[getMatchCandidatesForLabel] candidates:', candidates);

  const candidatesSortedByDateDiff = candidates
    .slice()
    .sort((a, b) => a.dateDiff - b.dateDiff);

  shouldLog &&
    console.debug(
      '[getMatchCandidatesForLabel] candidatesSortedByDateDiff:',
      candidatesSortedByDateDiff,
    );

  return candidatesSortedByDateDiff;
}

/**
 *
 * TODO: We need to detect whether a transaction already has a label from a previous round of labeling by the user
 *
 * @param labels
 * @param ynabTransactions
 * @returns
 */
export function getMatchCandidatesForAllLabels(
  labels: StandardTransactionTypeWithLabelElements[],
  ynabTransactions: TransactionDetail[],
): MatchCandidate[] {
  console.debug('⭐ [getMatchCandidatesForAllLabels]');
  const matchCandidates: MatchCandidate[] = [];

  for (const label of labels) {
    matchCandidates.push({
      candidates: getMatchCandidatesForLabel(label, ynabTransactions, false),
      label: label,
    });
  }

  return matchCandidates;
}

export function resolveBestMatchForLabels(
  matchCandidates: MatchCandidate[],
): LabelTransactionMatch[] {
  console.debug('⭐ [resolveBestMatchForLabels]');
  const alreadyMatchedTransactionIDs = new Set<string>();

  const finalizedMatchPairings: LabelTransactionMatch[] = [];

  for (const {candidates, label} of matchCandidates) {
    let bestTransactionMatch: TransactionDetail | null = null;

    for (const candidate of candidates) {
      if (bestTransactionMatch != null) {
        // We already found a good match. Prolly makes sense to break out of this, but I'm not going to do that right now.
        break;
      }

      if (alreadyMatchedTransactionIDs.has(candidate.id)) {
        // The transaction has already been matched with another label
        continue;
      }

      bestTransactionMatch = candidate;
    }

    finalizedMatchPairings.push({
      label,
      transactionMatch: bestTransactionMatch,
    });

    if (bestTransactionMatch != null) {
      alreadyMatchedTransactionIDs.add(bestTransactionMatch.id);
    }
  }

  return finalizedMatchPairings;
}

export function getTransactionByID(
  transactions:
    | StandardTransactionTypeWithLabelElements[]
    | TransactionDetail[],
  id: string,
): StandardTransactionTypeWithLabelElements | TransactionDetail | null {
  return transactions.find((t) => t.id === id) ?? null;
}
