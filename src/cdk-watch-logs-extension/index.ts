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
/**

Note:

- This is a simple example extension to make you help start investigating the Lambda Runtime Logs API.
This code is not production ready, and it has never intended to be. Use it with your own discretion after you tested
it thoroughly.

- Because of the asynchronous nature of the system, it is possible that logs for one invoke are
processed during the next invoke slice. Likewise, it is possible that logs for the last invoke are processed during
the SHUTDOWN event.

*/

const EventType = {
  INVOKE: 'INVOKE',
  SHUTDOWN: 'SHUTDOWN',
};

async function postToWS(postData) {
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
      console.log('sending to connectionId', connectionId);
      try {
        await apigwManagementApi
          .postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify(postData, null, 2),
          })
          .promise();
      } catch (e) {
        if (e.statusCode === 410) {
          console.log(`Found stale connection, deleting ${connectionId}`);
          await dynamoDb
            .delete({
              TableName: process.env.CONN_TABLE_NAME as string,
              Key: {connectionId},
            })
            .promise();
        } else {
          console.log('connectionData.Items.map ~ e', e);
          throw e;
        }
      }
    });

  try {
    await Promise.all(postCalls || []);
  } catch (e) {
    console.log('postToWS ~ e', e);
    return {statusCode: 500, body: e.stack};
  }
}

// function for processing collected logs
async function uploadLogs(logsQueue) {
  console.log(`upload logs`);

  await new Promise((res) => setTimeout(res, TIMEOUT_MS));
  while (logsQueue.length > 0) {
    const newLogsQueue = [...logsQueue];
    logsQueue.splice(0);
    await postToWS(newLogsQueue);
    console.log(`logs sent`);
  }
}

async function handleShutdown(event, logsQueue) {
  console.log('shutdown', {event});
  await uploadLogs(logsQueue);

  process.exit(0);
}

async function handleInvoke(event, logsQueue) {
  console.log('invoke');
  await uploadLogs(logsQueue);
}

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
