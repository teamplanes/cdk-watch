import {CloudFormation, Lambda} from 'aws-sdk';
import {LambdaManifestType, CdkWatchManifest} from '../types.d';

const resolveLambdaDetailFromManifest = async (
  lambdaManifest: LambdaManifestType,
): Promise<{
  detail: CloudFormation.StackResourceDetail;
  lambdaManifest: LambdaManifestType;
}> => {
  const cfn = new CloudFormation();
  const lambdaStackName = await lambdaManifest.nestedStackLogicalIds.reduce(
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
