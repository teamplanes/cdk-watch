/* eslint-disable no-console */
import * as http from 'http';
import {LogsQueueLog} from './interfaces';

export const listen = (
  port: number,
  callback: (logs: any) => void,
): {logsQueue: LogsQueueLog[]} => {
  const logsQueue: LogsQueueLog[] = [];
  // init HTTP server for the Logs API subscription
  const server = http.createServer((request, response) => {
    if (request.method === 'POST') {
      let body = '';
      request.on('data', (data) => {
        body += data;
      });
      request.on('end', async () => {
        try {
          const batch = JSON.parse(body);
          if (batch.length > 0) {
            batch.forEach(callback);
          }
        } catch (e) {
          console.error('failed to parse logs', e);
        }
        response.writeHead(200, {});
        response.end('OK');
      });
    } else {
      console.log('GET');
      response.writeHead(200, {});
      response.end('OK');
    }
  });
  server.listen(port, 'sandbox');
  console.log(`Listening for logs at http://sandbox:${port}`);
  return {logsQueue};
};
