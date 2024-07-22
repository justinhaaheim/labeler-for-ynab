// import * as ynab from 'ynab';

// TODO: Don't hardcode this. Use the currency from the budget
const USDFormat = Intl.NumberFormat(undefined, {
  currency: 'USD',
  style: 'currency',
});

export default function getFormattedAmount(amount: number): string {
  return USDFormat.format(Object.is(amount, -0) ? 0 : amount);
}
