// const categories = [
//   'APPAREL',
//   'ELECTRONICS',
//   'GROCERY',
//   'HEALTH AND BEAUTY',
//   'HOME',
//   'KITCHEN',
//   'LAUNDRY CLEANING AND CLOSET',
//   'PATIO & OUTDOOR DECOR',
//   'STATIONERY & OFFICE SUPPLIES',
// ];

import {titleCase} from 'title-case';

// const DEFAULT_PRODUCT_CATEGORY = 'Unknown Category';

type CategoryMap = Record<
  string,
  {
    alwaysItemizeIndividually?: boolean;
    emoji: string;
    prettyName: string;
    shortPrettyName: string;
  }
>;

// 'APPAREL', 👗
// 'ELECTRONICS', 🎧
// 'GROCERY', 🍎 🧃
// 'HEALTH AND BEAUTY', 💄 🧻
// 'HOME', 🏡
// 'KITCHEN', 🍴
// 'LAUNDRY CLEANING AND CLOSET',  🧼
// 'PATIO & OUTDOOR DECOR', ⛱️ 🌱
// 'STATIONERY & OFFICE SUPPLIES', 📌

// TODO: Figure out how YNAB counts emojis in terms of character count to make sure that a big sync doesn't fail
const targetCategoryConfig: CategoryMap = {
  APPAREL: {emoji: '👗', prettyName: 'Apparel', shortPrettyName: 'Apparel'},
  ELECTRONICS: {
    alwaysItemizeIndividually: true,
    emoji: '🎧',
    prettyName: 'Electronics',
    shortPrettyName: 'Electronics',
  },
  FURNITURE: {
    emoji: '🪑',
    prettyName: 'Furniture',
    shortPrettyName: 'Furniture',
  },
  GROCERY: {emoji: '🍎🧃', prettyName: 'Grocery', shortPrettyName: 'Grocery'},
  'HEALTH AND BEAUTY': {
    alwaysItemizeIndividually: true,
    emoji: '🧻💄',
    prettyName: 'Health & Beauty',
    shortPrettyName: 'Health',
  },
  HOME: {emoji: '🏡', prettyName: 'Home', shortPrettyName: 'Home'},
  KITCHEN: {emoji: '🍴', prettyName: 'Kitchen', shortPrettyName: 'Kitchen'},
  'LAUNDRY CLEANING AND CLOSET': {
    emoji: '🧼',
    prettyName: 'Laundry, Cleaning & Closet',
    shortPrettyName: 'Cleaning',
  },
  'PATIO & OUTDOOR DECOR': {
    emoji: '⛱️🌱',
    prettyName: 'Patio & Outdoor Decor',
    shortPrettyName: 'Patio',
  },
  'STATIONERY & OFFICE SUPPLIES': {
    emoji: '📌',
    prettyName: 'Stationery & Office Supplies',
    shortPrettyName: 'Office',
  },
};

export function getFormattedCategoryOrFallback(
  category: string,
  type: 'emoji',
): string {
  if (type !== 'emoji') {
    throw new Error(`Invalid type: ${type}`);
  }
  const emojiOrFallbackObject = getCategoryEmojiOrFallback(category);

  if (emojiOrFallbackObject.isEmoji) {
    return emojiOrFallbackObject.value;
  }

  return `[${emojiOrFallbackObject.value}]`;
}

function getCategoryEmojiOrFallback(category: string): {
  isEmoji: boolean;
  value: string;
} {
  const categoryTitleCase = titleCase(category.toLowerCase());
  if (category in targetCategoryConfig) {
    const emojiNullable = targetCategoryConfig[category]?.emoji;
    if (emojiNullable != null) {
      return {isEmoji: true, value: emojiNullable};
    }
  }
  return {isEmoji: false, value: categoryTitleCase};
}

export function getShouldItemizeIndividually(category: string): boolean {
  return targetCategoryConfig[category]?.alwaysItemizeIndividually ?? false;
}
