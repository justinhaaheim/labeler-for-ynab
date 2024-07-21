import {type LabelElement, renderLabel} from './LabelElements';

describe('renders a basical label predictably', () => {
  const baseElements: LabelElement[] = [
    {flexShrink: 0, onOverflow: 'truncate', value: 'what is this?'}, // original memo
    {flexShrink: 0, onOverflow: 'omit', value: '@@'}, // divider
    {flexShrink: 0, onOverflow: 'omit', value: 'M'}, // prefix
    {flexShrink: 0, onOverflow: 'omit', value: '(charge 1 of 3)'}, // transaction info
    {
      flexShrink: 1,
      onOverflow: 'truncate',
      value: 'Anker 4-port charger',
    }, // Item name
    {
      flexShrink: 0,
      onOverflow: 'omit',
      value: 'https://www.example.com/',
    }, // Order URL
  ];

  it('renders a label with no limit', () => {
    // length: 80
    const expectedOutput =
      'what is this? @@ M (charge 1 of 3) Anker 4-port charger https://www.example.com/';
    expect(renderLabel(baseElements, Infinity)).toBe(expectedOutput);
  });

  it('truncates shrinkable elements first', () => {
    const expectedOutput =
      'what is this? @@ M (charge 1 of 3) Anker 4-port char https://www.example.com/';
    // length 77 should remove 3 characters from "Anker 4-port charger"
    expect(renderLabel(baseElements, 77)).toBe(expectedOutput);
  });

  it('omits elements when they cannot be included in their entirety', () => {
    // The item name is sacrificed first because it's shrinkable
    expect(renderLabel(baseElements, 61)).toBe(
      'what is this? @@ M (charge 1 of 3) A https://www.example.com/',
    );
    // When the item name is '' there should be no additional gap added for that element
    expect(renderLabel(baseElements, 60)).toBe(
      'what is this? @@ M (charge 1 of 3) https://www.example.com/',
    );
    expect(renderLabel(baseElements, 59)).toBe(
      'what is this? @@ M (charge 1 of 3) https://www.example.com/',
    );
    // When the limit cannot be satisifed by shrinking alone, start force-truncating
    expect(renderLabel(baseElements, 58)).toBe(
      'what is this? @@ M (charge 1 of 3) Anker 4-port charger',
    );

    // Once we've taken out an element marked with onOverflow: 'omit', try and meet the rest
    // of the limit with shrinking
    expect(renderLabel(baseElements, 45)).toBe(
      'what is this? @@ M (charge 1 of 3) Anker 4-po',
    );

    // When we reach the (charge 1 of 3) element and have to omit it, we should
    // fill in the remaining space with shrinkable elements
    expect(renderLabel(baseElements, 33)).toBe(
      'what is this? @@ M Anker 4-port c',
    );
  });
});

describe('renders a markdown label predictably', () => {
  const baseElements: LabelElement[] = [
    {
      flexShrink: 0,
      onOverflow: 'omit',
      value: '@@',
    },
    {
      flexShrink: 0,
      marginEnd: 0,
      onOverflow: 'omit',
      value: '[',
    },
    {
      flexShrink: 1,
      marginEnd: 0,
      onOverflow: 'truncate',
      value: 'Sony MDR7506 Professional Large Diaphragm Headphone; ',
    },
    {
      flexShrink: 0,
      marginEnd: 0,
      onOverflow: 'omit',
      value: '](',
    },
    {
      flexShrink: 0,
      marginEnd: 0,
      onOverflow: 'omit',
      value:
        'https://amzn.com/gp/your-account/order-details/?orderID=114-8644243-5542622',
    },
    {
      flexShrink: 0,
      onOverflow: 'omit',
      value: ')',
    },
  ];

  it('renders a label with no limit', () => {
    // length: 134
    const expectedOutput =
      '@@ [Sony MDR7506 Professional Large Diaphragm Headphone;](https://amzn.com/gp/your-account/order-details/?orderID=114-8644243-5542622)';
    expect(renderLabel(baseElements, Infinity)).toBe(expectedOutput);
  });

  it('truncates shrinkable elements first', () => {
    const length133Output =
      '@@ [Sony MDR7506 Professional Large Diaphragm Headphone](https://amzn.com/gp/your-account/order-details/?orderID=114-8644243-5542622)';
    // length 133 should remove the semicolon from the product name
    expect(renderLabel(baseElements, 133)).toBe(length133Output);
  });

  it('handles trailing whitespace predictably', () => {
    const length123Output =
      '@@ [Sony MDR7506 Professional Large Diaphragm](https://amzn.com/gp/your-account/order-details/?orderID=114-8644243-5542622)';
    // length 124 should shrink it to "...Large Diaphragm ", but then the final space will be trimmed so it will be the same as 123
    expect(renderLabel(baseElements, 124)).toBe(length123Output);

    // length 124 should shrink it to "...Large Diaphragm ", but then the final space will be trimmed.
    expect(renderLabel(baseElements, 123)).toBe(length123Output);
  });

  it('shrinks the item names entirely before omitting items with flexShrink = 0', () => {
    // TODO: This isn't ideal, as the markdown likely won't show the link at all
    const length82Output =
      '@@ [](https://amzn.com/gp/your-account/order-details/?orderID=114-8644243-5542622)';
    expect(renderLabel(baseElements, 82)).toBe(length82Output);
  });

  it('renders a broken markdown link (TODO: FIND A STRATEGY TO AVOID THIS)', () => {
    // TODO: This isn't ideal, as the markdown likely won't show the link at all
    const length81Output =
      '@@ [](https://amzn.com/gp/your-account/order-details/?orderID=114-8644243-5542622';
    expect(renderLabel(baseElements, 81)).toBe(length81Output);
  });

  it('renders a broken markdown link, removes the whole URL and compensates by adding back in the item name', () => {
    // TODO: This isn't ideal, as the markdown likely won't show the link at all
    // String is only 58 characters long
    const length80Output =
      '@@ [Sony MDR7506 Professional Large Diaphragm Headphone;](';
    expect(renderLabel(baseElements, 80)).toBe(length80Output);
  });
});
