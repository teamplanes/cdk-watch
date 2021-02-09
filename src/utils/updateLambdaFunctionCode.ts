import {AWSError, CloudFormation, Lambda} from 'aws-sdk';
import {PromiseResult} from 'aws-sdk/lib/request';
import {zipDirectory} from './zipDirectory';

export const updateLambdaFunctionCode = async (
  watchOutdir: string,
  detail: CloudFormation.StackResourceDetail,
): Promise<PromiseResult<Lambda.FunctionConfiguration, AWSError>> => {
  const lambda = new Lambda();
  return zipDirectory(watchOutdir).then((zip) => {
    return lambda
      .updateFunctionCode({
        FunctionName: detail.PhysicalResourceId as string,
        ZipFile: zip,
      })
      .promise();
  });
};
