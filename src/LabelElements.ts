// export const LABEL_TYPES = ['original-memo', 'divider', 'generic-element'];

/**
 * omit - omit the element entirely if it cannot be included in its entirety
 * truncate - truncate the element if it cannot be included in its entirety
 */
export const ON_TRUNCATE_TYPES = ['omit', 'truncate'] as const;

export const SPACE = ' ';

interface LabelElement {
  // Whether or not this element should shrink if the total label is over the limit. Right now I'm just using 1 and 0
  flexShrink: number;

  // # of spaces to add at the end. I may end up setting a default of 1
  marginEnd: number;

  // could also be onOverflow
  onTruncate: (typeof ON_TRUNCATE_TYPES)[number];

  // The actual string to include in the label
  value: string;
}

const example: LabelElement[] = [
  {flexShrink: 0, marginEnd: 1, onTruncate: 'truncate', value: 'piggie?'}, // original memo
  {flexShrink: 0, marginEnd: 1, onTruncate: 'omit', value: '##'}, // divider
  {flexShrink: 0, marginEnd: 1, onTruncate: 'omit', value: '🐷'}, // prefix
  {flexShrink: 0, marginEnd: 1, onTruncate: 'omit', value: '(charge 1 of 3)'}, // transaction info
  {
    flexShrink: 1,
    marginEnd: 1,
    onTruncate: 'truncate',
    value: 'Anker 4-port charger',
  }, // Item name
  {
    flexShrink: 0,
    marginEnd: 1,
    onTruncate: 'omit',
    value:
      'https://www.amazon.com/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o08?ie=UTF8&orderID=113-7378406-3016269',
  }, // Order URL
];

export function repeatString(str: string, nTimes: number): string {
  return Array(nTimes).fill(str).join('');
}

function renderLabelNoLimit(elements: LabelElement[]): string {
  return elements
    .map((e) => e.value + repeatString(SPACE, e.marginEnd))
    .join('');
}

export function renderLabel(
  elements: LabelElement[],
  lengthLimit: number,
): string {
  const fullRender = renderLabelNoLimit(elements);

  const charactersToReduce = fullRender.length - lengthLimit;
  if (charactersToReduce <= 0) {
    return fullRender;
  }

  /**
   * The first way we reduce string length is by truncating any strings with
   * a positive flexShrink, starting from the end, until we're under the limit
   */
  let charactersToReduceTracker = charactersToReduce;
  const shrunkRenderElements = elements
    .slice()
    .reverse()
    .map((e) => {
      if (e.flexShrink === 0) {
        return e;
      }

      if (charactersToReduceTracker <= 0) {
        return e;
      }

      const charactersToReduceFromThisElement = Math.min(
        charactersToReduceTracker,
        e.value.length,
      );
      const newValue = e.value.slice(0, -charactersToReduceFromThisElement);
      charactersToReduceTracker -= charactersToReduceFromThisElement;
      return {
        ...e,
        value: newValue,
      };
    })
    .slice()
    .reverse();
  const shrunkRender = renderLabelNoLimit(shrunkRenderElements);

  if (charactersToReduceTracker <= 0) {
    return shrunkRender;
  }

  /**
   * If we are still over the limit we need to start "force" truncating the items,
   * starting from the end, according to their 'onTruncate' prop
   */
  const forceTruncatedRenderElements = shrunkRenderElements
    .slice()
    .reverse()
    .map((e) => {
      if (charactersToReduceTracker <= 0) {
        return e;
      }

      console.debug('🏷️ [renderLabel] Force-truncating element:', {
        e,
        elements,
      });

      // Note: this can be more than charactersToReduceTracker when an element is to be omitted
      const charactersToReduceFromThisElement =
        e.onTruncate === 'omit'
          ? e.value.length
          : Math.min(charactersToReduceTracker, e.value.length);
      const newValue = e.value.slice(0, -charactersToReduceFromThisElement);

      charactersToReduceTracker = Math.max(
        0,
        charactersToReduceTracker - charactersToReduceFromThisElement,
      );

      return {
        ...e,
        value: newValue,
      };
    })
    .slice()
    .reverse();
  const forceTruncatedRender = renderLabelNoLimit(forceTruncatedRenderElements);

  if (charactersToReduceTracker <= 0) {
    return forceTruncatedRender;
  }

  console.warn(
    '🏷️ [renderLabel] label too long even after force truncating elements. Truncating final string...',
  );

  return forceTruncatedRender.slice(0, -charactersToReduceTracker);
}
