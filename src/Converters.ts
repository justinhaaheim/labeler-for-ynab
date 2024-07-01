import type {TransactionDetail} from 'ynab';

import {v4 as uuidv4} from 'uuid';
import * as ynab from 'ynab';

import {getParsedLabelsFromCsv, type ParsedLabelsTyped} from './LabelParser';
import {
  AMAZON_PAYEE_NAME,
  type AmazonOrdersCsvImportType,
  type StandardTransactionType,
  type YnabCsvTransactionType,
} from './LabelTypes';
import parseLocaleNumber from './parseLocaleNumber';

export function getLabelsFromAmazonOrders(
  orders: AmazonOrdersCsvImportType[],
): StandardTransactionType[] {
  // Count the total number of occurrences of each order_id, so that we can
  // know in advance if there will be multiple labels for the same order_id.
  const orderIdTotalOccurrenceCounter: {[key: string]: number} = {};

  orders.forEach((order) => {
    if (orderIdTotalOccurrenceCounter[order.order_id] == null) {
      orderIdTotalOccurrenceCounter[order.order_id] = 0;
    }
    orderIdTotalOccurrenceCounter[order.order_id] += 1;
  });

  // Count the ongoing number of occurrences of each order_id, so that we can
  // know what number (ie 2 of 4) occurrence this is.
  const orderIdOngoingOccurrenceCounter: {[key: string]: number} = {};

  return orders.map((order) => {
    const id = order.order_id;
    if (orderIdOngoingOccurrenceCounter[id] == null) {
      orderIdOngoingOccurrenceCounter[id] = 0;
    }
    orderIdOngoingOccurrenceCounter[id] += 1;

    const labelId =
      orderIdTotalOccurrenceCounter[id]! === 1
        ? id
        : `${id}__${orderIdOngoingOccurrenceCounter[id]}_of_${orderIdTotalOccurrenceCounter[id]})`;

    // TODO: Get dates from transaction info
    // TODO: Handle if the number cannot be parsed correctly
    return {
      amount: -1 * parseLocaleNumber(order.total),
      date: order.date,
      id: labelId,
      memo: order.items,
      payee: AMAZON_PAYEE_NAME,
    };
  });
}

export function getLabelsFromCsv(csvText: string): StandardTransactionType[] {
  return convertParsedLabelsToStandardTransaction(
    getParsedLabelsFromCsv(csvText),
  );
}

export function convertParsedLabelsToStandardTransaction(
  parsedLabels: ParsedLabelsTyped,
): StandardTransactionType[] {
  switch (parsedLabels._type) {
    case 'amazon': {
      return getLabelsFromAmazonOrders(parsedLabels.labels);
    }
    case 'ynab': {
      return convertYnabCsvToStandardTransaction(parsedLabels.labels);
    }
  }
}

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
