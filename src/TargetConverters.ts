import type {ConverterOptionsConfig} from './Converters';
import type {StandardTransactionTypeWithLabelElements} from './LabelTypes';
import type {
  CombinedOutputData,
  InvoiceDetail,
  PaymentDetail,
} from './TargetAPITypes';
import type {ProductCategoryLookupFunction} from './TargetCategories';

import {type SaveSubTransaction, utils as ynabUtils} from 'ynab';

import {
  areEqualWithPrecision,
  convertUSDToMilliunits,
  getFormattedAmount,
  HARDCODED_CURRENCY_DECIMAL_DIGITS,
  hasUnexpectedDigitsOfPrecision,
} from './Currency';
import {getDateString, getPrettyDateTimeString} from './DateUtils';
import isNonNullable from './isNonNullable';
import {
  type LabelElement,
  ON_TRUNCATE_TYPES,
  renderLabel,
} from './LabelElements';
import {trimToYNABMaxMemoLength, YNAB_MAX_MEMO_LENGTH} from './Sync';
import {
  DEFAULT_PRODUCT_CATEGORY,
  getProductCategoryLookupFunction,
} from './TargetCategories';
import {htmlEntityDecode} from './Utils';

export type TargetConverterOptionsConfig = ConverterOptionsConfig & {
  /**
   * For the target card this is "TARGETCREDIT". Whether we use this or another field we need some
   * way to determine which payments entry is the credit/debit card (or cash??) that we want for importing to YNAB.
   * We may want to also rely on sub_type_value and/or display_card_number. Not sure how this will look for cash.
   *
   * We should just fetch all the payments used in the imported data and let the user choose which one they want to
   * generate transactions for, surfacing the ones thatimport config from '../jest.config';
 seem most sensible (and/or the ones that are the most prevalent in the data).
   */
  cardType: string;

  groupByProductCategory: boolean;

  includePricesForGroupedItemsInMemo: boolean;
};

type InvoiceLineItemData = {
  alwaysItemizeIndividually: boolean;
  amount: number;
  category: string | null;
  description: string | null;
  quantity: number;
  tcin: string | null;
  type: 'adjustment' | 'groupedLineItems' | 'lineItem' | 'payment';
};

type SaveSubTransactionWithTargetLineData = SaveSubTransaction & {
  _invoiceLineItemData: InvoiceLineItemData;
};

const SINGLE_SPACE = ' ';
const NO_DESCRIPTION_TEXT = '(no description)';
const NO_LINE_ITEMS_TEXT = '(no line items)';
const LINE_ITEM_DESCRIPTION_MAX_WORD_COUNT = 3;

// TODO: Change this back to commas, and create a way to have the comma immediately follow the text before it, but leave a space afterwards
// OR... just create a single label element for the whole comma separated string, since that should have the same effect in the current system.
const separatorLabelElement: LabelElement = {
  flexShrink: 1,
  onOverflow: ON_TRUNCATE_TYPES.omit,
  value: '|',
};

type PairedInvoiceCharge = {
  date: Date;
  invoiceID: string;
  pairedChargeInverseAmountInvoiceID: string | null;
  totalChargedToCard: number | null;
};

function getPairedInvoiceCharges({
  invoicesData,
  config,
  orderNumber,
}: {
  config: TargetConverterOptionsConfig;
  invoicesData: InvoiceDetail[];
  orderNumber: string;
}): PairedInvoiceCharge[] {
  // Determine whether the whole order was refunded, and add an annotation if so
  const invoiceCharges = invoicesData.map<PairedInvoiceCharge>(
    (invoiceDetail) => {
      // Reminder: totalChargedToCard is negative for a debit, positive for a credit/refund
      const {totalChargedToCard} = getCardPaymentBreakdown({
        config,
        invoiceDetail,
        orderNumber: orderNumber,
      });

      return {
        date: invoiceDetail.date,
        invoiceID: invoiceDetail.id,
        pairedChargeInverseAmountInvoiceID: null,
        totalChargedToCard,
      };
    },
  );

  invoiceCharges.forEach((mainCharge) => {
    if (
      mainCharge.pairedChargeInverseAmountInvoiceID == null &&
      invoiceCharges.length > 1
    ) {
      invoiceCharges
        .filter(
          (c) =>
            c.invoiceID !== mainCharge.invoiceID &&
            c.pairedChargeInverseAmountInvoiceID == null,
        )
        .forEach((otherInvoiceCharge) => {
          if (
            mainCharge.totalChargedToCard != null &&
            otherInvoiceCharge.totalChargedToCard != null &&
            areEqualWithPrecision(
              mainCharge.totalChargedToCard,
              -1 * otherInvoiceCharge.totalChargedToCard,
              HARDCODED_CURRENCY_DECIMAL_DIGITS,
            )
          ) {
            mainCharge.pairedChargeInverseAmountInvoiceID =
              otherInvoiceCharge.invoiceID;
            otherInvoiceCharge.pairedChargeInverseAmountInvoiceID =
              mainCharge.invoiceID;
          }
        });
    }
  });

  return invoiceCharges;
}

