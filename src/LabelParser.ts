import Papa from 'papaparse';

import {
  AMAZON_IMPORT_KEYS,
  type AmazonOrdersCsvImportType,
  YNAB_CSV_IMPORT_KEYS,
  type YnabCsvTransactionType,
} from './LabelTypes';
import {type CombinedOutputData, CombinedOutputDataZod} from './TargetAPITypes';

export const PARSED_LABEL_FORMAT_TYPES = ['amazon', 'ynab', 'target'] as const;
export type ParsedLabelFormatTypes = (typeof PARSED_LABEL_FORMAT_TYPES)[number];

type ParsedLabelsStats = {
  duplicateRowsRemoved: number;
  rowsParsed: number;
};

export type ParsedLabelsTyped =
  | {
      _type: 'amazon';
      labels: AmazonOrdersCsvImportType[];
      stats: ParsedLabelsStats;
    }
  | {
      _type: 'target';
      labels: CombinedOutputData;
      stats: ParsedLabelsStats;
    }
  | {
      _type: 'ynab';
      labels: YnabCsvTransactionType[];
      stats: ParsedLabelsStats;
    };

export const PRETTY_NAME_LOOKUP: {
  [key in ParsedLabelFormatTypes]: string;
} = {
  amazon: 'Amazon',
  target: 'Target',
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

export function removeDuplicateAmazonOrderRows(
  rows: AmazonOrdersCsvImportType[],
): AmazonOrdersCsvImportType[] {
  const seenOrderIds = new Set<string>();

  return rows.filter((row) => {
    if (seenOrderIds.has(row.order_id)) {
      // console.debug('Found duplicate order row:', {i, row});
      return false;
    }
    seenOrderIds.add(row.order_id);
    return true;
  });
}

function transformHeaderToStandardFormat(header: string): string {
  return header.toLowerCase().replace(/ /g, '_');
}

// For some reason the csv exports from the amazon scraper contain a duplicate header row at the end
function isDuplicateHeaderRow(row: {[key: string]: string}): boolean {
  const result = Object.entries(row).every(
    ([key, value]) => key === transformHeaderToStandardFormat(value),
  );
  if (result) {
    console.debug('Found duplicate header row:', row);
  }
  return result;
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

export function getParsedLabelsFromFile(fileText: string): ParsedLabelsTyped {
  try {
    const jsonOutput = JSON.parse(fileText);
    const targetOutputData = CombinedOutputDataZod.parse(jsonOutput);

    return {
      _type: 'target',
      labels: targetOutputData,
      stats: {
        duplicateRowsRemoved: 0,
        rowsParsed: targetOutputData.invoiceAndOrderData.length,
      },
    };
  } catch (e) {
    console.log('JSON.parse threw an error. Attempting to parse as csv...', e);
  }

  return getParsedLabelsFromCsv(fileText);
}

export function getParsedLabelsFromCsv(csvText: string): ParsedLabelsTyped {
  const parseResult = Papa.parse<{[key: string]: string}>(csvText, {
    header: true,
    transformHeader: transformHeaderToStandardFormat,
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

    const rows = parseResult.data.filter(
      (labelRow) => !isDuplicateHeaderRow(labelRow),
    ) as AmazonOrdersCsvImportType[];

    const rowsWithoutDuplicates = removeDuplicateAmazonOrderRows(rows);

    return {
      _type: 'amazon',
      labels: rowsWithoutDuplicates,
      stats: {
        duplicateRowsRemoved: rows.length - rowsWithoutDuplicates.length,
        rowsParsed: rows.length,
      },
    };
  }

  if (isValidYnabCsvImport(parseResult)) {
    console.debug('CSV import is YNAB format');
    return {
      _type: 'ynab',
      labels: parseResult.data as YnabCsvTransactionType[],
      stats: {
        duplicateRowsRemoved: 0,
        rowsParsed: parseResult.data.length,
      },
    };
  }

  throw new Error('CSV import did not match any valid format');
}

// export function getParsedLabelsFromAmazonCsv(
//   csvText: string,
// ): AmazonOrdersCsvImportType[] {
//   const parseResult = Papa.parse<AmazonOrdersCsvImportType>(csvText, {
//     header: true,
//     transformHeader: (header) => header.replace(/ /g, '_'),
//   });

//   if (parseResult.errors.length > 0) {
//     console.error('Error parsing CSV file', parseResult.errors);
//     throw new Error(
//       'Error parsing CSV file: ' +
//         parseResult.errors.map((e) => e.message).join('\n'),
//     );
//   }

//   console.debug('parse result:', parseResult.data);

//   // TODO: Validate that the data is indeed in the correct format
//   return parseResult.data;
// }

// export function getParsedLabelsFromYnabCsv(
//   csvText: string,
// ): YnabCsvTransactionType[] {
//   const parseResult = Papa.parse<YnabCsvTransactionType>(csvText, {
//     header: true,
//     transformHeader: (header) => header.toLowerCase(),
//   });

//   if (parseResult.errors.length > 0) {
//     console.error('Error parsing CSV file', parseResult.errors);
//     throw new Error(
//       'Error parsing CSV file: ' +
//         parseResult.errors.map((e) => e.message).join('\n'),
//     );
//   }

//   console.debug('parse result:', parseResult.data);

//   // TODO: Validate that the data is indeed in the correct format
//   return parseResult.data;
// }
