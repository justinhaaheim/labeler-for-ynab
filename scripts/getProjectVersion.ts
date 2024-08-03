import {exec} from 'child_process';
import {promisify} from 'util';

const execAsync = promisify(exec);

async function getGitVersion(): Promise<string> {
  try {
    // Get the total number of commits
    const {stdout: commitCount} = await execAsync('git rev-list --count HEAD');

    // Get the date of the current commit
    const {stdout: commitDate} = await execAsync(
      'git log -1 --format=%cd --date=short',
    );

    // Combine the commit count and date
    const version = `${commitCount.trim()}-${commitDate.trim()}`;

    return version;
  } catch (error) {
    console.error('Error executing git commands:', error);
    return 'Unable to determine version';
  }
}

async function main() {
  const version = await getGitVersion();
  console.log(`Current version: ${version}`);
}

main();
