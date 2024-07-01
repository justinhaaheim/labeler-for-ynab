import Papa from 'papaparse';

import {
  AMAZON_IMPORT_KEYS,
  type AmazonOrdersCsvImportType,
  YNAB_CSV_IMPORT_KEYS,
  type YnabCsvTransactionType,
} from './LabelTypes';

export const PARSED_LABEL_FORMAT_TYPES = ['amazon', 'ynab'] as const;
export type ParsedLabelFormatTypes = (typeof PARSED_LABEL_FORMAT_TYPES)[number];

export type ParsedLabelsTyped =
  | {
      _type: 'amazon';
      labels: AmazonOrdersCsvImportType[];
    }
  | {
      _type: 'ynab';
      labels: YnabCsvTransactionType[];
    };

export const PRETTY_NAME_LOOKUP: {
  [key in ParsedLabelFormatTypes]: string;
} = {
  amazon: 'Amazon',
  ynab: 'YNAB',
};

export function isValidAmazonOrderImport(
  parseResult: Papa.ParseResult<{[key: string]: string}>,
): boolean {
  return (
    parseResult.data.length > 0 &&
    AMAZON_IMPORT_KEYS.every((key) =>
      Object.prototype.hasOwnProperty.call(parseResult.data[0], key),
    )
  );
}

export function isValidYnabCsvImport(
  parseResult: Papa.ParseResult<{[key: string]: string}>,
): boolean {
  return (
    parseResult.data.length > 0 &&
    YNAB_CSV_IMPORT_KEYS.every((key) =>
      Object.prototype.hasOwnProperty.call(parseResult.data[0], key),
    )
  );
}

export function getParsedLabelsFromCsv(csvText: string): ParsedLabelsTyped {
  const parseResult = Papa.parse<{[key: string]: string}>(csvText, {
    header: true,
    transformHeader: (header) => header.toLowerCase().replace(/ /g, '_'),
  });

  if (parseResult.errors.length > 0) {
    console.error('Error parsing CSV file', parseResult.errors);
    throw new Error(
      'Error parsing CSV file: ' +
        parseResult.errors.map((e) => e.message).join('\n'),
    );
  }

  console.debug('parse result:', parseResult.data);

  if (isValidAmazonOrderImport(parseResult)) {
    console.debug('CSV import is Amazon format');
    return {
      _type: 'amazon',
      labels: parseResult.data as AmazonOrdersCsvImportType[],
    };
  }

  if (isValidYnabCsvImport(parseResult)) {
    console.debug('CSV import is YNAB format');
    return {
      _type: 'ynab',
      labels: parseResult.data as YnabCsvTransactionType[],
    };
  }

  throw new Error('CSV import did not match any valid format');
}

export function getParsedLabelsFromAmazonCsv(
  csvText: string,
): AmazonOrdersCsvImportType[] {
  const parseResult = Papa.parse<AmazonOrdersCsvImportType>(csvText, {
    header: true,
    transformHeader: (header) => header.replace(/ /g, '_'),
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

export function getParsedLabelsFromYnabCsv(
  csvText: string,
): YnabCsvTransactionType[] {
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
