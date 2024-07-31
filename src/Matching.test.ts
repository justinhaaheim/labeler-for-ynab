import {type MatchCandidate, resolveBestMatchForLabels} from './Matching';

describe('resolveBestMatchForLabels', () => {
  // This is a regression test to cover a bug where only one transaction would get a match, the other would have none.
  it('should choose the correct match candidates for two transactions of the same amount', () => {
    const matchCandidates: MatchCandidate[] = [
      {
        candidates: [
          {
            account_id: 'a1',
            account_name: '📦 Chase Amazon Card',
            amount: -74970,
            approved: false,
            category_name: 'Uncategorized',
            cleared: 'cleared',
            date: '2023-06-08',
            dateDiff: 0,
            deleted: false,
            id: 'c1',
            import_id: 'YNAB:-74970:2023-06-08:1',
            import_payee_name: 'Amazon',
            import_payee_name_original: 'AMZN Mktp US*U91LS2SX3',
            payee_id: '14e768f7-e886-41a8-bee9-8708db9e04d8',
            payee_name: 'Amazon',
            subtransactions: [],
          },
          {
            account_id: 'a1',
            account_name: '📦 Chase Amazon Card',
            amount: -74970,
            approved: false,
            category_name: 'Uncategorized',
            cleared: 'cleared',
            date: '2023-06-09',
            dateDiff: 86400000,
            deleted: false,
            id: 'c2',
            import_id: 'YNAB:-74970:2023-06-09:1',
            import_payee_name: 'Amazon',
            import_payee_name_original: 'AMZN Mktp US*5E8SD6T73',
            payee_id: '14e768f7-e886-41a8-bee9-8708db9e04d8',
            payee_name: 'Amazon',
            subtransactions: [],
          },
        ],
        label: {
          amount: -74.97,
          date: '2023-06-08',
          id: '112-3082846-1111111__1_of_2',
          memo: [
            {flexShrink: 0, onOverflow: 'omit', value: '(charge 1/2)'},
            {
              flexShrink: 1,
              onOverflow: 'truncate',
              value:
                'Linen Curtains 96 Inch Long Linen Sheer Curtains Ivory Linen Textured Curtains Light Filtering Grommet Window Treatments Panels/Drapes for Livingroom Privacy Added (2 Panels, 52Wx96L, Ivory)',
            },
          ],
          payee: 'Amazon',
        },
      },
      {
        candidates: [
          {
            account_id: 'a1',
            account_name: '📦 Chase Amazon Card',
            amount: -74970,
            approved: false,
            category_name: 'Uncategorized',
            cleared: 'cleared',
            date: '2023-06-08',
            dateDiff: 0,
            deleted: false,
            id: 'c1',
            import_id: 'YNAB:-74970:2023-06-08:1',
            import_payee_name: 'Amazon',
            import_payee_name_original: 'AMZN Mktp US*U91LS2SX3',
            payee_id: '14e768f7-e886-41a8-bee9-8708db9e04d8',
            payee_name: 'Amazon',
            subtransactions: [],
          },
          {
            account_id: 'a1',
            account_name: '📦 Chase Amazon Card',
            amount: -74970,
            approved: false,
            category_name: 'Uncategorized',
            cleared: 'cleared',
            date: '2023-06-09',
            dateDiff: 86400000,
            deleted: false,
            id: 'c2',
            import_id: 'YNAB:-74970:2023-06-09:1',
            import_payee_name: 'Amazon',
            import_payee_name_original: 'AMZN Mktp US*5E8SD6T73',
            payee_id: '14e768f7-e886-41a8-bee9-8708db9e04d8',
            payee_name: 'Amazon',
            subtransactions: [],
          },
        ],
        label: {
          amount: -74.97,
          date: '2023-06-07',
          id: '112-3082846-1111111__2_of_2',
          memo: [
            {flexShrink: 0, onOverflow: 'omit', value: '(charge 2/2)'},
            {
              flexShrink: 1,
              onOverflow: 'truncate',
              value:
                'Linen Curtains 96 Inch Long Linen Sheer Curtains Ivory Linen Textured Curtains Light Filtering Grommet Window Treatments Panels/Drapes for Livingroom Privacy Added (2 Panels, 52Wx96L, Ivory)',
            },
          ],
          payee: 'Amazon',
        },
      },
    ];

    const result = resolveBestMatchForLabels(matchCandidates);

    console.log('result:', result);
    expect(result[0]?.label.id).toContain('1_of_2');
    expect(result[0]?.transactionMatch?.date).toMatch('2023-06-08');

    expect(result[1]?.label.id).toContain('2_of_2');
    expect(result[1]?.transactionMatch?.date).toMatch('2023-06-09');
  });
});
