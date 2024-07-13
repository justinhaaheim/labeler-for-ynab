export const LABEL_TYPES = ['original-memo', 'divider', 'generic-element'];

// export type LabelTypes;

export const ON_TRUNCATE_TYPES = ['omit', 'truncate'] as const;

export const SPACE = ' ';

interface LabelElement {
  flexShrink: number;

  marginEnd: number;

  // could also be onOverflow
  onTruncate: (typeof ON_TRUNCATE_TYPES)[number];

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
  }, // Item name
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

      // if (e.onTruncate === 'omit') {
      //   charactersToReduceTracker = Math.max(
      //     0,
      //     charactersToReduceTracker - e.value.length,
      //   );
      //   return {
      //     ...e,
      //     value: '',
      //   };
      // }

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
