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
  'invoice',
] as const;

export type AmazonOrdersCsvImportType = {
  [Key in (typeof AMAZON_IMPORT_KEYS)[number]]: string;
};

// FYI Alternate way to do this:
// export type AmazonOrdersCsvImportType2 = Record<
//   (typeof AMAZON_IMPORT_KEYS)[number],
//   string
// >;

/* eslint-disable typescript-sort-keys/interface */
// export type AmazonOrdersCsvImportType = {
//   order_id: string;
//   order_url: string;
//   items: string;
//   to: string;
//   date: string;
//   total: string;
//   shipping: string;
//   shipping_refund: string;
//   gift: string;
//   tax: string;
//   refund: string;
//   payments: string;
//   invoice: string;
// };
/* eslint-enable typescript-sort-keys/interface */

export type StandardTransactionType = {
  amount: number;
  date: string;
  id: string;
  memo: string;
  payee: string;
};

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
