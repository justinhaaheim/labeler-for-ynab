type TableValue = number | string | null | undefined;

export type ParsedDataRow = {[key: string]: TableValue};
export type ParsedData = ParsedDataRow[];

export type ColumnID = string;

export type ValueGetter = (row: ParsedDataRow) => TableValue;

export type GridColumnDef = {
  columnID: ColumnID;
  getNode?: (row: ParsedDataRow) => React.ReactNode;
  getValue?: ValueGetter;
  headerName: string;
  sx?: Record<string, number | string>;
  // textAlign?: 'center' | 'end' | 'start';
  truncatable?: boolean;
  // width?: string;
};

export type FieldGetterLookup = Record<ColumnID, ValueGetter>;

// function getIntFromNullableString(s?: string): number | null {
//   if (s == null) {
//     return null;
//   }
//   const i = parseInt(s);
//   if (isNaN(i)) {
//     return null;
//   }
//   return i;
// }

// function getTimeSinceValue(row: ParsedDataRow): number | null {
//   const timestampEpoch = getIntFromNullableString(row['timestamp_epoch']);
//   if (timestampEpoch == null) {
//     return null;
//   }
//   return Date.now() - timestampEpoch;
// }
