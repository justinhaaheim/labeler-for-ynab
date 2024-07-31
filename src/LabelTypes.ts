import type {LabelElement} from './LabelElements';

// TODO: Support other names in other locales?
export const AMAZON_PAYEE_NAME = 'Amazon';

// NOTE: the original keys have spaces, so the underscores must be added upon import
export const AMAZON_IMPORT_KEYS = [
  'order_id',
  'order_url',
  'items',
  'to',
  'date',
  'total',
  'shipping',
  'shipping_refund',
  'gift',
  'tax',
  'refund',
  'payments',
  // invoice is optional
  // 'invoice',
] as const;

export type AmazonOrdersCsvImportType = {
  [Key in (typeof AMAZON_IMPORT_KEYS)[number]]: string;
};

// FYI Alternate way to do this:
// export type AmazonOrdersCsvImportType2 = Record<
//   (typeof AMAZON_IMPORT_KEYS)[number],
//   string
// >;

export type LabelMetaData = {
  dateRangeEnd: Date;
};

export interface StandardTransactionType {
  amount: number;
  date: string;
  id: string;
  memo: string;
  payee: string;
}
// TODO NEXT: Write a converter between StandardTransactionTypeWithLabelElements and StandardTransactionType so that we can easily render the non-finalized matches into a table
export interface StandardTransactionTypeWithLabelElements {
  amount: number;
  date: string;
  id: string;
  memo: LabelElement[];
  metaData?: LabelMetaData;
  payee: string;
}

export interface AmazonTransactionType
  extends StandardTransactionTypeWithLabelElements {
  orderURL: string | null;
}

export const YNAB_CSV_IMPORT_KEYS = [
  'amount',
  'date',
  'payee',
  'memo',
] as const;

export type YnabCsvTransactionType = {
  [Key in (typeof YNAB_CSV_IMPORT_KEYS)[number]]: string;
};

// export type YnabCsvTransactionType = {
//   // This is a string by default, but should not include any dollar signs or other currency symbols
//   amount: string;
//   date: string;
//   memo: string;
//   payee: string;
// };
