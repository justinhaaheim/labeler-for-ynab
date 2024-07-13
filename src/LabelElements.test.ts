import {type LabelElement, renderLabel} from './LabelElements';

describe('renderLabel', () => {
  const baseElements: LabelElement[] = [
    {flexShrink: 0, onTruncate: 'truncate', value: 'what is this?'}, // original memo
    {flexShrink: 0, onTruncate: 'omit', value: '##'}, // divider
    {flexShrink: 0, onTruncate: 'omit', value: '@'}, // prefix
    {flexShrink: 0, onTruncate: 'omit', value: '(charge 1 of 3)'}, // transaction info
    {
      flexShrink: 1,
      onTruncate: 'truncate',
      value: 'Anker 4-port charger',
    }, // Item name
    {
      flexShrink: 0,
      onTruncate: 'omit',
      value: 'https://www.example.com/',
    }, // Order URL
  ];

  it('renders a label with no limit', () => {
    // length: 80
    const expectedOutput =
      'what is this? ## @ (charge 1 of 3) Anker 4-port charger https://www.example.com/';
    expect(renderLabel(baseElements, Infinity)).toBe(expectedOutput);
  });

  it('truncates shrinkable elements first', () => {
    const expectedOutput =
      'what is this? ## @ (charge 1 of 3) Anker 4-port char https://www.example.com/';
    // length 77 should remove 3 characters from "Anker 4-port charger"
    expect(renderLabel(baseElements, 77)).toBe(expectedOutput);
  });

  it('omits elements when they cannot be included in their entirety', () => {
    // The item name is sacrificed first because it's shrinkable
    expect(renderLabel(baseElements, 61)).toBe(
      'what is this? ## @ (charge 1 of 3) A https://www.example.com/',
    );
    // When the item name is '' there should be no additional gap added for that element
    expect(renderLabel(baseElements, 60)).toBe(
      'what is this? ## @ (charge 1 of 3) https://www.example.com/',
    );
    expect(renderLabel(baseElements, 59)).toBe(
      'what is this? ## @ (charge 1 of 3) https://www.example.com/',
    );
    // When the limit cannot be satisifed by shrinking alone, start force-truncating
    expect(renderLabel(baseElements, 58)).toBe(
      'what is this? ## @ (charge 1 of 3) Anker 4-port charger',
    );

    // Once we've taken out an element marked with onTruncate: 'omit', try and meet the rest
    // of the limit with shrinking
    expect(renderLabel(baseElements, 45)).toBe(
      'what is this? ## @ (charge 1 of 3) Anker 4-po',
    );

    // When we reach the (charge 1 of 3) element and have to omit it, we should
    // fill in the remaining space with shrinkable elements
    expect(renderLabel(baseElements, 33)).toBe(
      'what is this? ## @ Anker 4-port c',
    );
  });
});
