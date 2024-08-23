import type {ConverterOptionsConfig} from './Converters';
import type {StandardTransactionTypeWithLabelElements} from './LabelTypes';

import nullthrows from 'nullthrows';

// import fileToProcess from '../tmp/2024-08-22__02-40-53__targetOrderData__2-of-2__invoiceAndOrderData.json';
import {getDateString, getPrettyDateTimeString} from './DateUtils';
import {
  type LabelElement,
  ON_TRUNCATE_TYPES,
  renderLabel,
} from './LabelElements';
import {
  type CombinedOutputData,
  // CombinedOutputDataZod
} from './TargetAPITypes';

// TODO: Change this back to commas, and create a way to have the comma immediately follow the text before it, but leave a space afterwards
const separatorLabelElement: LabelElement = {
  flexShrink: 0,
  onOverflow: ON_TRUNCATE_TYPES.omit,
  value: '|',
};

export function getLabelsFromTargetOrderData(
  data: CombinedOutputData,
  _config?: ConverterOptionsConfig,
): StandardTransactionTypeWithLabelElements[] {
  console.debug('⭐ [getLabelsFromTargetOrderData]');

  const transactions: StandardTransactionTypeWithLabelElements[] =
    data.invoiceAndOrderData.flatMap(
      (invoiceAndOrderDataEntry, _invoiceAndOrderDataIndex) => {
        return invoiceAndOrderDataEntry.invoicesData.map(
          (invoiceDetail): StandardTransactionTypeWithLabelElements => {
            // TODO: Handle multiple payments in a given invoice
            if (invoiceDetail.payments.length !== 1) {
              throw new Error(
                `[getLabelsFromTargetOrderData] Expected exactly one payment, but found ${invoiceDetail.payments.length}.`,
              );
            }
            const totalChargedToCard = nullthrows(
              invoiceDetail.payments[0]?.total_charged,
            );

            // Sort the items in descending order by their individual line total
            const linesSorted = invoiceDetail.lines.slice().sort((a, b) => {
              return b.effective_amount - a.effective_amount;
            });

            // TODO: Add order/invoice URL
            const memoLabel: LabelElement[] = linesSorted.flatMap((line, i) => {
              // Let's try just providing the first 4 words of the description
              const truncatedDescription =
                line.item.description?.split(' ').slice(0, 4).join(' ') ??
                '(no description)';
              const itemLabelElement: LabelElement[] = [
                {
                  flexShrink: 1,
                  onOverflow: ON_TRUNCATE_TYPES.truncate,
                  value:
                    (line.quantity > 1 ? `${line.quantity}x ` : '') +
                      truncatedDescription ?? '(no description)',
                },
              ];
              if (i < linesSorted.length - 1) {
                return itemLabelElement.concat([separatorLabelElement]);
              }
              return itemLabelElement;
            });

            return {
              amount: totalChargedToCard,
              date: getDateString(invoiceDetail.date),
              id: invoiceDetail.id,
              memo: memoLabel,
              payee: 'Target',
              // TODO: use tenant_key instead of hardcoding "Target"
              // payee: invoiceAndOrderDataEntry.orderHistoryData.tenant_key,
            };
          },
        );
      },
    );

  console.log(
    `Export timestamp: ${getPrettyDateTimeString(
      new Date(data._createdTimestamp),
    )} | Transactions:`,
  );
  console.table(
    transactions.map((t) => ({...t, memo: renderLabel(t.memo, Infinity)})),
  );

  console.table(
    transactions.map((t) => ({...t, memo: renderLabel(t.memo, 200)})),
  );

  return transactions;
}

// console.log('Getting ynab transactions from Target Order Data...');
// getLabelsFromTargetOrderData(CombinedOutputDataZod.parse(fileToProcess));
// console.log('✅ Getting transactions complete!');
