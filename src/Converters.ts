import type {LabelElement} from './LabelElements';
import type {TransactionDetail} from 'ynab';

import {v4 as uuidv4} from 'uuid';
import * as ynab from 'ynab';

import {getAmazonOrderLabelElements} from './AmazonLinks';
import {
  areEqualWithPrecision,
  HARDCODED_CURRENCY_DECIMAL_DIGITS,
  parseLocaleNumber,
} from './Currency';
import {getDateString} from './DateUtils';
import exhaustivenessCheck from './exhaustivenessCheck';
import isNonNullable from './isNonNullable';
import {ON_TRUNCATE_TYPES} from './LabelElements';
import {type ParsedLabelsTyped} from './LabelParser';
import {
  AMAZON_PAYEE_NAME,
  type AmazonOrdersCsvImportType,
  type StandardTransactionTypeWithLabelElements,
  type YnabCsvTransactionType,
} from './LabelTypes';
import {getLabelsFromTargetOrderData} from './TargetConverters';

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

export type ConverterOptionsConfig = {
  includeLinks: boolean;
  linkType: 'markdown' | 'plain';
  shortenLinks: boolean;
};

type ConvertParsedLabelConfig = {
  amazonConfig: ConverterOptionsConfig;
};

// TODO: Don't hardcode this
const TARGET_PAYMENT_DEFAULT_NAME = 'TARGETCREDIT';

const AMAZON_PAYMENTS_STRING_DELIMITER = ':';
const AMAZON_PAYMENTS_TRANSACTION_DELIMITER = ';';

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const YEAR_IN_MS = DAY_IN_MS * 365.25;
// const FUTURE_DATE_DISTANCE_LIMIT = YEAR_IN_MS * 1;
// const PAST_DATE_DISTANCE_LIMIT = YEAR_IN_MS * 20;

const MAX_DISTANCE_FROM_CLOSE_DATE = YEAR_IN_MS / 2;
const AMAZON_HARDCODED_RETURN_DATE_WINDOW_MS = DAY_IN_MS * 61;

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

  // console.debug('⭐️ [getDataFromAmazonPaymentsString]', {
  //   sourceString: s,
  //   transactionData,
  // });
  return transactionData;
}

/**
 * This is the primary function that takes Amazon DATA and creates labels out of it
 * @param orders
 * @returns
 */
export function getLabelsFromAmazonOrders(
  orders: AmazonOrdersCsvImportType[],
  config: ConverterOptionsConfig,
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
      const parsedRefundTotal = parseLocaleNumber(order.refund);
      const parsedDate = new Date(order.date);

      // TODO: For digital orders sometimes the order total is empty, but the payments field contains a date and amount. Use that if possible.
      if (isNaN(parsedOrderTotal)) {
        console.debug(
          '[getLabelsFromAmazonOrders] parsedOrderTotal is NaN; skipping order entry',
          order,
        );
        return null;
      }
      if (isNaN(parsedDate.valueOf())) {
        console.debug(
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

      // NOTE: This can lead to floating point numbers like 54.68000000000001, so it's imperative here that we handle that down below when we compare this to the parsed order total
      const transactionDataTotal = transactionData.reduce(
        (acc, curr) => acc + (curr.amount ?? 0),
        0,
      );

      const orderLabelElements: LabelElement[] = getAmazonOrderLabelElements({
        config,
        items: order.items,
        url: order.order_url,
      });

      /**
       * Order Level Labels - labels that pertain to the order as a whole, rather than to individual transactions
       *
       * Create a label based on the order itself as a fallback in case we can't
       * glean any information from the transaction data
       */
      const orderLabel: StandardTransactionTypeWithLabelElements = {
        // The convention for the standard transaction type is that outflows are negative
        amount: -1 * parsedOrderTotal,
        date: order.date,
        id: labelId,
        memo: orderLabelElements,
        payee: AMAZON_PAYEE_NAME,
      };

      /**
       * Refunds are tricky, because we don't currently have access to return transaction data.
       * For now, let's just add a label for the refund amount if it exists.
       */
      let refundLabel: StandardTransactionTypeWithLabelElements | null = null;

      if (!isNaN(parsedRefundTotal) && parsedRefundTotal > 0) {
        refundLabel = {
          // This should be a positive number
          amount: parsedRefundTotal,
          // This is tricky... we don't actually have the date for the refund. And since returns are often made > 2 weeks we will likely miss matches
          date: order.date,
          id: `${labelId}__return`,
          memo: [
            {
              flexShrink: 0,
              onOverflow: ON_TRUNCATE_TYPES.omit,
              value: '(Return)',
            },
            ...orderLabelElements,
          ],
          metaData: {
            dateRangeEnd: new Date(
              Date.now() + AMAZON_HARDCODED_RETURN_DATE_WINDOW_MS,
            ),
          },
          payee: AMAZON_PAYEE_NAME,
        };
      }

      if (transactionData.length === 0) {
        console.debug(
          '[getLabelsFromAmazonOrders] no viable transactions from payment data. Bailing on using transaction data.',
          {order, transactionData},
        );
        return [orderLabel, refundLabel];
      }

      if (
        !areEqualWithPrecision(
          transactionDataTotal,
          parsedOrderTotal,
          HARDCODED_CURRENCY_DECIMAL_DIGITS,
        )
      ) {
        console.warn(
          '[getLabelsFromAmazonOrders] transaction data from order did not add up to order total. Bailing on using transaction data.',
          {parsedOrderTotal, transactionData, transactionDataTotal},
        );
        return [orderLabel, refundLabel];
      }

      const transactionLabels = (
        transactionData as TransactionDataNonNullable[]
      ).map((transaction, i): StandardTransactionTypeWithLabelElements => {
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
          ...orderLabelElements,
        ].filter(isNonNullable);

        return {
          // The convention for the standard transaction type is that outflows are negative
          amount: -1 * transaction.amount,
          date: getDateString(transaction.date),
          id: transactionId,
          memo: memo,
          payee: AMAZON_PAYEE_NAME,
        };
      });

      // NOTE: The transaction labels take the place of the order label, but not the refund label
      return [refundLabel, ...transactionLabels];
    });

  return labelsFromOrdersNullable.filter(isNonNullable);
}

// export function getLabelsFromCsv(
//   csvText: string,
// ): StandardTransactionTypeWithLabelElements[] {
//   return convertParsedLabelsToStandardTransaction(
//     getParsedLabelsFromCsv(csvText),
//   );
// }

export function convertParsedLabelsToStandardTransaction(
  parsedLabels: ParsedLabelsTyped,
  config: ConvertParsedLabelConfig,
): StandardTransactionTypeWithLabelElements[] {
  switch (parsedLabels._type) {
    case 'amazon': {
      return getLabelsFromAmazonOrders(
        parsedLabels.labels,
        config.amazonConfig,
      );
    }
    case 'ynab': {
      return convertYnabCsvToStandardTransaction(parsedLabels.labels);
    }
    case 'target': {
      return getLabelsFromTargetOrderData(parsedLabels.labels, {
        cardType: TARGET_PAYMENT_DEFAULT_NAME,
        groupByProductCategory: true,
        includeLinks: false,
        includePricesForGroupedItemsInMemo: true,
        linkType: 'plain',
        shortenLinks: false,
      });
    }
    default: {
      exhaustivenessCheck(parsedLabels);
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
