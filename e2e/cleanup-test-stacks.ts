import * as AWS from 'aws-sdk';
import {StackSummary} from 'aws-sdk/clients/cloudformation';
import {TEST_REGION, TEST_STACK_NAME_PREFIX} from './consts';

const cf = new AWS.CloudFormation({
  region: TEST_REGION,
  credentials: new AWS.SharedIniFileCredentials({profile: 'planes'}),
});

const getAllStacks = async (
  stacks: StackSummary[] = [],
  nextToken?: string,
): Promise<StackSummary[]> => {
  const result = await cf.listStacks({NextToken: nextToken}).promise();
  if (result.NextToken) {
    return getAllStacks(
      [...stacks, ...(result.StackSummaries || [])],
      result.NextToken,
    );
  }
  return stacks;
};

getAllStacks()
  .then((allStacks) => {
    console.log(
      '🚀 ~ file: cleanup-test-stacks.ts ~ line 26 ~ .then ~ allStacks',
      allStacks,
    );
    return allStacks.filter((stack) =>
      stack.StackName.startsWith(TEST_STACK_NAME_PREFIX),
    );
  })
  .then((stack) => {
    console.log(stack);
  });
