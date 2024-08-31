// TODO: Figure out the best way to support other locales/currencies
const HARDCODED_LOCALE = 'en-US';
const HARDCODED_CURRENCY = 'USD';

// TODO: Don't hardcode decimal digits
export const HARDCODED_CURRENCY_DECIMAL_DIGITS = 2;

const CURRENCY_SYMBOL_FALLBACK = '$';
const CURRENCY_SYMBOL =
  new Intl.NumberFormat(HARDCODED_LOCALE, {
    currency: HARDCODED_CURRENCY,
    style: 'currency',
  })
    ?.formatToParts(1)
    ?.find((x) => x.type === 'currency')?.value ?? CURRENCY_SYMBOL_FALLBACK;

// TODO: Don't hardcode this. Use the currency from the budget
const USDFormat = Intl.NumberFormat(undefined, {
  currency: HARDCODED_CURRENCY,
  style: 'currency',
});

export function getFormattedAmount(amount: number): string {
  return USDFormat.format(Object.is(amount, -0) ? 0 : amount);
}

/**
 * Parse a localized number to a float.
 * From: https://stackoverflow.com/a/29273131/18265617
 *
 * @param {string} stringNumber - the localized number
 * @param {string} locale - [optional] the locale that the number is represented in. Omit this parameter to use the current locale.
 */
export function parseLocaleNumber(
  stringNumber: string,
  locale?: string,
): number {
  const thousandSeparator = Intl.NumberFormat(locale)
    .format(11111)
    .replace(/\p{Number}/gu, '');
  const decimalSeparator = Intl.NumberFormat(locale)
    .format(1.1)
    .replace(/\p{Number}/gu, '');

  return parseFloat(
    stringNumber
      .replace(new RegExp('\\' + CURRENCY_SYMBOL, 'g'), '')
      .replace(new RegExp('\\' + thousandSeparator, 'g'), '')
      .replace(new RegExp('\\' + decimalSeparator), '.'),
  );
}

/**
 * NOTE: I did a lot of research on how to best do this, and didn't find a clear winning
 * solution or library. So this is a best effort for now. Probably want to revisit this.
 *
 * Resources:
 * https://stackoverflow.com/questions/2876536/precise-financial-calculation-in-javascript-what-are-the-gotchas
 * https://medium.com/@magnusjt/how-to-handle-money-in-javascript-b954d612373c
 *
 * @param n1
 * @param n2
 * @param digits
 * @returns
 */
export function areEqualWithPrecision(
  n1: number,
  n2: number,
  digits: number,
): boolean {
  return n1.toFixed(digits) === n2.toFixed(digits);
}

export function convertUSDToMilliunits(amount: number): number {
  const rawValue = amount * 1000;
  const roundedValue = Math.round(rawValue);
  if (rawValue !== roundedValue) {
    console.warn(
      '[convertUSDToMilliunits] converting to milliunits had extra digits of precision (likely floating point arithemtic error):',
      {amount, rawValue, roundedValue},
    );
  }
  return roundedValue;
}

export function hasUnexpectedDigitsOfPrecision(
  n: number,
  digits: number,
): boolean {
  return n.toFixed(digits) !== n.toString();
}
