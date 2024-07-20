/**
 * NOTE: there are almost certainly assumptions we're making here that will
 * break for other countries' amazon links.
 * @param url
 *
 * Example long link: https://www.amazon.com/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o02?ie=UTF8&orderID=112-2959450-8957868
 * Can be shortened to: https://amzn.com/gp/your-account/order-details/?orderID=112-2959450-8957868
 */
export function shortenAmazonOrderURL(urlString: string): string {
  const url = new URL(urlString);

  const newUrl = new URL(urlString);

  if (url.hostname !== 'www.amazon.com') {
    return urlString;
  }

  newUrl.hostname = 'amzn.com';

  const pathParts = url.pathname.split('/');

  if (
    pathParts.length > 0 &&
    pathParts[pathParts.length - 1]?.startsWith('ref=')
  ) {
    newUrl.pathname = pathParts.slice(0, -1).join('/') + '/';
  }

  const searchParams = new URLSearchParams(url.searchParams);

  const orderID = searchParams.get('orderID');
  const newSearchParams = new URLSearchParams();

  if (orderID != null) {
    newSearchParams.set('orderID', orderID);
  }

  newUrl.search = newSearchParams.toString();

  return newUrl.toString();
}