// TODO: Add option to include dollar amount for each item, and then use this to create a memo when we optionally group subtransactions by category
function getCombinedDescriptionForInvoiceLineItems({
  items,
  lineItemDescriptionMaxWordCount,
  isRefund,
  includePricesForGroupedItemsInMemo,
}: {
  includePricesForGroupedItemsInMemo: boolean;
  isRefund: boolean;
  items: InvoiceLineItemData[];
  lineItemDescriptionMaxWordCount: number | null;
}): LabelElement[] {
  const itemsSorted = items
    .slice()
    .sort((a, b) => (isRefund ? b.amount - a.amount : a.amount - b.amount));

  const combinedDescription: LabelElement[] = itemsSorted.flatMap((item, i) => {
    const newDescription =
      (lineItemDescriptionMaxWordCount != null
        ? item.description
            ?.split(SINGLE_SPACE)
            .slice(0, lineItemDescriptionMaxWordCount)
            .join(SINGLE_SPACE)
        : item.description) ?? NO_DESCRIPTION_TEXT;

    const itemLabelElement: LabelElement[] = [
      includePricesForGroupedItemsInMemo && itemsSorted.length > 1
        ? {
            flexShrink: 1,
            onOverflow: ON_TRUNCATE_TYPES.omit,
            // Use the absolute value, since distinguishing between positive/negative probably isn't needed in the memo string
            value: getFormattedAmount(Math.abs(item.amount)),
          }
        : null,
      {
        flexShrink: 1,
        onOverflow: ON_TRUNCATE_TYPES.truncate,
        value:
          (item.quantity > 1 ? `${item.quantity}x ` : '') +
          (newDescription ?? NO_DESCRIPTION_TEXT),
      },
    ].filter(isNonNullable);

    if (i < itemsSorted.length - 1) {
      return itemLabelElement.concat([separatorLabelElement]);
    }

    return itemLabelElement;
  });

  return combinedDescription.length > 0
    ? combinedDescription
    : [
        {
          flexShrink: 1,
          onOverflow: ON_TRUNCATE_TYPES.truncate,
          value: NO_LINE_ITEMS_TEXT,
        },
      ];
}

function getCardPaymentBreakdown({
  invoiceDetail,
  config,
  orderNumber,
}: {
  config: TargetConverterOptionsConfig;
  invoiceDetail: InvoiceDetail;
  orderNumber: string;
}): {
  otherPayments: PaymentDetail[];
  primaryCardPayment: PaymentDetail | null;
  totalChargedToCard: number | null;
} {
  let primaryCardPayment: PaymentDetail | null = null;
  let otherPayments: PaymentDetail[] = [];

  invoiceDetail.payments.forEach((p) => {
    if (p.type === config.cardType) {
      if (primaryCardPayment == null) {
        primaryCardPayment = p;
      } else {
        console.warn(
          `[getSubtransactionsFromInvoiceDetail] Expected exactly 0 or 1 card payments per invoice, but found more than one. Using the first one found.`,
          {
            _orderNumber: orderNumber,
            payments: invoiceDetail.payments,
          },
        );
        // We should still add this to other payments since it will impact the order total
        otherPayments.push(p);
      }
    } else {
      otherPayments.push(p);
    }
  });

  // @ts-ignore ts(2339) - not sure why it thinks primaryCardPayment is never type
  const totalChargedPositive = primaryCardPayment?.total_charged ?? null;
  // We depend on this value being negative in other parts of the code, as in a debit
  const totalCharged =
    totalChargedPositive != null ? -1 * totalChargedPositive : null;

  return {
    otherPayments,
    primaryCardPayment: primaryCardPayment,
    totalChargedToCard: totalCharged,
  };
}

