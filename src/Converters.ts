import type {
  StandardTransactionType,
  YnabCsvTransactionType,
} from './LabelTypes';
import type {TransactionDetail} from 'ynab';

import {v4 as uuidv4} from 'uuid';
import * as ynab from 'ynab';

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
  return ynabCsvTransactions.map((t) => ({
    amount: Number(t.amount),
    date: t.date,
    id: uuidv4(),
    memo: t.memo,
    payee: t.payee,
  }));
}
