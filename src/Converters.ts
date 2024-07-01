import type {
  // AmazonOrdersCsvImportType,
  StandardTransactionType,
  YnabCsvTransactionType,
} from './LabelTypes';
import type {TransactionDetail} from 'ynab';

import {v4 as uuidv4} from 'uuid';
import * as ynab from 'ynab';

import parseLocaleNumber from './parseLocaleNumber';

// export function getLabelsFromAmazonOrders(
//   orders: AmazonOrdersCsvImportType[],
// ): StandardTransactionType[] {}

export function convertYnabToStandardTransaction(
  ynabTransactions: TransactionDetail[],
): StandardTransactionType[] {
  return ynabTransactions.map((t) => ({
    amount: ynab.utils.convertMilliUnitsToCurrencyAmount(t.amount),
    date: t.date,
    id: t.id,
    memo: t.memo ?? '',
    payee: t.payee_name ?? '',
  }));
}

export function convertYnabCsvToStandardTransaction(
  ynabCsvTransactions: YnabCsvTransactionType[],
): StandardTransactionType[] {
  return ynabCsvTransactions.map((t) => {
    // TODO: This is pretty janky. Surely there must be a better way?
    // Right now we need parseLocaleNumber for numbers in csv that contain thousands separators (e.g. comma in the US), which can't be parsed by Number()
    const amount = isNaN(Number(t.amount))
      ? parseLocaleNumber(t.amount)
      : Number(t.amount);

    return {
      amount: amount,
      date: t.date,
      id: uuidv4(),
      memo: t.memo,
      payee: t.payee,
    };
  });
}
