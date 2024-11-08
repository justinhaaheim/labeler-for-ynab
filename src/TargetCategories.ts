import type {
  TargetAPIOrderAggregationsData,
  TargetAPIProductClassificationObject,
} from './TargetAPITypes';

import nullthrows from 'nullthrows';

type CategoryConfigResolved = {
  alwaysItemizeIndividually: boolean;
  category: string;
};

type ProductCategoryMap = {
  [tcin: string]: CategoryConfigResolved;
};

export type ProductCategoryLookupFunction = (
  tcin: string,
) => CategoryConfigResolved;

const PRODUCT_CATEGORY_MAP_HARDCODED_ITEMS: ProductCategoryMap = {
  '47750281': {alwaysItemizeIndividually: true, category: 'Bag Fee'},
};

export const DEFAULT_PRODUCT_CATEGORY = 'Unknown Category';

const DEFAULT_CATEGORY_CONFIG_RESOLVED = {
  alwaysItemizeIndividually: false,
  category: DEFAULT_PRODUCT_CATEGORY,
};

type CategoryConfig = {
  alwaysItemizeIndividually?: boolean;
  emoji: string;
  prettyName: string;
  shortPrettyName: string;
};

type CategoryConfigWithChildren = CategoryConfig & {
  _children?: CategoryMap;
};

type CategoryMap = Record<string, CategoryConfigWithChildren>;

const FALLBACK_CATEGORY_CONFIG: CategoryConfig = {
  emoji: '❓',
  prettyName: 'Unknown Category',
  shortPrettyName: 'Unknown',
};

