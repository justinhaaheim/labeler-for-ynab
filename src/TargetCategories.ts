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
  {emoji: string; prettyName: string; shortPrettyName: string}
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
const categoryToPrettyNameMap: CategoryMap = {
  APPAREL: {emoji: '👗', prettyName: 'Apparel', shortPrettyName: 'Apparel'},
  ELECTRONICS: {
    emoji: '🎧',
    prettyName: 'Electronics',
    shortPrettyName: 'Electronics',
  },
  GROCERY: {emoji: '🍎🧃', prettyName: 'Grocery', shortPrettyName: 'Grocery'},
  'HEALTH AND BEAUTY': {
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

export function getCategoryEmojiOrFallback(category: string): {
  isEmoji: boolean;
  value: string;
} {
  const categoryTitleCase = titleCase(category.toLowerCase());
  if (category in categoryToPrettyNameMap) {
    const emojiNullable = categoryToPrettyNameMap[category]?.emoji;
    if (emojiNullable != null) {
      return {isEmoji: true, value: emojiNullable};
    }
  }
  return {isEmoji: false, value: categoryTitleCase};
}
