/** @type {import('ts-jest').JestConfigWithTsJest} **/
const config = {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': [
      'ts-jest',
      {
        diagnostics: {
          ignoreCodes: [
            'TS151001', // Disable If you have issues related to imports, you should consider setting `esModuleInterop` to `true` in your TypeScript configuration file...
          ],
        },
      },
    ],
  },
};

export default config;
