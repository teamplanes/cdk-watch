import {ApiGatewayV2, CloudFormation} from 'aws-sdk';
import {CdkWatchManifest} from '../types.d';

// @todo: optimise - potentially by memoizing calls for resources
export const resolveLogEndpointDetailsFromManifest = async (
  manifest: CdkWatchManifest,
): Promise<{[lambdaPath: string]: string | undefined}> => {
  const cfn = new CloudFormation({maxRetries: 10});
  const apigw = new ApiGatewayV2({maxRetries: 10});
  return Promise.all(
    Object.keys(manifest.lambdas).map(async (key) => {
      const lambda = manifest.lambdas[key];
      if (
        !lambda.realTimeLogsStackLogicalId ||
        !lambda.realTimeLogsApiLogicalId
      )
        return [key, undefined];
      const logsStackResource = await cfn
        .describeStackResource({
          StackName: lambda.rootStackName,
          LogicalResourceId: lambda.realTimeLogsStackLogicalId,
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
          LogicalResourceId: lambda.realTimeLogsApiLogicalId,
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

      return [key, `${res.ApiEndpoint}/v1`];
    }),
  ).then(Object.fromEntries);
};
