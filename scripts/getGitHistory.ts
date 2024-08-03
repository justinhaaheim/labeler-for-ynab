import {exec} from 'child_process';
import {promisify} from 'util';

const execAsync = promisify(exec);

interface Commit {
  hash: string;
  message: string;
  number: number;
}

async function getMainBranchName(): Promise<string> {
  try {
    const {stdout} = await execAsync(
      "git remote show origin | sed -n '/HEAD branch/s/.*: //p'",
    );
    return stdout.trim();
  } catch (error) {
    console.error('Error getting main branch name:', error);
    return 'main'; // Default to 'main' if we can't determine it
  }
}

async function getGitVersion(): Promise<string> {
  try {
    const mainBranch = await getMainBranchName();
    const {stdout: commitCount} = await execAsync(
      `git rev-list --count origin/${mainBranch}`,
    );
    const {stdout: commitDate} = await execAsync(
      `git log -1 --format=%cd --date=short origin/${mainBranch}`,
    );
    return `${commitCount.trim()}-${commitDate.trim()}`;
  } catch (error) {
    console.error('Error executing git commands:', error);
    return 'Unable to determine version';
  }
}

async function getGitCommitHistory(): Promise<Commit[]> {
  try {
    const mainBranch = await getMainBranchName();
    const {stdout} = await execAsync(
      `git log origin/${mainBranch} --reverse --format="%H %s"`,
    );
    const commits = stdout.trim().split('\n');
    return commits.map((commit, index) => {
      const [hash, ...messageParts] = commit.split(' ');
      return {
        hash: hash,
        message: messageParts.join(' '),
        number: index + 1,
      };
    });
  } catch (error) {
    console.error('Error getting git commit history:', error);
    return [];
  }
}

async function main() {
  const version = await getGitVersion();
  console.log(`Current version (based on main branch): ${version}\n`);

  console.log('Commit History (main branch):');
  const commitHistory = await getGitCommitHistory();
  commitHistory.forEach((commit) => {
    console.log(`#${commit.number}: ${commit.message} (${commit.hash})`);
  });
}

main();
