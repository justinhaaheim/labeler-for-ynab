import type {
  StandardTransactionType,
  StandardTransactionTypeWithLabelElements,
} from './LabelTypes';
import type {
  LabelTransactionMatchFinalized,
  LabelTransactionMatchWithWarnings,
} from './Matching';

import repeatString from './repeatString';
import {YNAB_MAX_MEMO_LENGTH} from './Sync';

/**
 * TODO: Handle what happens if two spaces are next to each other after
 * a string has been truncated (ie exposing an innner space). Should they always merge?
 */

/**
 * omit - omit the element entirely if it cannot be included in its entirety
 * truncate - truncate the element if it cannot be included in its entirety
 */
export const ON_TRUNCATE_TYPES = {omit: 'omit', truncate: 'truncate'} as const;

export interface LabelElement {
  // Whether or not this element should shrink if the total label is over the limit. Right now I'm just using 1 and 0, and unlike flexbox I'm not evenly applying the shrinking -- it's applied from the end back to the start
  flexShrink: number;

  // How many spaces to include between this and the next element
  marginEnd?: number;

  // could also be onOverflow
  onOverflow: keyof typeof ON_TRUNCATE_TYPES;

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
  mode: 'handle-overflow' | 'shrink';
};

export const SEPARATOR_BEFORE_LABEL = '✳️';
const LABEL_SEPARATORS_INCLUDING_HISTORICAL = [SEPARATOR_BEFORE_LABEL, '@@'];

export const ELLIPSIS = '…';

export const SPACE = ' ';
const DEFAULT_GAP_LENGTH = 1;
const DEFAULT_GAP = repeatString(SPACE, DEFAULT_GAP_LENGTH);

const REMAINING_CHARS_AVAILABLE_FOR_LABEL_WARNING_THRESHOLD = 15;

const ENABLE_DEBUG_LOGGING = false;
const log = ENABLE_DEBUG_LOGGING ? console.debug.bind(console) : () => {};

function trimElementValues(elements: LabelElement[]): LabelElement[] {
  return elements.map((e) => ({...e, value: e.value.trim()}));
}

function truncateString(s: string, charsToReduce: number): string {
  if (charsToReduce >= s.length) {
    return '';
  }

  const slicedString = s.slice(0, -1 * (charsToReduce + ELLIPSIS.length));

  const newValue = slicedString.trim() + ELLIPSIS;

  log(`🔍 Shrinking element ${s}`, {
    /* eslint-disable sort-keys-fix/sort-keys-fix */
    before: s,
    after_: newValue,
    charsToReduce,
    stringLength: s.length,
    /* eslint-enable sort-keys-fix/sort-keys-fix */
  });

  return newValue;
}

export function isSuspectedAlreadyLabeled(memo: string): boolean {
  // The separator should always have a space after it, so this helps us avoid false positives where @@ might be in some random string
  return LABEL_SEPARATORS_INCLUDING_HISTORICAL.some((s) =>
    memo.includes(`${s} `),
  );
}

