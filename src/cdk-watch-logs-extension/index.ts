#!/usr/bin/env node
/* eslint-disable consistent-return */
/* eslint-disable no-await-in-loop */
import * as AWS from 'aws-sdk';
import {register, next} from './extensionsApi';
import {subscribe} from './logsApi';
import {listen} from './httpListener';
import {LogsQueueLog} from './interfaces';
import {TIMEOUT_MS, RECEIVER_PORT} from './consts';

const dynamoDb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION,
});

const apigwManagementApi = new AWS.ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: process.env.CDK_WATCH_API_GATEWAY_MANAGEMENT_URL,
});
console.log(
  '🚀 ~ file: index.ts ~ line 20 ~ process.env.CDK_WATCH_API_GATEWAY_MANAGEMENT_URL',
  process.env.CDK_WATCH_API_GATEWAY_MANAGEMENT_URL,
);

enum EventType {
  INVOKE = 'INVOKE',
  SHUTDOWN = 'SHUTDOWN',
}

const postToWS = async (postData: LogsQueueLog[]) => {
  let connectionData;

  try {
    connectionData = await dynamoDb
      .scan({
        TableName: process.env.CDK_WATCH_CONNECTION_TABLE_NAME as string,
        ProjectionExpression: 'connectionId',
      })
      .promise();
  } catch (e) {
    console.error(e);
    return {statusCode: 500, body: e.stack};
  }
  console.log(
    '🚀 ~ file: index.ts ~ line 71 ~ postToWS ~ connectionData.Items',
    connectionData.Items,
  );

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
          await dynamoDb
            .delete({
              TableName: process.env.CDK_WATCH_CONNECTION_TABLE_NAME as string,
              Key: {connectionId},
            })
            .promise();
        } else {
          throw e;
        }
      }
    });

  try {
    await Promise.all(postCalls || []);
  } catch (e) {
    console.log('🚀 ~ file: index.ts ~ line 111 ~ postToWS ~ e', e);
    return {statusCode: 500, body: e.stack};
  }
};

const uploadLogs = async (logsQueue: LogsQueueLog[]) => {
  await new Promise((res) => setTimeout(res, TIMEOUT_MS));
  while (logsQueue.length > 0) {
    const newLogsQueue = [...logsQueue];
    logsQueue.splice(0);
    await postToWS(newLogsQueue);
  }
};

const handleShutdown = async (logsQueue: LogsQueueLog[]) => {
  await uploadLogs(logsQueue);
  process.exit(0);
};

const handleInvoke = async (logsQueue: LogsQueueLog[]) => {
  console.log(
    '🚀 ~ file: index.ts ~ line 91 ~ handleInvoke ~ logsQueue',
    logsQueue,
  );
  await uploadLogs(logsQueue);
};

(async function main() {
  const {logsQueue} = listen(RECEIVER_PORT);
  process.on('SIGINT', () => handleShutdown(logsQueue));
  process.on('SIGTERM', () => handleShutdown(logsQueue));

  const extensionId = await register();
  await subscribe(extensionId);

  // execute extensions logic
  while (true) {
    const event = await next(extensionId);

    switch (event.eventType) {
      case EventType.SHUTDOWN:
        await handleShutdown(logsQueue);
        break;
      case EventType.INVOKE:
        await handleInvoke(logsQueue);
        break;
      default:
        throw new Error(`unknown event: ${event.eventType}`);
    }
  }
})();
