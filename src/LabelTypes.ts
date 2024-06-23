export type StandardTransactionType = {
  amount: number;
  date: string;
  id: string;
  memo: string;
  payee: string;
};

export type YnabCsvTransactionType = {
  // This is a string by default, but should not include any dollar signs or other currency symbols
  amount: string;
  date: string;
  memo: string;
  payee: string;
};
