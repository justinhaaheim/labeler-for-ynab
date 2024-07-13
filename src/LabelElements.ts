import repeatString from './repeatString';

/**
 * TODO: Handle what happens if two spaces are next to each other after
 * a string has been truncated (ie exposing an innner space). Should they always merge?
 */

/**
 * omit - omit the element entirely if it cannot be included in its entirety
 * truncate - truncate the element if it cannot be included in its entirety
 */
export const ON_TRUNCATE_TYPES = ['omit', 'truncate'] as const;

export interface LabelElement {
  // Whether or not this element should shrink if the total label is over the limit. Right now I'm just using 1 and 0, and unlike flexbox I'm not evenly applying the shrinking -- it's applied from the end back to the start
  flexShrink: number;

  // could also be onOverflow
  onTruncate: (typeof ON_TRUNCATE_TYPES)[number];

  // The actual string to include in the label
  value: string;
}

type ElementListTransform = (
  elements: LabelElement[],
  config: {lengthLimit: number},
) => LabelElement[];

type RenderLabelElementsConfig = {
  // the elementListTransform is automatically applied to every remaining item
  elementListTransform?: ElementListTransform;
  lengthLimit: number;
  mode: 'force-truncate' | 'shrink';
};

export const SPACE = ' ';
const DEFAULT_GAP_LENGTH = 1;
const DEFAULT_GAP = repeatString(SPACE, DEFAULT_GAP_LENGTH);

function renderLabelNoLimit(elements: LabelElement[]): string {
  return elements
    .filter((e) => e.value.length > 0) // Don't render anything if value is empty
    .map((e, i, arr) => {
      if (i === arr.length - 1) {
        // Don't add any gap after the last element
        return e.value;
      }

      return e.value + DEFAULT_GAP;
    })
    .join('');
}

function renderLabelElementsWithStrategy(
  elements: LabelElement[],
  {
    lengthLimit = Infinity,
    mode = 'shrink',
    elementListTransform,
  }: RenderLabelElementsConfig,
): LabelElement[] {
  const fullRender = renderLabelNoLimit(elements);

  console.debug('🏷️ [renderLabelElementsWithStrategy]', {
    charactersToReduce: fullRender.length - lengthLimit,
    elements,
    fullRender,
    fullRenderLength: fullRender.length,
    lengthLimit,
  });

  if (fullRender.length <= lengthLimit) {
    return elements;
  }

  // Duplicate the array, making sure to not retain any object references
  const elementsToProcessReversed = elements
    .map((e) => ({...e}))
    .slice()
    .reverse();

  let newElementsReversed = elementsToProcessReversed.map((e) => ({...e}));

  for (const [i, e] of elementsToProcessReversed.entries()) {
    const currentElementsInOrder = newElementsReversed.slice().reverse();
    const currentElementsInOrderTransformed =
      elementListTransform != null
        ? elementListTransform(currentElementsInOrder, {lengthLimit})
        : currentElementsInOrder;
    const currentLength = renderLabelNoLimit(
      currentElementsInOrderTransformed,
    ).length;
    const charsToReduce = currentLength - lengthLimit;

    if (charsToReduce <= 0) {
      // We're under the limit, so we're done
      break;
    }

    if (e.value.length === 0) {
      // This element does not contribute any length
      continue;
    }

    if (mode === 'shrink' && e.flexShrink > 0) {
      const newValue = e.value.slice(0, -charsToReduce);
      newElementsReversed[i] = {...e, value: newValue};
      continue;
    }

    if (mode === 'force-truncate') {
      const newValue =
        e.onTruncate === 'omit' ? '' : e.value.slice(0, -charsToReduce);
      newElementsReversed[i] = {...e, value: newValue};
      continue;
    }
  }

  // It's important that we use the *transformed* version here, as that's what we're using to determine the ultimate length
  const currentElementsInOrder = newElementsReversed.slice().reverse();
  const currentElementsInOrderTransformed =
    elementListTransform != null
      ? elementListTransform(currentElementsInOrder, {lengthLimit})
      : currentElementsInOrder;

  return currentElementsInOrderTransformed;
}

export function renderLabel(
  elements: LabelElement[],
  lengthLimit: number,
): string {
  const fullRender = renderLabelNoLimit(elements);

  let charactersToReduce = fullRender.length - lengthLimit;
  console.debug('🏷️ [renderLabel]', {
    charactersToReduce,
    elements,
    fullRender,
    fullRenderLength: fullRender.length,
    lengthLimit,
  });

  if (charactersToReduce <= 0) {
    return fullRender;
  }

  /**
   * The first way we reduce string length is by truncating any strings with
   * a positive flexShrink, starting from the end, until we're under the limit
   */
  console.debug('🏷️ [renderLabel] Shrinking elements...');
  const shrunkRenderElements = renderLabelElementsWithStrategy(elements, {
    lengthLimit,
    mode: 'shrink',
  });
  const shrunkRender = renderLabelNoLimit(shrunkRenderElements);

  if (shrunkRender.length <= lengthLimit) {
    return shrunkRender;
  }

  /**
   * If we are still over the limit we need to start "force" truncating the items,
   * starting from the end, according to their 'onTruncate' prop
   *
   * But we should do this starting with the original elements array, since we
   * might be able to regain some elements that were shrunk if we have to remove an
   * entire element like a URL
   *
   * NEW: Now we need to start force truncating items, but let's see if we can't
   * get back some of the previously shrunk elements after we truncate/omit each next item
   */
  console.debug('🏷️ [renderLabel] Force-truncating elements...');
  const shrinkTransform: ElementListTransform = (elements, config) =>
    renderLabelElementsWithStrategy(elements, {...config, mode: 'shrink'});
  const forceTruncatedRenderElements = renderLabelElementsWithStrategy(
    elements,
    {
      elementListTransform: shrinkTransform,
      lengthLimit,
      mode: 'force-truncate',
    },
  );

  const forceTruncatedRender = renderLabelNoLimit(forceTruncatedRenderElements);

  if (forceTruncatedRender.length > lengthLimit) {
    console.error('🏷️ [renderLabel] rendered label still longer than limit', {
      elements,
      forceTruncatedRender,
      forceTruncatedRenderElements,
      lengthLimit,
    });
    throw new Error(
      '[renderLabel] label too long even after force truncating elements.',
    );
  }

  return forceTruncatedRender;
}
