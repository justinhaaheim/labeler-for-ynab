import fileToProcess from '../sample_data.local/2024-08-27__02-29-02__targetOrderData__2-of-2__invoiceAndOrderData__40-orders__includesAggregationsData.json';
import {CombinedOutputDataZod} from '../src/TargetAPITypes';
import {getLabelsFromTargetOrderData} from '../src/TargetConverters';

console.log('Getting ynab transactions from Target Order Data...');
const labelOutput = getLabelsFromTargetOrderData(
  CombinedOutputDataZod.parse(fileToProcess),
  {
    cardType: 'TARGETCREDIT',
    groupByProductCategory: true,
    includeLinks: false,
    linkType: 'plain',
    shortenLinks: false,
  },
);

console.log('labelOutput:');
console.log(JSON.stringify(labelOutput, null, 2));
console.log('✅ Getting transactions complete!');
