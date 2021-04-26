import {CloudFormation, Lambda} from 'aws-sdk';
import {LambdaManifestType, CdkWatchManifest, LambdaDetail} from '../types.d';
import {resolveStackNameForLambda} from './resolveStackNameForLambda';

const resolveLambdaNameFromManifest = async (
  lambdaManifest: LambdaManifestType,
): Promise<{
  functionName: string;
  lambdaManifest: LambdaManifestType;
  layers: string[];
}> => {
  const cfn = new CloudFormation({maxRetries: 10});
  const lambda = new Lambda({maxRetries: 10});
  const lambdaStackName = await resolveStackNameForLambda(lambdaManifest);
  const {StackResourceDetail} = await cfn
    .describeStackResource({
      StackName: lambdaStackName,
      LogicalResourceId: lambdaManifest.lambdaLogicalId,
    })
    .promise();

  if (!StackResourceDetail?.PhysicalResourceId) {
    throw new Error(
      `Could not find name for lambda with Logical ID ${lambdaManifest.lambdaLogicalId}`,
    );
  }
  const functionName = StackResourceDetail?.PhysicalResourceId as string;
  const config = await lambda
    .getFunctionConfiguration({FunctionName: functionName})
    .promise();

  return {
    layers:
      config.Layers?.map((layer) => {
        const {6: name} = layer.Arn?.split(':') || '';
        return name;
      }).filter(Boolean) || [],
    functionName,
    lambdaManifest,
  };
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
