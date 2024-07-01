/**
 * Parse a localized number to a float.
 * From: https://stackoverflow.com/a/29273131/18265617
 *
 * @param {string} stringNumber - the localized number
 * @param {string} locale - [optional] the locale that the number is represented in. Omit this parameter to use the current locale.
 */
// TODO: Figure out the best way to support other locales/currencies
const HARDCODED_LOCALE = 'en-US';
const HARDCODED_CURRENCY = 'USD';
const CURRENCY_SYMBOL_FALLBACK = '$';
const CURRENCY_SYMBOL =
  new Intl.NumberFormat(HARDCODED_LOCALE, {
    currency: HARDCODED_CURRENCY,
    style: 'currency',
  })
    ?.formatToParts(1)
    ?.find((x) => x.type === 'currency')?.value ?? CURRENCY_SYMBOL_FALLBACK;

export default function parseLocaleNumber(
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
