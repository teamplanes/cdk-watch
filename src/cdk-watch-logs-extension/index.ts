#!/usr/bin/env node
/* eslint-disable no-restricted-syntax */
/* eslint-disable consistent-return */
/* eslint-disable no-await-in-loop */
import * as AWS from 'aws-sdk';
import EventEmitter from 'events';
import {register, next} from './extensionsApi';
import {subscribe} from './logsApi';
import {listen} from './httpListener';
import {LogsQueueLog} from './interfaces';
import {TIMEOUT_MS, RECEIVER_PORT} from './consts';

const dynamoDb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION,
});

// https://y8ee06tdj3.execute-api.eu-west-2.amazonaws.com/v1
// https://3pe3f67b42.execute-api.eu-west-2.amazonaws.com/v1

const apigwManagementApi = new AWS.ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: process.env.CDK_WATCH_API_GATEWAY_MANAGEMENT_URL,
  region: process.env.AWS_REGION,
});

enum EventType {
  INVOKE = 'INVOKE',
  SHUTDOWN = 'SHUTDOWN',
}

const postToWS = async (postData: LogsQueueLog[]) => {
  if (!postData.length) return;
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
    console.log('🚀 ~ file: index.ts ~ line 20', {
      apiVersion: '2018-11-29',
      endpoint: process.env.CDK_WATCH_API_GATEWAY_MANAGEMENT_URL,
      region: process.env.AWS_REGION,
    });
    console.log('🚀 ~ file: index.ts ~ line 111 ~ postToWS ~ e', e);
    return {statusCode: 500, body: e.stack};
  }
};

const uploadLogs = async (logsQueue: LogsQueueLog[]) => {
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

(async function main() {
  const logsQueue: any[] = [];
  process.on('SIGINT', () => handleShutdown(logsQueue));
  process.on('SIGTERM', () => handleShutdown(logsQueue));

  const {lambdaExtensionIdentifier} = await register();
  await subscribe(lambdaExtensionIdentifier);
  listen(RECEIVER_PORT, async (data) => {
    logsQueue.push(data);
  });

  async function waitForEnd(event: any) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      while (
        !logsQueue.some(
          (log) =>
            log?.report?.requestId === event.requestId &&
            log.type === 'platform.end',
        )
      ) {
        console.log(logsQueue.map((log) => log.type));
        await new Promise((res) => setTimeout(res, 100));
      }
      resolve(undefined);
    });
  }

  // execute extensions logic
  while (true) {
    const event = await next(lambdaExtensionIdentifier);
    if (event) {
      switch (event.eventType) {
        case EventType.SHUTDOWN:
          await handleShutdown(logsQueue);
          process.exit(0);
          break;
        case EventType.INVOKE:
          const s = Date.now();
          await Promise.race([
            waitForEnd(event),
            new Promise((res) =>
              setTimeout(res, event.deadlineMs - Date.now()),
            ),
          ]).then(() => console.log(`Done in ${s - Date.now()}`));
          await uploadLogs(logsQueue);
          break;
        default:
          throw new Error(`unknown event: ${event.eventType}`);
      }
    }
  }
})();
