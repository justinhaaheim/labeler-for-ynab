import type {LabelElement} from './LabelElements';
import type {TransactionDetail} from 'ynab';

import {v4 as uuidv4} from 'uuid';
import * as ynab from 'ynab';

import {shortenAmazonOrderURL} from './AmazonLinks';
import {getDateString} from './DateUtils';
import isNonNullable from './isNonNullable';
import {ON_TRUNCATE_TYPES} from './LabelElements';
import {getParsedLabelsFromCsv, type ParsedLabelsTyped} from './LabelParser';
import {
  AMAZON_PAYEE_NAME,
  type AmazonOrdersCsvImportType,
  type StandardTransactionTypeWithLabelElements,
  type YnabCsvTransactionType,
} from './LabelTypes';
import parseLocaleNumber from './parseLocaleNumber';

type DateCandidateWithPosition = {
  date: Date;
  originalIndex: number;
};

type CurrencyAmountCandidateWithPosition = {
  amount: number;
  originalIndex: number;
};

type TransactionData = {
  amount: number | null;
  date: Date | null;
};

type TransactionDataNonNullable = {
  amount: number;
  date: Date;
};

const SHORTEN_AMAZON_LINKS = true;

const AMAZON_PAYMENTS_STRING_DELIMITER = ':';
const AMAZON_PAYMENTS_TRANSACTION_DELIMITER = ';';

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const YEAR_IN_MS = DAY_IN_MS * 365.25;
// const FUTURE_DATE_DISTANCE_LIMIT = YEAR_IN_MS * 1;
// const PAST_DATE_DISTANCE_LIMIT = YEAR_IN_MS * 20;

const MAX_DISTANCE_FROM_CLOSE_DATE = YEAR_IN_MS / 2;

function getDateDistance(d1: Date, d2: Date) {
  return Math.abs(+d1 - +d2);
}

// function getDateDistanceFromNowAbs(d: Date) {
//   return Math.abs(Date.now() - +d);
// }

function isValidAmazonDate(d: Date | null, closeDate: Date) {
  return (
    d != null &&
    !isNaN(d.valueOf()) &&
    Math.abs(+d - +closeDate) < MAX_DISTANCE_FROM_CLOSE_DATE
  );
}

function getBestDatesInOrderFromStrings(
  substrings: string[],
  closeDate: Date,
): DateCandidateWithPosition[] {
  // TODO: No need to parse these to numbers. I should keep them as dates
  const possibleDateNumbers = substrings.map((s) => Date.parse(s));

  const dateCandidates = possibleDateNumbers
    .map((n) => (isNaN(n) ? null : new Date(n)))
    .map((d) => (isValidAmazonDate(d, closeDate) ? d : null));

  const dateCandidatesWithPosition: DateCandidateWithPosition[] = dateCandidates
    .map((d, i) => (d == null ? null : {date: d, originalIndex: i}))
    .filter(isNonNullable)
    .filter((obj) => !isNaN(obj.date.valueOf()));

  // const nowDate = Date.now()

  /**
   * Some strings get parsed into wonky dates, like "Visa ending in 3522" gets parsed to 1/1/3522.
   * It's probably a safe heuristic to assume that date closest to closeDate is most likely to be the correct one,
   */
  const bestDatesInOrder = dateCandidatesWithPosition.sort(
    (a, b) =>
      getDateDistance(a.date, closeDate) - getDateDistance(b.date, closeDate),
  );
  return bestDatesInOrder;
}

function getCurrencyAmountCandidatesFromStrings(
  substrings: string[],
  orderTotal: number,
): CurrencyAmountCandidateWithPosition[] {
  return substrings
    .map((s, i) => {
      const parsedAmount = parseLocaleNumber(s);
      if (!isNaN(parsedAmount) && parsedAmount <= orderTotal) {
        return {amount: parsedAmount, originalIndex: i};
      }
      return null;
    })
    .filter(isNonNullable);
}

