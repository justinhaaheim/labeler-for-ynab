import type {YnabCsvTransactionType} from './LabelTypes';

import Papa from 'papaparse';

export function getParsedLabels(csvText: string): YnabCsvTransactionType[] {
  const parseResult = Papa.parse<YnabCsvTransactionType>(csvText, {
    header: true,
    transformHeader: (header) => header.toLowerCase(),
  });

  if (parseResult.errors.length > 0) {
    console.error('Error parsing CSV file', parseResult.errors);
    throw new Error(
      'Error parsing CSV file: ' +
        parseResult.errors.map((e) => e.message).join('\n'),
    );
  }

  console.debug('parse result:', parseResult.data);

  // TODO: Validate that the data is indeed in the correct format
  return parseResult.data;
}
