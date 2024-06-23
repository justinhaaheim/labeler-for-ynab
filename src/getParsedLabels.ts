import type {YnabCsvTransactionType} from './LabelTypes';

import Papa from 'papaparse';

import amazonLabels2024Local from './amazonLabels2024.local';

export function getParsedLabels(): YnabCsvTransactionType[] {
  const parseResult = Papa.parse<YnabCsvTransactionType>(
    amazonLabels2024Local,
    {
      header: true,
      transformHeader: (header) => header.toLowerCase(),
    },
  );

  if (parseResult.errors.length > 0) {
    console.log('parseResult.errors', parseResult.errors);
  }

  console.debug('parse result:', parseResult.data);

  return parseResult.data;
}
