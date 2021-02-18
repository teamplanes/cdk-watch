#!/usr/bin/env node
/* eslint-disable consistent-return */
/* eslint-disable no-await-in-loop */
import * as AWS from 'aws-sdk';
import {register, next} from './extensionsApi';
import {subscribe} from './logsApi';
import {listen} from './httpListener';

const dynamoDb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION,
});

const apigwManagementApi = new AWS.ApiGatewayManagementApi({
  apiVersion: '2018-11-29',
  endpoint: process.env.API_GATEWAY_ENDPOINT,
});

// Subscribe to platform logs and receive them on ${local_ip}:4243 via HTTP protocol.
const RECEIVER_PORT = 4243;
const TIMEOUT_MS = 100; // Maximum time (in milliseconds) that a batch is buffered.
const MAX_BYTES = 262144; // Maximum size in bytes that the logs are buffered in memory.
const MAX_ITEMS = 1000; // Maximum number of events that are buffered in memory.

const SUBSCRIPTION_BODY = {
  destination: {
    protocol: 'HTTP',
    URI: `http://sandbox:${RECEIVER_PORT}`,
  },
  types: ['function', 'platform'],
  buffering: {
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_BYTES,
    maxItems: MAX_ITEMS,
  },
};

enum EventType {
  INVOKE = 'INVOKE',
  SHUTDOWN = 'SHUTDOWN',
}

const postToWS = async (postData) => {
  let connectionData;

  try {
    connectionData = await dynamoDb
      .scan({
        TableName: process.env.CONN_TABLE_NAME as string,
        ProjectionExpression: 'connectionId',
      })
      .promise();
  } catch (e) {
    console.log('postToWS: scan ~ e', e);
    return {statusCode: 500, body: e.stack};
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
          await dynamoDb
            .delete({
              TableName: process.env.CONN_TABLE_NAME as string,
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
    return {statusCode: 500, body: e.stack};
  }
};

// function for processing collected logs
const uploadLogs = async (logsQueue) => {
  await new Promise((res) => setTimeout(res, TIMEOUT_MS));
  while (logsQueue.length > 0) {
    const newLogsQueue = [...logsQueue];
    logsQueue.splice(0);
    await postToWS(newLogsQueue);
    console.log(`logs sent`);
  }
};

const handleShutdown = async (event, logsQueue) => {
  await uploadLogs(logsQueue);
  process.exit(0);
};

const handleInvoke = async (event, logsQueue) => {
  await uploadLogs(logsQueue);
};

(async function main() {
  const {logsQueue} = listen(RECEIVER_PORT);
  process.on('SIGINT', () => handleShutdown('SIGINT', logsQueue));
  process.on('SIGTERM', () => handleShutdown('SIGTERM', logsQueue));
  process.on('uncaughtException', (err) => {
    handleShutdown('uncaughtException', logsQueue);
  });

  console.log('register');
  const extensionId = await register();
  console.log('extensionId', extensionId);

  console.log('subscribing listener');
  // subscribing listener to the Logs API
  await subscribe(extensionId, SUBSCRIPTION_BODY);

  // execute extensions logic
  while (true) {
    console.log('next');
    const event = await next(extensionId);
    console.log('event', event);

    switch (event.eventType) {
      case EventType.SHUTDOWN:
        await handleShutdown(event, logsQueue);
        break;
      case EventType.INVOKE:
        await handleInvoke(event, logsQueue);
        break;
      default:
        throw new Error(`unknown event: ${event.eventType}`);
    }
  }
})();
