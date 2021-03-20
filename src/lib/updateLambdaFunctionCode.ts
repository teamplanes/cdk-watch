import {AWSError, CloudFormation, Lambda} from 'aws-sdk';
import {PromiseResult} from 'aws-sdk/lib/request';
import {zipDirectory} from './zipDirectory';

export const updateLambdaFunctionCode = async (
  watchOutdir: string,
  functionName: string,
): Promise<PromiseResult<Lambda.FunctionConfiguration, AWSError>> => {
  const lambda = new Lambda({maxRetries: 10});
  return zipDirectory(watchOutdir).then((zip) => {
    return lambda
      .updateFunctionCode({
        FunctionName: functionName as string,
        ZipFile: zip,
      })
      .promise();
  });
};
