import {CombinedOutputDataZod} from '../src/TargetAPITypes';
import {getLabelsFromTargetOrderData} from '../src/TargetConverters';
import fileToProcess from '../tmp/2024-08-23__22-26-20__targetOrderData__2-of-2__invoiceAndOrderData.json';

console.log('Getting ynab transactions from Target Order Data...');
const labelOutput = getLabelsFromTargetOrderData(
  CombinedOutputDataZod.parse(fileToProcess),
  {
    cardType: 'TARGETCREDIT',
    includeLinks: false,
    linkType: 'plain',
    shortenLinks: false,
  },
);

console.log('labelOutput:');
console.log(JSON.stringify(labelOutput, null, 2));
console.log('✅ Getting transactions complete!');