type SubtransactionGroupWithCategory = {
  alwaysItemizeIndividually: boolean;

  // categoryString is the actual string representation we are using for display and sorting
  categoryString: string;

  categoryTotalMillis: number;
  subtransactions: SaveSubTransactionWithTargetLineData[];
};

function groupAndSortSubtransactionsByCategory({
  config,
  subtransactions,
  isRefund,
}: {
  config: TargetConverterOptionsConfig;
  isRefund: boolean;
  subtransactions: SaveSubTransactionWithTargetLineData[];
}): SaveSubTransactionWithTargetLineData[] {
  const categoryBucketsForSubtransactions: Record<
    string, // category
    SubtransactionGroupWithCategory
  > = {};

  // Group subtransactions by category
  subtransactions.forEach((currentSubtransaction) => {
    const categoryString =
      currentSubtransaction._invoiceLineItemData.category ??
      DEFAULT_PRODUCT_CATEGORY;

    const alwaysItemizeIndividually =
      currentSubtransaction._invoiceLineItemData.alwaysItemizeIndividually;

    const previousSubtransactionGroupWithCategory =
      categoryBucketsForSubtransactions[categoryString] ?? {
        alwaysItemizeIndividually,
        categoryString: categoryString,
        categoryTotalMillis: 0,
        subtransactions: [],
      };

    // Sanity check
    if (
      previousSubtransactionGroupWithCategory.alwaysItemizeIndividually !==
      alwaysItemizeIndividually
    ) {
      console.warn(
        `[groupAndSortSubtransactionsByCategory] Found a mix of alwaysItemizeIndividually values for category ${categoryString}. Using the first one found.`,
        {
          alwaysItemizeIndividually,
          previousSubtransactionGroupWithCategory,
        },
      );
    }

    const newSubtransactionGroupWithCategory = {
      alwaysItemizeIndividually:
        previousSubtransactionGroupWithCategory.alwaysItemizeIndividually,
      categoryString,
      categoryTotalMillis:
        previousSubtransactionGroupWithCategory.categoryTotalMillis +
        currentSubtransaction.amount,
      subtransactions:
        previousSubtransactionGroupWithCategory.subtransactions.concat([
          currentSubtransaction,
        ]),
    };

    categoryBucketsForSubtransactions[categoryString] =
      newSubtransactionGroupWithCategory;

    return;
  });

  const subtransactionGroups = Object.values(categoryBucketsForSubtransactions);

  /**
   * Final sorting and grouping
   *
   * What we want to do here is have the subtransaction groups show up in descending order
   * based on their amount, but also have all subtransaction groups with the same category
   * show up together:
   *
   * Grocery $50
   * Health & Beauty $30
   * Health & Beauty $5
   * Electronics $20
   * Office Supplies $15
   * Office Supplies $2
   *
   * We accomplish this by first sorting all the groups by amount, and then iterating through
   * that list to temporarily re-group them by category, and then finally flattening that list
   */
  const sortedSubtransactionGroups = subtransactionGroups
    .slice()
    .sort((a, b) => {
      // // Sort by category first, then by total amount from highest to lowest
      // const localeCompared = a.category.localeCompare(b.category);
      // if (localeCompared !== 0) {
      //   return localeCompared;
      // }

      // Sort by total amount in descending order
      return isRefund
        ? b.categoryTotalMillis - a.categoryTotalMillis
        : a.categoryTotalMillis - b.categoryTotalMillis;
    });

  // // Now group any other subtransactions of the same category under the first one to show up when sorted by amount
  // const subtransactionsGroupedByCategory: Array<{
  //   category: string;
  //   subtransactionGroups: Array<SubtransactionGroupWithCategory>;
  // }> = [];

  // sortedSubtransactionGroups.forEach((subtransactionGroup) => {
  //   const {category} = subtransactionGroup;

  //   const bucket = subtransactionsGroupedByCategory.find(
  //     (e) => e.category === category,
  //   );

  //   if (bucket != null) {
  //     bucket.subtransactionGroups.push(subtransactionGroup);
  //     return;
  //   }

  //   subtransactionsGroupedByCategory.push({
  //     category,
  //     subtransactionGroups: [subtransactionGroup],
  //   });
  // });

  const finalizedSortedSubtransactionGroups: Array<SubtransactionGroupWithCategory> =
    sortedSubtransactionGroups
      .map((g) => {
        if (g.alwaysItemizeIndividually) {
          return g.subtransactions.map((st) => ({
            alwaysItemizeIndividually: g.alwaysItemizeIndividually,
            categoryString: g.categoryString,
            categoryTotalMillis: st.amount,
            subtransactions: [st],
          }));
        }

        return g;
      })
      .flat();

  /**
   * [END] Final sorting and grouping
   */

  const groupedSubtransactions: SaveSubTransactionWithTargetLineData[] =
    finalizedSortedSubtransactionGroups.map((group) => {
      const {
        categoryString,
        subtransactions: subtransactionsInCategory,
        categoryTotalMillis,
      } = group;

      const categoryLabelElement: LabelElement = {
        flexShrink: 1,
        onOverflow: 'truncate',
        value: categoryString,
      };

      const combinedDescriptionLabelElements =
        getCombinedDescriptionForInvoiceLineItems({
          includePricesForGroupedItemsInMemo:
            config.includePricesForGroupedItemsInMemo,
          isRefund,
          items: subtransactionsInCategory.map((st) => st._invoiceLineItemData),
          lineItemDescriptionMaxWordCount: LINE_ITEM_DESCRIPTION_MAX_WORD_COUNT,
        });

      const memo = renderLabel(
        [categoryLabelElement].concat(combinedDescriptionLabelElements),
        YNAB_MAX_MEMO_LENGTH,
      );

      return {
        _invoiceLineItemData: {
          alwaysItemizeIndividually: false,
          amount: ynabUtils.convertMilliUnitsToCurrencyAmount(
            categoryTotalMillis,
            HARDCODED_CURRENCY_DECIMAL_DIGITS,
          ),
          category: categoryString,
          description: memo,
          quantity: 1,
          tcin: null,
          type: 'groupedLineItems' as const,
        },
        amount: categoryTotalMillis,
        memo: memo,
      };
    });

  return groupedSubtransactions;
}

