import {shortenAmazonOrderURL} from './AmazonLinks';

describe('shortenAmazonOrderURL', () => {
  it('should shorten a standard long Amazon URL', () => {
    const longUrl =
      'https://www.amazon.com/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o02?ie=UTF8&orderID=123-4567890-1234567';
    const expectedShortUrl =
      'https://amzn.com/gp/your-account/order-details/?orderID=123-4567890-1234567';
    expect(shortenAmazonOrderURL(longUrl)).toBe(expectedShortUrl);
  });

  it('should not change a non-Amazon URL', () => {
    const nonAmazonUrl = 'https://www.google.com/search?q=amazon';
    expect(shortenAmazonOrderURL(nonAmazonUrl)).toBe(nonAmazonUrl);
  });

  it("should not change a short Amazon URL that doesn't need shortening", () => {
    const shortUrl =
      'https://amzn.com/gp/your-account/order-details/?orderID=789-1234567-8901234';
    expect(shortenAmazonOrderURL(shortUrl)).toBe(shortUrl);
  });

  it('should handle an Amazon URL without an orderID parameter', () => {
    // TODO: Not sure if this is the behavior I want
    const urlWithoutOrderID =
      'https://www.amazon.com/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o02?ie=UTF8';
    const expectedShortUrl = 'https://amzn.com/gp/your-account/order-details/';
    expect(shortenAmazonOrderURL(urlWithoutOrderID)).toBe(expectedShortUrl);
  });

  it('should handle an Amazon URL that has no ref in the path', () => {
    const urlWithoutRef =
      'https://www.amazon.com/gp/your-account/order-details/?orderID=456-7890123-4567890';
    const expectedShortUrl =
      'https://amzn.com/gp/your-account/order-details/?orderID=456-7890123-4567890';
    expect(shortenAmazonOrderURL(urlWithoutRef)).toBe(expectedShortUrl);
  });
});
