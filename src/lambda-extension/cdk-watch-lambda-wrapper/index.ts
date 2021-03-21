#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable no-underscore-dangle */
import * as AWS from 'aws-sdk';
import {Log, patchConsole} from './patchConsole';

const logs: Log[] = [];
const file = process.argv.pop();

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION,
});
const apigwManagementApi = new AWS.ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: process.env.CDK_WATCH_API_GATEWAY_MANAGEMENT_URL,
});

const handlerFunctionName = 'cdkWatchWrappedHandler';
// eslint-disable-next-line no-underscore-dangle
const originalHandlerName = process.env._HANDLER;

const postToWS = async (postData: Log[]): Promise<void> => {
  let connectionData;

  try {
    connectionData = await ddb
      .scan({
        TableName: process.env.CDK_WATCH_CONNECTION_TABLE_NAME as string,
        ProjectionExpression: 'connectionId',
      })
      .promise();
  } catch (e) {
    console.error(`Failed to scan for connections`, e);
    return;
  }

  const postCalls =
    connectionData.Items &&
    connectionData.Items.map(async ({connectionId}) => {
      try {
        await apigwManagementApi
          .postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify(postData, null, 2),
          })
          .promise();
      } catch (e) {
        if (e.statusCode === 410) {
          await ddb
            .delete({
              TableName: process.env.CDK_WATCH_CONNECTION_TABLE_NAME as string,
              Key: {connectionId},
            })
            .promise()
            .catch((error) =>
              console.log('Failed to delete connection', error),
            );
        } else {
          console.log('Failed to send log', e);
        }
      }
    });

  await Promise.all(postCalls || []);
};

try {
  const handlerPath = `${process.env.LAMBDA_TASK_ROOT}/${originalHandlerName}`;
  const handlerArray = handlerPath.split('.');
  const functionName = handlerArray.pop();
  const handlerFile = handlerArray.join('');
  process.env._HANDLER = `${handlerFile}.${handlerFunctionName}`;

  const handler = require(handlerFile); // eslint-disable-line
  const originalFunction = handler[functionName as string];
  const wrappedHandler = async (...args: any[]) => {
    const sendLogs = async () => {
      const payload = [...logs];
      logs.splice(0);
      if (!payload.length) return;
      await postToWS(payload).catch(console.error);
    };
    const interval = setInterval(sendLogs, 100);
    try {
      const result = await originalFunction(...args);
      clearInterval(interval);
      await sendLogs();
      return result;
    } catch (e) {
      console.error('Main handler threw error', e);
      clearInterval(interval);
      await sendLogs();
      throw e;
    }
  };

  Object.defineProperty(handler, handlerFunctionName, {
    get: () => wrappedHandler,
    enumerable: true,
  });
} catch (error) {
  console.log('Failed wrapping handler', error);
}

// eslint-disable-next-line import/no-dynamic-require
module.exports = require(file as string);
// Patching the logs is done following the same methodology as the lambda runtime:
// https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/blob/a850fd5adad5f32251350ce23ca2c8934b2fa542/src/utils/LogPatch.ts
patchConsole(logs);