function getSubtransactionsFromInvoiceDetail({
  invoiceDetail,
  productCategoryLookupFunction,
  otherPayments,
  totalChargedToCard,
  config,
  isRefund,
}: {
  config: TargetConverterOptionsConfig;
  invoiceDetail: InvoiceDetail;
  isRefund: boolean;
  otherPayments: PaymentDetail[];
  productCategoryLookupFunction: ProductCategoryLookupFunction;
  totalChargedToCard: number;
}): SaveSubTransactionWithTargetLineData[] | null {
  const {groupByProductCategory} = config;

  /**
   * TODO: Grab any other non-credit card payments and add them to the subtransactions, as they are a necessary
   * part of understanding how an invoice adds up to the total charged to the card. The invoice might have a
   * $5 gift card, for example, in which case we have a choice:
   *
   * 1) the more "correct" thing to do would be to add it as a subtransaction and allow the user to categorize it
   * however they want in YNAB.
   *
   * 2) The more practical thing would be to take any gift card amounts like that and evenly distribute them as a
   * discount across each item, proportional to the item cost. Most people will likely want this, except if they were
   * intending for the gift card to cover one specific item in the overall order.
   *
   * We could build both, and let the user decide.
   */

  const subTransactionsUngrouped: SaveSubTransactionWithTargetLineData[] =
    invoiceDetail.lines.map((line) => {
      const description =
        line.item.description != null
          ? htmlEntityDecode(line.item.description)
          : '(no item description)';

      const newMemoNotTruncated =
        (line.shipped_quantity > 1 ? `${line.shipped_quantity}x ` : '') +
        (description ?? '(no item description)');

      const {category, alwaysItemizeIndividually} =
        productCategoryLookupFunction(line.item.tcin);

      return {
        _invoiceLineItemData: {
          alwaysItemizeIndividually,
          amount: -1 * line.effective_amount,
          category: category,
          description: description,
          quantity: line.shipped_quantity,
          tcin: line.item.tcin,
          type: 'lineItem' as const,
        },
        // Flip the sign since we're now considering this a debit on a bank account
        amount: -1 * convertUSDToMilliunits(line.effective_amount),
        // TODO: ⭐ where is this memo actually used??
        memo: trimToYNABMaxMemoLength(
          `???WHERE_USED??? ${category} ${newMemoNotTruncated}`,
        ),
        // payee_name: 'Target',
      };
    });

  const subTransactions = groupByProductCategory
    ? groupAndSortSubtransactionsByCategory({
        config,
        isRefund,
        subtransactions: subTransactionsUngrouped,
      })
    : subTransactionsUngrouped;

  // // Sort the most expensive items (aka lowest, since outflows are negative)
  // const subTransactions = subTransactionsUnsorted
  //   .slice()
  //   .sort((a, b) => (isRefund ? b.amount - a.amount : a.amount - b.amount));

  otherPayments.forEach((p) => {
    if (p.total_charged === 0) {
      console.log(
        '[getSubtransactionsFromInvoiceDetail] Encountered a payment with amount of 0. Skipping...',
        {invoiceDetail, payment: p},
      );
      return;
    }
    const description =
      p.sub_type_value != null
        ? htmlEntityDecode(p.sub_type_value)
        : '(unknown payment type)';

    subTransactions.push({
      _invoiceLineItemData: {
        alwaysItemizeIndividually: true,
        amount: p.total_charged,
        category: null,
        description: description,
        quantity: 1,
        tcin: null,
        type: 'payment' as const,
      },
      amount: convertUSDToMilliunits(p.total_charged), // This should be a positive value since it's treated as a credit
      memo: trimToYNABMaxMemoLength(description),
    });
  });

  const subTransactionsTotalMilliunits = subTransactions.reduce(
    (acc, subT) => acc + subT.amount,
    0,
  );

  const totalChargedToCardMilliunits =
    convertUSDToMilliunits(totalChargedToCard);

  const subTransactionDiscrepancyFromTotal =
    totalChargedToCardMilliunits - subTransactionsTotalMilliunits;

  // console.log('Adjustment data:', {
  //   invoiceID: invoiceDetail.id,
  //   subTransactionDiscrepancyFromTotal,
  //   subTransactionsTotalMilliunits,
  //   totalChargedToCard,
  //   totalChargedToCardMilliunits,
  // });

  // NOTE: We shouldn't have any extra digits of precision here since we're working with milliunits, but worth checking in any case
  if (hasUnexpectedDigitsOfPrecision(subTransactionDiscrepancyFromTotal, 0)) {
    console.error(
      `[getSubtransactionsFromInvoiceDetail] Unexpected digits of precision in subTransactionDiscrepancyFromTotal for invoice ${invoiceDetail.id}.`,
      {
        discrepancy: subTransactionDiscrepancyFromTotal,
        invoiceDetail,
        subTransactions,
      },
    );
  }

  if (subTransactionDiscrepancyFromTotal !== 0) {
    console.log(
      `[getSubtransactionsFromInvoiceDetail] Discrepancy between total charged to card and sum of subtransactions for invoice ${invoiceDetail.id}.`,
      {
        discrepancy: subTransactionDiscrepancyFromTotal,
        invoiceDetail,
        subTransactions,
      },
    );
    const description =
      '(adjustment: unknown discrepancy between item subtotals and total charged to card)';

    subTransactions.push({
      _invoiceLineItemData: {
        alwaysItemizeIndividually: true,
        amount: ynabUtils.convertMilliUnitsToCurrencyAmount(
          subTransactionDiscrepancyFromTotal,
        ),
        category: null,
        description: description,
        quantity: 1,
        tcin: null,
        type: 'adjustment' as const,
      },
      amount: subTransactionDiscrepancyFromTotal,
      memo: description,
    });
  }

  return subTransactions;
}

