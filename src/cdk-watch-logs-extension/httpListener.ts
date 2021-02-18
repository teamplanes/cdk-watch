import * as http from 'http';

export const listen = (port: number): {logsQueue: any[]} => {
  const logsQueue: any[] = [];
  // init HTTP server for the Logs API subscription
  const server = http.createServer((request, response) => {
    if (request.method === 'POST') {
      let body = '';
      request.on('data', (data) => {
        body += data;
      });
      request.on('end', () => {
        try {
          const batch = JSON.parse(body);
          if (batch.length > 0) {
            logsQueue.push(...batch);
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
