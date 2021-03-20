import {ApiGatewayV2, CloudFormation} from 'aws-sdk';
import {LambdaDetail} from '../../types.d';

// @todo: optimise - potentially by memoizing calls for resources
export const resolveLogEndpointDetailsFromLambdas = async (
  lambdas: LambdaDetail[],
): Promise<{[lambdaPath: string]: string | undefined}> => {
  const cfn = new CloudFormation({maxRetries: 10});
  const apigw = new ApiGatewayV2({maxRetries: 10});
  return Promise.all(
    lambdas.map(async (lambda) => {
      if (
        !lambda.lambdaManifest.realTimeLogsStackLogicalId ||
        !lambda.lambdaManifest.realTimeLogsApiLogicalId
      )
        return [lambda.lambdaCdkPath, undefined];
      const logsStackResource = await cfn
        .describeStackResource({
          StackName: lambda.lambdaManifest.rootStackName,
          LogicalResourceId: lambda.lambdaManifest.realTimeLogsStackLogicalId,
        })
        .promise();

      if (!logsStackResource.StackResourceDetail?.PhysicalResourceId) {
        throw new Error(
          'Could not find resource for real-time logs api, make sure your stack is up-to-date',
        );
      }
      const logsApiResource = await cfn
        .describeStackResource({
          StackName: logsStackResource.StackResourceDetail?.PhysicalResourceId,
          LogicalResourceId: lambda.lambdaManifest.realTimeLogsApiLogicalId,
        })
        .promise();

      if (!logsApiResource.StackResourceDetail?.PhysicalResourceId) {
        throw new Error(
          'Could not find resource for real-time logs api, make sure your stack is up-to-date',
        );
      }

      const res = await apigw
        .getApi({
          ApiId: logsApiResource.StackResourceDetail.PhysicalResourceId,
        })
        .promise();

      return [lambda.lambdaCdkPath, `${res.ApiEndpoint}/v1`];
    }),
  ).then(Object.fromEntries);
};
