import {CloudFormation} from 'aws-sdk';
import {LambdaManifestType} from '../types.d';

export const resolveStackNameForLambda = async (
  lambdaManifest: LambdaManifestType,
): Promise<string> => {
  const cfn = new CloudFormation({maxRetries: 10});
  return lambdaManifest.nestedStackLogicalIds.reduce(
    (promise, nextNestedStack) =>
      promise.then((stackName) =>
        cfn
          .describeStackResource({
            StackName: stackName,
            LogicalResourceId: nextNestedStack,
          })
          .promise()
          .then(
            (result) =>
              result.StackResourceDetail?.PhysicalResourceId as string,
          ),
      ),
    Promise.resolve(lambdaManifest.rootStackName),
  );
};
