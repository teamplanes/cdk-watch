/* eslint-disable no-console */

/**
 * These handlers are called by the realtime logs API Gateway (not by the
 * library itself).
 */

import * as AWS from 'aws-sdk';

const dynamoDb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION,
});

export const onConnect = async (
  event: AWSLambda.APIGatewayProxyWithLambdaAuthorizerEvent<null>,
): Promise<any> => {
  const lambdaIds = event.queryStringParameters?.lambdas?.split(',') ?? [];

  if (!lambdaIds.length)
    return {
      statusCode: 400,
      body: 'You must provide at least one lambda parameter',
    };

  const putParams = lambdaIds.map((lambdaId: string) => ({
    TableName: process.env.CDK_WATCH_CONNECTION_TABLE_NAME as string,
    Item: {
      connectionId: event.requestContext.connectionId,
      lambdaId,
    },
  }));

  try {
    await Promise.all(
      putParams.map((putParam) => dynamoDb.put(putParam).promise()),
    );
  } catch (err) {
    console.error(err);
    return {statusCode: 500, body: `Failed to connect.`};
  }

  return {statusCode: 200, body: 'Connected.'};
};

export const onDisconnect = async (
  event: AWSLambda.APIGatewayProxyWithLambdaAuthorizerEvent<null>,
): Promise<any> => {
  try {
    await dynamoDb
      .delete({
        TableName: process.env.CDK_WATCH_CONNECTION_TABLE_NAME as string,
        Key: {
          connectionId: event.requestContext.connectionId,
        },
      })
      .promise();
  } catch (err) {
    console.error(err);
    return {statusCode: 500, body: `Failed to disconnect.`};
  }

  return {statusCode: 200, body: 'Disconnected.'};
};

export const onMessage = async (
  event: AWSLambda.APIGatewayProxyWithLambdaAuthorizerEvent<null>,
): Promise<any> => {
  if (event.body === 'ping') {
    return {statusCode: 200, body: 'pong'};
  }
  return {statusCode: 422, body: 'wrong'};
};
