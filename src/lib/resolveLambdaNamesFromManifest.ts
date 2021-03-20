import {CloudFormation} from 'aws-sdk';
import {LambdaManifestType, CdkWatchManifest, LambdaDetail} from '../types.d';
import {resolveStackNameForLambda} from './resolveStackNameForLambda';

const resolveLambdaNameFromManifest = async (
  lambdaManifest: LambdaManifestType,
): Promise<{
  functionName: string;
  lambdaManifest: LambdaManifestType;
}> => {
  const cfn = new CloudFormation({maxRetries: 10});
  const lambdaStackName = await resolveStackNameForLambda(lambdaManifest);

  return cfn
    .describeStackResource({
      StackName: lambdaStackName,
      LogicalResourceId: lambdaManifest.lambdaLogicalId,
    })
    .promise()
    .then(({StackResourceDetail}) => {
      if (!StackResourceDetail?.PhysicalResourceId) {
        throw new Error(
          `Could not find name for lambda with Logical ID ${lambdaManifest.lambdaLogicalId}`,
        );
      }
      return {
        functionName: StackResourceDetail?.PhysicalResourceId as string,
        lambdaManifest,
      };
    });
};

export const resolveLambdaNamesFromManifest = (
  manifest: CdkWatchManifest,
): Promise<LambdaDetail[]> =>
  Promise.all(
    Object.keys(manifest.lambdas).map(async (lambdaCdkPath) => {
      const details = await resolveLambdaNameFromManifest(
        manifest.lambdas[lambdaCdkPath],
      );
      return {lambdaCdkPath, ...details};
    }),
  );
