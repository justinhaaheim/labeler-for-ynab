// const {execSync} = require('child_process');
// const packageJson = require('../package.json');

import {execSync} from 'child_process';
import process from 'process';
import semverGt from 'semver/functions/gt';

// Relative to the location of this file
import packageJson from '../package.json';

const MAIN_BRANCH_NAME = 'main';

const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
  encoding: 'utf8',
}).trim();

// console.log('Current branch: ' + currentBranch);

if (currentBranch === MAIN_BRANCH_NAME) {
  console.log(`On ${MAIN_BRANCH_NAME} branch. Skipping version comparison.`);
  process.exit(0);
}

// Relative to the directory from which this script is run
const packageJsonMainBranchString = execSync(
  `git show ${MAIN_BRANCH_NAME}:./package.json`,
  {
    encoding: 'utf8',
  },
);
const packageJsonMainBranch = JSON.parse(packageJsonMainBranchString);

console.debug(
  `Current branch (${currentBranch}) version number: ` + packageJson.version,
);
console.debug(
  `${MAIN_BRANCH_NAME} branch version number: ` + packageJsonMainBranch.version,
);

if (!semverGt(packageJson.version, packageJsonMainBranch.version)) {
  console.log();
  console.error(
    `ERROR: Package version on this branch is not greater than ${MAIN_BRANCH_NAME} branch version. Each new PR must increment the version number.`,
  );
  process.exit(1);
}

process.exit(0);