function renderLabelNoLimit(elements: LabelElement[]): string {
  return elements
    .filter((e) => e.value.length > 0) // Don't render anything if value is empty
    .map((e, i, arr) => {
      /**
       * NOTE: Even though we trim all values at the outset we will still see strings here
       * that need to be trimmed, since the process of rendering slices strings and may leave
       * whitespace at the end
       */
      const valueTrimmed = e.value.trim();

      if (i === arr.length - 1) {
        // Don't add any gap after the last element
        return valueTrimmed;
      }

      return (
        valueTrimmed +
        // Save a few processor cycles by not calling repeatString unless we need to
        (e.marginEnd == null || e.marginEnd === DEFAULT_GAP_LENGTH
          ? DEFAULT_GAP
          : repeatString(DEFAULT_GAP, e.marginEnd ?? DEFAULT_GAP_LENGTH))
      );
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

  log('🏷️ [renderLabelElementsWithStrategy]', {
    charactersToReduce: fullRender.length - lengthLimit,
    elements,
    fullRender,
    fullRenderLength: fullRender.length,
    lengthLimit,
    mode,
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

    // console.debug(
    //   `🔍 Processing elements in reverse order: #${
    //     elementsToProcessReversed.length - 1 - i
    //   } ${e.value}`,
    //   {
    //     charsToReduce,
    //     currentElementsInOrder,
    //     currentElementsInOrderTransformed,
    //     currentLength,
    //   },
    // );

    if (charsToReduce <= 0) {
      // We're under the limit, so we're done
      break;
    }

    if (e.value.length === 0) {
      // This element does not contribute any length
      continue;
    }

    if (mode === 'shrink' && e.flexShrink > 0) {
      const newValue = truncateString(e.value, charsToReduce);
      newElementsReversed[i] = {...e, value: newValue};
      continue;
    }

    if (mode === 'handle-overflow') {
      const newValue =
        e.onOverflow === 'omit' ? '' : truncateString(e.value, charsToReduce);
      log(`🔍 Handling overflow for element ${e.value}`, {
        /* eslint-disable sort-keys-fix/sort-keys-fix */
        before: e.value,
        after_: newValue,
        /* eslint-enable sort-keys-fix/sort-keys-fix */
      });
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
  elementsUntrimmed: LabelElement[],
  lengthLimit: number,
): string {
  const elements = trimElementValues(elementsUntrimmed);
  const fullRender = renderLabelNoLimit(elements);

  let charactersToReduce = fullRender.length - lengthLimit;
  log('🏷️ [renderLabel]', {
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
  log('🏷️ [renderLabel] Shrinking elements...');
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
   * starting from the end, according to their 'onOverflow' prop
   *
   * But we should do this starting with the original elements array, since we
   * might be able to regain some elements that were shrunk if we have to remove an
   * entire element like a URL
   *
   * NEW: Now we need to start force truncating items, but let's see if we can't
   * get back some of the previously shrunk elements after we truncate/omit each next item
   */
  log('🏷️ [renderLabel] Force-truncating elements...');
  const shrinkTransform: ElementListTransform = (elements, config) =>
    renderLabelElementsWithStrategy(elements, {...config, mode: 'shrink'});
  const forceTruncatedRenderElements = renderLabelElementsWithStrategy(
    elements,
    {
      elementListTransform: shrinkTransform,
      lengthLimit,
      mode: 'handle-overflow',
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

type RenderFinalizedMatchesConfig = {
  finalizedMatches: LabelTransactionMatchWithWarnings[];
  prefix: string;
};

export function renderFinalizedMatches({
  finalizedMatches,
  prefix,
}: RenderFinalizedMatchesConfig): LabelTransactionMatchFinalized[] {
  return finalizedMatches.map((match) => {
    const newWarnings = match.warnings.slice();

    const transactionMemo = match.transactionMatch?.memo ?? '';
    const charsRemainingForLabel =
      YNAB_MAX_MEMO_LENGTH - transactionMemo.length;
    const labelFullLength = renderLabelNoLimit(match.label.memo).length;

    if (
      labelFullLength > charsRemainingForLabel &&
      charsRemainingForLabel <=
        REMAINING_CHARS_AVAILABLE_FOR_LABEL_WARNING_THRESHOLD
    ) {
      newWarnings.push({
        message: `Insufficient space to add label. ${charsRemainingForLabel} characters available for label.`,
      });
    }

    if (isSuspectedAlreadyLabeled(transactionMemo)) {
      newWarnings.push({
        message: `Transaction appears to already be labeled.`,
      });
    }

    const newMemo = renderLabel(
      [
        // YNAB transaction memo
        {
          flexShrink: 0,
          onOverflow: ON_TRUNCATE_TYPES.truncate,
          value: transactionMemo,
        },

        // divider
        {flexShrink: 0, onOverflow: 'omit', value: SEPARATOR_BEFORE_LABEL},

        // prefix
        {flexShrink: 0, onOverflow: 'omit', value: prefix},

        // label parts
        ...match.label.memo,
      ],
      // TODO: Maybe take this in as a function arg rather than assuming 200 here
      YNAB_MAX_MEMO_LENGTH,
    );
    return {...match, newMemo, warnings: newWarnings};
  });
}

export function renderStandardTransactionFromLabelElements(
  transactionWithLabelElements: StandardTransactionTypeWithLabelElements,
  lengthLimit = Infinity,
): StandardTransactionType {
  const renderedMemo = renderLabel(
    transactionWithLabelElements.memo,
    lengthLimit,
  );
  return {...transactionWithLabelElements, memo: renderedMemo};
}