// TODO: Figure out how YNAB counts emojis in terms of character count to make sure that a big sync doesn't fail
const TARGET_CATEGORY_CONFIG_MAP: CategoryMap = {
  APPAREL: {
    alwaysItemizeIndividually: true,
    emoji: '👗🧦',
    prettyName: 'Apparel',
    shortPrettyName: 'Apparel',
  },
  ELECTRONICS: {
    _children: {
      'ELECTRONICS - MISCELLANEOUS': {
        _children: {
          'Pre-Paid Cards': {
            emoji: '💳',
            prettyName: 'Pre-Paid Cards',
            shortPrettyName: 'Pre-Paid Cards',
          },
        },
        // This is the same as the parent category; duplicated here to keep the typing simple
        alwaysItemizeIndividually: true,
        emoji: '🎧',
        prettyName: 'Electronics',
        shortPrettyName: 'Electronics',
      },
    },
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
  'GARAGE & HARDWARE': {
    emoji: '🔧💡',
    prettyName: 'Garage & Hardware',
    shortPrettyName: 'Hardware',
  },
  GROCERY: {emoji: '🍎🧃', prettyName: 'Grocery', shortPrettyName: 'Grocery'},
  'HEALTH AND BEAUTY': {
    _children: {
      'over-the-counter drugs and treatments': {
        emoji: '💊',
        prettyName: 'OTC Meds & Treatments',
        shortPrettyName: 'Meds',
      },
    },
    alwaysItemizeIndividually: true,
    emoji: '🧻💄',
    prettyName: 'Health & Beauty',
    shortPrettyName: 'Health',
  },
  HOME: {
    _children: {
      PETS: {
        emoji: '🐾🐈',
        prettyName: 'Pets',
        shortPrettyName: 'Pets',
      },
    },
    emoji: '🏡',
    prettyName: 'Home',
    shortPrettyName: 'Home',
  },
  KITCHEN: {emoji: '🍴', prettyName: 'Kitchen', shortPrettyName: 'Kitchen'},
  'LAUNDRY CLEANING AND CLOSET': {
    _children: {
      'LAUNDRY & CLOSET': {
        emoji: '🧺',
        prettyName: 'Laundry Supplies',
        shortPrettyName: 'Laundry',
      },
      cleaning: {
        emoji: '🧼',
        prettyName: 'Cleaning Supplies',
        shortPrettyName: 'Cleaning',
      },
      'disposable household items': {
        emoji: '🗑️',
        prettyName: 'Disposable Household Items',
        shortPrettyName: 'Household',
      },
    },
    emoji: '🧺🧼',
    prettyName: 'Laundry, Cleaning & Closet',
    shortPrettyName: 'Laundry & Cleaning',
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
} as const;

// export function getFormattedCategoryOrFallback(
//   category: string,
//   type: 'emoji',
// ): string {
//   if (type !== 'emoji') {
//     throw new Error(`Invalid type: ${type}`);
//   }
//   const emojiOrFallbackObject = getCategoryEmojiOrFallback(category);

//   if (emojiOrFallbackObject.isEmoji) {
//     return emojiOrFallbackObject.value;
//   }

//   return `[${emojiOrFallbackObject.value}]`;
// }

// function getCategoryEmojiOrFallback(category: string): {
//   isEmoji: boolean;
//   value: string;
// } {
//   const categoryTitleCase = titleCase(category.toLowerCase());
//   if (category in TARGET_CATEGORY_CONFIG_MAP) {
//     const emojiNullable = TARGET_CATEGORY_CONFIG_MAP[category]?.emoji;
//     if (emojiNullable != null) {
//       return {isEmoji: true, value: emojiNullable};
//     }
//   }
//   return {isEmoji: false, value: categoryTitleCase};
// }

// export function getShouldItemizeIndividually(category: string): boolean {
//   return (
//     TARGET_CATEGORY_CONFIG_MAP[category]?.alwaysItemizeIndividually ?? false
//   );
// }

function getProductCategoryConfigFromMap(
  classificationObject?: TargetAPIProductClassificationObject,
  type: 'emoji' = 'emoji',
): CategoryConfigResolved {
  const typeName = classificationObject?.product_type_name ?? null;
  const subTypeName = classificationObject?.product_subtype_name ?? null;
  const merchTypeName = classificationObject?.merchandise_type_name ?? null;

  let currentCategoryConfig: CategoryConfigWithChildren =
    FALLBACK_CATEGORY_CONFIG;

  if (typeName != null && TARGET_CATEGORY_CONFIG_MAP[typeName] != null) {
    currentCategoryConfig = nullthrows(TARGET_CATEGORY_CONFIG_MAP[typeName]);

    if (
      subTypeName != null &&
      currentCategoryConfig._children?.[subTypeName] != null
    ) {
      currentCategoryConfig = nullthrows(
        currentCategoryConfig._children?.[subTypeName],
      );

      if (
        merchTypeName != null &&
        currentCategoryConfig._children?.[merchTypeName]
      ) {
        currentCategoryConfig = nullthrows(
          currentCategoryConfig._children?.[merchTypeName],
        );
      }
    }
  }

  return {
    alwaysItemizeIndividually:
      currentCategoryConfig.alwaysItemizeIndividually ?? false,
    category: currentCategoryConfig[type],
  };
}

function createProductCategoryMap(
  orderAggregationsData: TargetAPIOrderAggregationsData,
): ProductCategoryMap {
  const map =
    orderAggregationsData?.['order_lines'].reduce<
      Record<string, CategoryConfigResolved>
    >((acc, currentValue) => {
      const categoryConfig = getProductCategoryConfigFromMap(
        currentValue.item.product_classification,
      );

      acc[currentValue.item.tcin] = categoryConfig;
      return acc;
    }, {}) ?? {};

  return {...PRODUCT_CATEGORY_MAP_HARDCODED_ITEMS, ...map};
}

export function getProductCategoryLookupFunction(
  orderAggregationsData: TargetAPIOrderAggregationsData,
): ProductCategoryLookupFunction {
  const productCategoryMap = createProductCategoryMap(orderAggregationsData);

  return (tcin: string) => {
    return productCategoryMap[tcin] ?? DEFAULT_CATEGORY_CONFIG_RESOLVED;
  };
}

// Categories:
// APPAREL > accessories and shoes > Bags, Luggage and Accessories
// APPAREL > clothing > Bottoms
// APPAREL > clothing > Dresses and Jumpsuits
// APPAREL > clothing > Shapewear and Lingerie
// APPAREL > clothing > Socks and Hosiery
// APPAREL > clothing > Tops
// ELECTRONICS > audio > Headphones and Headsets
// ELECTRONICS > COMPUTER > input devices
// ELECTRONICS > COMPUTER > Portable Computers
// ELECTRONICS > ELECTRONICS - MISCELLANEOUS > batteries, chargers, and adapters
// ELECTRONICS > ELECTRONICS - MISCELLANEOUS > Pre-Paid Cards
// ELECTRONICS > phones and wearables > wearable technology
// ELECTRONICS > televisions and projectors > TVs and home theater systems
// ELECTRONICS > video games > video game hardware and accessories
// FURNITURE > seating and tables > indoor seating
// FURNITURE > seating and tables > standalone tables
// GARAGE & HARDWARE > HOME IMPROVEMENT > decorative hardware
// GARAGE & HARDWARE > HOME IMPROVEMENT > Hardware Fasteners
// GARAGE & HARDWARE > HOME IMPROVEMENT > light bulbs, switches and light accessories
// GROCERY > BABY FOOD AND FORMULA > formula and pediatric supplements
// GROCERY > BAKING AND COOKING COMPONENTS > baking chips, cocoa and milk
// GROCERY > BAKING AND COOKING COMPONENTS > Baking Mixes, Flours and Leavening Agents
// GROCERY > BAKING AND COOKING COMPONENTS > seasonings and extracts
// GROCERY > BAKING AND COOKING COMPONENTS > shortening and cooking oils
// GROCERY > BAKING AND COOKING COMPONENTS > syrups, sugars and sweeteners
// GROCERY > BAKING AND COOKING COMPONENTS > vinegar and cooking wine
// GROCERY > BEVERAGE > alcoholic beverages
// GROCERY > BEVERAGE > coffee and tea
// GROCERY > BEVERAGE > soft drinks, water and juice
// GROCERY > BEVERAGE > sports and nutritional drinks
// GROCERY > BREAD AND DESSERTS > bread, rolls and tortillas
// GROCERY > BREAD AND DESSERTS > cakes and cupcakes
// GROCERY > BREAD AND DESSERTS > cookies, brownies and bars
// GROCERY > BREAD AND DESSERTS > crusts, doughs and edible papers
// GROCERY > CANDY > candy and chocolate
// GROCERY > DAIRY AND EGGS > butter and margarine
// GROCERY > DAIRY AND EGGS > eggs and egg substitutes
// GROCERY > DAIRY AND EGGS > milk, cheese and cream
// GROCERY > DAIRY AND EGGS > yogurt products
// GROCERY > MEAT, POULTRY AND SEAFOOD > meat and poultry
// GROCERY > MEAT, POULTRY AND SEAFOOD > sausages, bacon and pate
// GROCERY > MEAT, POULTRY AND SEAFOOD > vegetable protein
// GROCERY > PASTA, GRAIN AND CEREALS > cereals
// GROCERY > PASTA, GRAIN AND CEREALS > Pasta, Rice and Grains
// GROCERY > PREPARED FOODS > prepared foods
// GROCERY > PREPARED FOODS > production food and drinks
// GROCERY > SAUCES, CONDIMENTS AND SPREADS > condiments and sauces
// GROCERY > SAUCES, CONDIMENTS AND SPREADS > salad dressing and toppings
// GROCERY > SAUCES, CONDIMENTS AND SPREADS > spreads
// GROCERY > SNACK > chips and snacks
// GROCERY > SNACK > dips and salsas
// GROCERY > SNACK > nuts, dried fruit and vegetables
// GROCERY > SNACK > snack and nutrition bars
// GROCERY > VEGETABLES AND FRUITS > fruit and vegetables
// HEALTH AND BEAUTY > beauty care products > Bath and Body Skincare
// HEALTH AND BEAUTY > beauty care products > Cosmetic Accessories and Tools
// HEALTH AND BEAUTY > beauty care products > Cosmetics
// HEALTH AND BEAUTY > beauty care products > facial skincare
// HEALTH AND BEAUTY > beauty care products > hair styling products
// HEALTH AND BEAUTY > beauty care products > hair styling tools and accessories
// HEALTH AND BEAUTY > beauty care products > shampoos, conditioners, and hair treatments
// HEALTH AND BEAUTY > medical supplies > First Aid
// HEALTH AND BEAUTY > over-the-counter drugs and treatments > cold, allergy and digestive health treatments
// HEALTH AND BEAUTY > over-the-counter drugs and treatments > Painkillers and Muscle Treatments
// HEALTH AND BEAUTY > over-the-counter drugs and treatments > Vitamins and Supplements
// HEALTH AND BEAUTY > personal hygiene products > Antiperspirant and Deodorant
// HEALTH AND BEAUTY > personal hygiene products > Eye Care
// HEALTH AND BEAUTY > personal hygiene products > incontinence care
// HEALTH AND BEAUTY > personal hygiene products > Oral Care
// HEALTH AND BEAUTY > personal hygiene products > Personal Wipes
// HEALTH AND BEAUTY > personal hygiene products > shaving and hair removal
// HEALTH AND BEAUTY > personal hygiene products > Tissue, Toilet Paper and Cotton Balls
// HEALTH AND BEAUTY > SKINCARE > suncare and tanning
// HOME > BATH > Bath Towels
// HOME > BEDDING > basic pillows
// HOME > BEDDING > bedding sheets
// HOME > DINING & SERVEWARE > Dinnerware
// HOME > DINING & SERVEWARE > drinkware
// HOME > DINING & SERVEWARE > serveware
// HOME > INDOOR LIGHTING > Freestanding Lamps
// HOME > PETS > pet food and snacks
// HOME > PETS > Pet Toys and Exercise
// HOME > PETS > Pet Waste
// HOME > SOFT HOME > Kitchen Textiles
// KITCHEN > COOKING APPLIANCES > cookware appliances
// KITCHEN > KITCHEN ORGANIZATION > household food or beverage storage containers
// KITCHEN > KITCHEN TOOLS > kitchen thermometers and timers
// KITCHEN > KITCHEN TOOLS > slicers, graters and peelers
// LAUNDRY CLEANING AND CLOSET > cleaning > household cleaning supplies
// LAUNDRY CLEANING AND CLOSET > disposable household items > disposable tableware
// LAUNDRY CLEANING AND CLOSET > disposable household items > Trash and refuse bags
// LAUNDRY CLEANING AND CLOSET > LAUNDRY & CLOSET > garment care and storage
// LAUNDRY CLEANING AND CLOSET > LAUNDRY & CLOSET > Garment irons and steamers
// LAUNDRY CLEANING AND CLOSET > LAUNDRY & CLOSET > laundry supplies
// NO_TYPE_NAME > NO_SUBTYPE_NAME > NO_MERCH_TYPE_NAME
// PATIO & OUTDOOR DECOR > fire and outdoor cooking > matches and fire lighting tools
// PATIO & OUTDOOR DECOR > GARDENING > pest control products
// PATIO & OUTDOOR DECOR > PATIO & OUTDOOR FURNITURE > patio seating
// STATIONERY & OFFICE SUPPLIES > OFFICE SUPPLIES > adhesives, fasteners, and magnets
// STATIONERY & OFFICE SUPPLIES > OFFICE SUPPLIES > paper products
// STATIONERY & OFFICE SUPPLIES > OFFICE SUPPLIES > presentation boards and accessories