function getTransactionDataFromAmazonPaymentsEntry(
  s: string,
  closeDate: Date,
  orderTotal: number,
) {
  console.log('[getDataFromAmazonPaymentsString] start');

  // console.log("s type:", typeof s)
  // console.log({s, delimiter, fallback})
  const substrings = s
    .split(AMAZON_PAYMENTS_STRING_DELIMITER)
    .map((s) => s.trim());

  // Now let's try to figure out what the parts are

  const bestDatesInOrder = getBestDatesInOrderFromStrings(
    substrings,
    closeDate,
  );

  const currencyAmounts = getCurrencyAmountCandidatesFromStrings(
    substrings,
    orderTotal,
  );

  const chosenDateCandidate = bestDatesInOrder[0] ?? null;

  const substringIndexChosenForDate =
    chosenDateCandidate?.originalIndex ?? null;

  const remainingCurrencyAmountsCandidates = currencyAmounts.filter(
    (obj) => obj.originalIndex !== substringIndexChosenForDate,
  );

  const chosenCurrencyAmountCandidate = remainingCurrencyAmountsCandidates[0];

  const result = {
    amount: chosenCurrencyAmountCandidate?.amount ?? null,
    date: chosenDateCandidate?.date ?? null,
  };

  return result;
}

function getDataFromAmazonPaymentsString(
  s: string,
  closeDate: Date,
  orderTotal: number,
): TransactionData[] {
  const transactionData = s
    .split(AMAZON_PAYMENTS_TRANSACTION_DELIMITER)
    // Filter out empty strings
    .filter((s) => s.trim().length > 0)
    .map((transactionString) =>
      getTransactionDataFromAmazonPaymentsEntry(
        transactionString,
        closeDate,
        orderTotal,
      ),
    );

  console.log('⭐️ [getDataFromAmazonPaymentsString]', {
    sourceString: s,
    transactionData,
  });
  return transactionData;
}

/**
 * This is the primary function that takes Amazon DATA and creates labels out of it
 * @param orders
 * @returns
 */
export function getLabelsFromAmazonOrders(
  orders: AmazonOrdersCsvImportType[],
): StandardTransactionTypeWithLabelElements[] {
  /**
   * NOTE: We may not need this order occurrence counting, as the data we're using from the amazon transaction
   * scraper is a list of orders, so there shouldn't be duplicates
   */
  // Count the total number of occurrences of each order_id, so that we can
  // know in advance if there will be multiple labels for the same order_id.
  const orderIdTotalOccurrenceCounter: {[key: string]: number} = {};

  orders.forEach((order) => {
    orderIdTotalOccurrenceCounter[order.order_id] =
      (orderIdTotalOccurrenceCounter[order.order_id] ?? 0) + 1;
  });

  // Count the ongoing number of occurrences of each order_id, so that we can
  // know what number (ie 2 of 4) occurrence this is.
  const orderIdOngoingOccurrenceCounter: {[key: string]: number} = {};

  // We use flatMap here because each order can have multiple transactions
  const labelsFromOrdersNullable: Array<StandardTransactionTypeWithLabelElements | null> =
    orders.flatMap((order) => {
      const id = order.order_id;
      if (orderIdOngoingOccurrenceCounter[id] == null) {
        orderIdOngoingOccurrenceCounter[id] = 0;
      }
      orderIdOngoingOccurrenceCounter[id] += 1;

      const labelId =
        orderIdTotalOccurrenceCounter[id]! === 1
          ? id
          : `${id}__${orderIdOngoingOccurrenceCounter[id]}_of_${orderIdTotalOccurrenceCounter[id]})`;

      const parsedOrderTotal = parseLocaleNumber(order.total);
      const parsedDate = new Date(order.date);

      // TODO: For digital orders sometimes the order total is empty, but the payments field contains a date and amount. Use that if possible.
      if (isNaN(parsedOrderTotal)) {
        console.warn(
          '[getLabelsFromAmazonOrders] parsedOrderTotal is NaN; skipping order entry',
          order,
        );
        return null;
      }
      if (isNaN(parsedDate.valueOf())) {
        console.warn(
          '[getLabelsFromAmazonOrders] parsedDate is NaN; skipping order entry',
          order,
        );
        return null;
      }

      const transactionData = getDataFromAmazonPaymentsString(
        order.payments,
        parsedDate,
        parsedOrderTotal,
      ).filter(
        (transaction) => transaction.amount != null && transaction.date != null,
      ) as TransactionDataNonNullable[];

      const transactionDataTotal = transactionData.reduce(
        (acc, curr) => acc + (curr.amount ?? 0),
        0,
      );

      const orderURLMaybeShortened = SHORTEN_AMAZON_LINKS
        ? shortenAmazonOrderURL(order.order_url)
        : order.order_url;

      const charactersSaved =
        order.order_url.length - orderURLMaybeShortened.length;
      if (charactersSaved > 0) {
        console.debug(
          `[getLabelsFromAmazonOrders] shortened URL saved ${charactersSaved} characters.`,
        );
      }

      /**
       * Create a label based on the order itself as a fallback in case we can't
       * glean any information from the transaction data
       */
      const orderLabel = {
        // The convention for the standard transaction type is that outflows are negative
        amount: -1 * parsedOrderTotal,
        date: order.date,
        id: labelId,
        memo: [
          {
            flexShrink: 1,
            onOverflow: ON_TRUNCATE_TYPES.truncate,
            value: order.items,
          },
          {
            flexShrink: 0,
            onOverflow: ON_TRUNCATE_TYPES.omit,
            value: orderURLMaybeShortened,
          },
        ],
        payee: AMAZON_PAYEE_NAME,
      };

      if (transactionData.length === 0) {
        console.warn(
          '[getLabelsFromAmazonOrders] no viable transactions from payment data. Bailing on using transaction data.',
          {order, transactionData},
        );
        return orderLabel;
      }

      if (transactionDataTotal !== parsedOrderTotal) {
        console.warn(
          '[getLabelsFromAmazonOrders] transaction data from order did not add up to order total. Bailing on using transaction data.',
          {parsedOrderTotal, transactionData},
        );
        return orderLabel;
      }

      return (transactionData as TransactionDataNonNullable[]).map(
        (transaction, i): StandardTransactionTypeWithLabelElements => {
          const transactionId =
            transactionData.length === 1
              ? labelId
              : `${labelId}__${i + 1}_of_${transactionData.length}`;

          const memo: LabelElement[] = [
            transactionData.length > 1
              ? {
                  flexShrink: 0,
                  onOverflow: ON_TRUNCATE_TYPES.omit,
                  value: `(charge ${i + 1}/${transactionData.length})`,
                }
              : null,
            {
              flexShrink: 1,
              onOverflow: ON_TRUNCATE_TYPES.truncate,
              value: order.items,
            },
            {
              flexShrink: 0,
              onOverflow: ON_TRUNCATE_TYPES.omit,
              value: orderURLMaybeShortened,
            },
          ].filter(isNonNullable);

          return {
            // The convention for the standard transaction type is that outflows are negative
            amount: -1 * transaction.amount,
            date: getDateString(transaction.date),
            id: transactionId,
            memo: memo,
            payee: AMAZON_PAYEE_NAME,
          };
        },
      );
    });

  return labelsFromOrdersNullable.filter(isNonNullable);
}

