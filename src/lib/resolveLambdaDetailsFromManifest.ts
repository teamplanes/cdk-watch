import {CloudFormation} from 'aws-sdk';
import {LambdaManifestType, CdkWatchManifest} from '../types.d';
import {resolveStackNameForLambda} from './resolveStackNameForLambda';

const resolveLambdaDetailFromManifest = async (
  lambdaManifest: LambdaManifestType,
): Promise<{
  detail: CloudFormation.StackResourceDetail;
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
    .then(({StackResourceDetail}) => ({
      detail: StackResourceDetail as CloudFormation.StackResourceDetail,
      lambdaManifest,
    }));
};

export const resolveLambdaDetailsFromManifest = (
  manifest: CdkWatchManifest,
): Promise<
  {
    detail: CloudFormation.StackResourceDetail;
    lambdaCdkPath: string;
    lambdaManifest: LambdaManifestType;
  }[]
> =>
  Promise.all(
    Object.keys(manifest.lambdas).map(async (lambdaCdkPath) => {
      const details = await resolveLambdaDetailFromManifest(
        manifest.lambdas[lambdaCdkPath],
      );
      return {lambdaCdkPath, ...details};
    }),
  );
