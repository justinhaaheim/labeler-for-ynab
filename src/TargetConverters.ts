import type {ConverterOptionsConfig} from './Converters';
import type {StandardTransactionTypeWithLabelElements} from './LabelTypes';
import type {SaveSubTransaction} from 'ynab';

import nullthrows from 'nullthrows';

import {convertUSDToMilliunits} from './Currency';
import {getDateString, getPrettyDateTimeString} from './DateUtils';
import isNonNullable from './isNonNullable';
import {
  type LabelElement,
  ON_TRUNCATE_TYPES,
  renderLabel,
} from './LabelElements';
import {trimToYNABMaxMemoLength} from './Sync';
import {type CombinedOutputData} from './TargetAPITypes';

export type TargetConverterOptionsConfig = ConverterOptionsConfig & {
  /**
   * For the target card this is "TARGETCREDIT". Whether we use this or another field we need some
   * way to determine which payments entry is the credit/debit card (or cash??) that we want for importing to YNAB.
   * We may want to also rely on sub_type_value and/or display_card_number. Not sure how this will look for cash.
   *
   * We should just fetch all the payments used in the imported data and let the user choose which one they want to
   * generate transactions for, surfacing the ones that seem most sensible (and/or the ones that are the most prevalent in the data).
   */
  cardType: string;
};

const SINGLE_SPACE = ' ';

// TODO: Change this back to commas, and create a way to have the comma immediately follow the text before it, but leave a space afterwards
const separatorLabelElement: LabelElement = {
  flexShrink: 1,
  onOverflow: ON_TRUNCATE_TYPES.omit,
  value: '|',
};

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
        const transactionsFromInvoiceData =
          invoiceAndOrderDataEntry.invoicesData.map(
            (
              invoiceDetail,
            ): StandardTransactionTypeWithLabelElements | null => {
              let primaryCardPayment:
                | (typeof invoiceDetail.payments)[number]
                | null = null;
              let otherPayments: typeof invoiceDetail.payments = [];

              invoiceDetail.payments.forEach((p) => {
                if (p.type === config.cardType) {
                  if (primaryCardPayment == null) {
                    primaryCardPayment = p;
                  } else {
                    console.warn(
                      `[getLabelsFromTargetOrderData] Expected exactly 0 or 1 card payments per invoice, but found more than one. Using the first one found.`,
                      {
                        _orderNumber: invoiceAndOrderDataEntry._orderNumber,
                        payments: invoiceDetail.payments,
                      },
                    );
                  }
                } else {
                  otherPayments.push(p);
                }
              });

              const filteredPayments = invoiceDetail.payments.filter(
                (p) => p.type === config.cardType,
              );

              if (filteredPayments.length > 1) {
                console.warn(
                  `[getLabelsFromTargetOrderData] Expected exactly 0 or 1 card payments per invoice, but found ${invoiceDetail.payments.length}.`,
                  {
                    _orderNumber: invoiceAndOrderDataEntry._orderNumber,
                    payments: invoiceDetail.payments,
                  },
                );
              }

              if (filteredPayments.length === 0) {
                console.info(
                  `[getLabelsFromTargetOrderData] No card payment found for invoice ${invoiceDetail.id}. Skipping.`,
                );
                return null;
              }

              // Flip the sign since we're now considering this a debit on a bank account
              const totalChargedToCard =
                -1 * nullthrows(filteredPayments[0]?.total_charged);

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

              const subTransactions: SaveSubTransaction[] =
                invoiceDetail.lines.map((line) => {
                  const newMemoNotTruncated =
                    (line.quantity > 1 ? `${line.quantity}x ` : '') +
                    (line.item.description ?? '(no item description)');
                  return {
                    // Flip the sign since we're now considering this a debit on a bank account
                    amount: -1 * convertUSDToMilliunits(line.effective_amount),
                    memo: trimToYNABMaxMemoLength(newMemoNotTruncated),
                    // payee_name: 'Target',
                  };
                });

              otherPayments.forEach((p) => {
                if (p.total_charged === 0) {
                  console.log(
                    '[getLabelsFromTargetOrderData] Encountered a payment with amount of 0. Skipping...',
                    {invoiceDetail, payment: p},
                  );
                  return;
                }

                subTransactions.push({
                  amount: convertUSDToMilliunits(p.total_charged), // This should be a positive value since it's treated as a credit
                  memo: trimToYNABMaxMemoLength(
                    p.sub_type_value ?? '(unknown payment type)',
                  ),
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

              if (subTransactionDiscrepancyFromTotal !== 0) {
                console.log(
                  `[getLabelsFromTargetOrderData] Discrepancy between total charged to card and sum of subtransactions for invoice ${invoiceDetail.id}.`,
                  {
                    discrepancy: subTransactionDiscrepancyFromTotal,
                    invoiceDetail,
                    subTransactions,
                  },
                );
                subTransactions.push({
                  amount: subTransactionDiscrepancyFromTotal,
                  memo: '(adjustment: unknown discrepancy between item subtotals and total charged to card)',
                });
              }

              const lineItemCount = invoiceDetail.lines.length;

              if (lineItemCount === 0) {
                console.warn(
                  `[getLabelsFromTargetOrderData] Expected at least one line item per invoice, but found none for invoice ${invoiceDetail.id}.`,
                  invoiceDetail,
                );
              }

              // TODO: Add order/invoice URL to main description

              const shouldTrimLineItemDescriptionWords = lineItemCount > 1;

              // Sort the items in descending order by their individual line total
              const linesSorted = invoiceDetail.lines.slice().sort((a, b) => {
                return b.effective_amount - a.effective_amount;
              });

              const memoLabel: LabelElement[] = linesSorted.flatMap(
                (line, i) => {
                  const newDescription =
                    (shouldTrimLineItemDescriptionWords
                      ? line.item.description
                          ?.split(SINGLE_SPACE)
                          .slice(0, 4)
                          .join(SINGLE_SPACE)
                      : line.item.description) ?? '(no description)';

                  const itemLabelElement: LabelElement[] = [
                    {
                      flexShrink: 1,
                      onOverflow: ON_TRUNCATE_TYPES.truncate,
                      value:
                        (line.quantity > 1 ? `${line.quantity}x ` : '') +
                          newDescription ?? '(no description)',
                    },
                  ];
                  if (i < linesSorted.length - 1) {
                    return itemLabelElement.concat([separatorLabelElement]);
                  }
                  return itemLabelElement;
                },
              );

              return {
                amount: totalChargedToCard,
                date: getDateString(invoiceDetail.date),
                id: invoiceDetail.id,
                memo:
                  memoLabel.length > 0
                    ? memoLabel
                    : [
                        {
                          flexShrink: 1,
                          onOverflow: ON_TRUNCATE_TYPES.truncate,
                          value: '(no line items)',
                        },
                      ],
                payee: 'Target',
                ...(lineItemCount > 1 ? {subTransactions} : {}),
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