function getTargetInvoiceURL(orderID: string, invoiceID: string): string {
  // NOTE: we exclude www. here to keep the URL shorter
  return `https://target.com/orders/${orderID}/invoices/${invoiceID}`;
}

export function getLabelsFromTargetOrderData(
  data: CombinedOutputData,
  config: TargetConverterOptionsConfig,
): StandardTransactionTypeWithLabelElements[] {
  console.debug('⭐ [getLabelsFromTargetOrderData]');

  /**
   * Iterate through each order (invoiceAndOrderData pertains to a single order, but can contain multiple invoices),
   * and generate transactions from each of the invoices that uses config.cardType as the payment type.
   */
  const transactions: StandardTransactionTypeWithLabelElements[] =
    data.invoiceAndOrderData.flatMap(
      (invoiceAndOrderDataEntry, _invoiceAndOrderDataIndex) => {
        const {_orderNumber: orderNumber} = invoiceAndOrderDataEntry;
        const productCategoryLookupFunction = getProductCategoryLookupFunction(
          invoiceAndOrderDataEntry.orderAggregationsData,
        );

        const pairedInvoiceCharges = getPairedInvoiceCharges({
          config,
          invoicesData: invoiceAndOrderDataEntry.invoicesData,
          orderNumber,
        });

        // console.log(
        //   `Invoice charges for order ${orderNumber}:`,
        //   pairedInvoiceCharges,
        // );

        const transactionsFromInvoiceData =
          invoiceAndOrderDataEntry.invoicesData.map(
            (
              invoiceDetail,
            ): StandardTransactionTypeWithLabelElements | null => {
              const {otherPayments, primaryCardPayment, totalChargedToCard} =
                getCardPaymentBreakdown({
                  config,
                  invoiceDetail,
                  orderNumber: invoiceAndOrderDataEntry._orderNumber,
                });

              if (primaryCardPayment == null || totalChargedToCard == null) {
                console.info(
                  `[getSubtransactionsFromInvoiceDetail] No primary card payment found for invoice ${invoiceDetail.id}. Skipping.`,
                );
                return null;
              }

              const isRefund = totalChargedToCard > 0;

              const subTransactions = getSubtransactionsFromInvoiceDetail({
                config,
                invoiceDetail,
                isRefund,
                otherPayments,
                productCategoryLookupFunction,
                totalChargedToCard,
              });

              const subTransactionsNonNullable = subTransactions ?? [];

              const maxWordCount = config.groupByProductCategory
                ? null
                : subTransactionsNonNullable.length > 1
                ? LINE_ITEM_DESCRIPTION_MAX_WORD_COUNT
                : null;

              const memoLabelBase = getCombinedDescriptionForInvoiceLineItems({
                // We don't want to include prices in the main transaction memo since they'll be visible in the subtransactions/subtransaction memos
                includePricesForGroupedItemsInMemo: false,
                isRefund,
                items: subTransactionsNonNullable.map(
                  (st) => st._invoiceLineItemData,
                ),
                lineItemDescriptionMaxWordCount: maxWordCount,
              });

              // This is the chargeObject of the invoice that's paired with this one
              const pairedInvoiceChargeObject = pairedInvoiceCharges.find(
                (c) =>
                  c.pairedChargeInverseAmountInvoiceID === invoiceDetail.id,
              );

              const refundLabelElements: LabelElement[] = [];

              if (pairedInvoiceChargeObject?.totalChargedToCard != null) {
                if (pairedInvoiceChargeObject.totalChargedToCard > 0) {
                  // The paired invoice is a refund because, remember, totalChargedToCard is negative for a debit, positive for a credit/refund
                  refundLabelElements.push({
                    flexShrink: 1,
                    onOverflow: 'truncate',
                    value: `(Fully refunded on ${getDateString(
                      pairedInvoiceChargeObject.date,
                    )} #RefundPair)`,
                  });
                } else {
                  // The paired invoice is a charge
                  refundLabelElements.push({
                    flexShrink: 1,
                    onOverflow: 'truncate',
                    value: `(Full refund of ${getDateString(
                      pairedInvoiceChargeObject.date,
                    )} #RefundPair)`,
                  });
                }
              }

              const invoiceURL = getTargetInvoiceURL(
                orderNumber,
                invoiceDetail.id,
              );

              const invoiceURLLabelElements: LabelElement[] = [
                {flexShrink: 0, onOverflow: 'omit', value: invoiceURL},
              ];

              const memoLabel = refundLabelElements
                .concat(
                  subTransactionsNonNullable.length > 1 ? [] : memoLabelBase,
                )
                .concat(config.includeLinks ? invoiceURLLabelElements : []);

              const subTransactionsStripped =
                subTransactions != null && subTransactions.length > 1
                  ? subTransactions.map(({amount, memo}) => ({amount, memo}))
                  : null;

              return {
                amount: totalChargedToCard,
                date: getDateString(invoiceDetail.date),
                id: invoiceDetail.id,
                memo: memoLabel,
                payee: 'Target',
                subTransactions: subTransactionsStripped ?? undefined,
                // TODO: use tenant_key instead of hardcoding "Target"
                // payee: invoiceAndOrderDataEntry.orderHistoryData.tenant_key,
              };
            },
          );

        return transactionsFromInvoiceData.filter(isNonNullable);
      },
    );

  console.log(
    `Export timestamp: ${getPrettyDateTimeString(
      new Date(data._createdTimestamp),
    )} | Transactions:`,
  );
  // console.table(
  //   transactions.map((t) => ({...t, memo: renderLabel(t.memo, Infinity)})),
  // );

  console.table(
    transactions.map((t) => ({...t, memo: renderLabel(t.memo, 200)})),
  );

  return transactions;
}