export function getLabelsFromCsv(
  csvText: string,
): StandardTransactionTypeWithLabelElements[] {
  return convertParsedLabelsToStandardTransaction(
    getParsedLabelsFromCsv(csvText),
  );
}

export function convertParsedLabelsToStandardTransaction(
  parsedLabels: ParsedLabelsTyped,
): StandardTransactionTypeWithLabelElements[] {
  switch (parsedLabels._type) {
    case 'amazon': {
      return getLabelsFromAmazonOrders(parsedLabels.labels);
    }
    case 'ynab': {
      return convertYnabCsvToStandardTransaction(parsedLabels.labels);
    }
  }
}

export function convertYnabTransactionToStandardTransactionWithLabelElements(
  ynabTransaction: TransactionDetail,
): StandardTransactionTypeWithLabelElements {
  return {
    amount: ynab.utils.convertMilliUnitsToCurrencyAmount(
      ynabTransaction.amount,
    ),
    date: ynabTransaction.date,
    id: ynabTransaction.id,
    memo: [
      {
        flexShrink: 0,
        onOverflow: ON_TRUNCATE_TYPES.truncate,
        value: ynabTransaction.memo ?? '',
      },
    ],
    payee: ynabTransaction.payee_name ?? '',
  };
}

export function convertYnabTransactionArrayToStandardTransactionWithLabelElements(
  ynabTransactions: TransactionDetail[],
): StandardTransactionTypeWithLabelElements[] {
  return ynabTransactions.map(
    convertYnabTransactionToStandardTransactionWithLabelElements,
  );
}

export function convertYnabCsvToStandardTransaction(
  ynabCsvTransactions: YnabCsvTransactionType[],
): StandardTransactionTypeWithLabelElements[] {
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
      memo: [
        {
          flexShrink: 0,
          onOverflow: ON_TRUNCATE_TYPES.truncate,
          value: t.memo ?? '',
        },
      ],
      payee: t.payee,
    };
  });
}
