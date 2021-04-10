import execa from 'execa';
import path from 'path';
import {TEST_REGION, TEST_STACK_NAME_PREFIX} from './consts';

const cdkAppPath = path.join(__dirname, 'app');
const stackName = `${TEST_STACK_NAME_PREFIX}${Math.random()
  .toString(36)
  .substring(7)}`;

const cdk = async (cdkCommand: string) => {
  const command = `npx cdk ${cdkCommand} -c stackName=${stackName} -c region=${TEST_REGION} --profile=planes`;
  console.log(`Running command: ${command}`);
  const result = await execa.command(command, {
    cwd: cdkAppPath,
    cleanup: true,
    reject: false,
    all: true,
  });
  if (result.exitCode !== 0) {
    console.log(result.all);
    throw new Error('CDK command failed to run');
  }
};

jest.setTimeout(1000 * 120);

afterAll(async () => {
  await cdk('destroy --force');
});

test('can deploy stack', async () => {
  await cdk('deploy');
});
