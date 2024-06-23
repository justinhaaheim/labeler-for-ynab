/**
 * Parse a localized number to a float.
 * From: https://stackoverflow.com/a/29273131/18265617
 *
 * @param {string} stringNumber - the localized number
 * @param {string} locale - [optional] the locale that the number is represented in. Omit this parameter to use the current locale.
 */
export default function parseLocaleNumber(
  stringNumber: string,
  locale?: string,
): number {
  var thousandSeparator = Intl.NumberFormat(locale)
    .format(11111)
    .replace(/\p{Number}/gu, '');
  var decimalSeparator = Intl.NumberFormat(locale)
    .format(1.1)
    .replace(/\p{Number}/gu, '');

  return parseFloat(
    stringNumber
      .replace(new RegExp('\\' + thousandSeparator, 'g'), '')
      .replace(new RegExp('\\' + decimalSeparator), '.'),
  );
}
