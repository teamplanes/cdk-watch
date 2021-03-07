import * as aws4 from 'aws4';
import WebSocket from 'ws';
import {URL} from 'url';
import EventEmitter from 'events';
import {Log} from '../../lambda-extension/cdk-watch-lambda-wrapper/patchConsole';

interface LogEventEmitter extends EventEmitter {
  on(event: 'log', cb: (log: Log) => void): this;
  on(event: 'error', cb: (error: Error) => void): this;
}

const tailRealTimeLogsForLambdas = async (
  endpoint: string,
  lambdas: string[],
): Promise<LogEventEmitter> => {
  const emitter = new EventEmitter();

  const url = new URL(endpoint);
  url.searchParams.append('lambdas', lambdas.join(','));
  const signedUrl = aws4.sign({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'GET',
  });

  const socket = new WebSocket(`wss://${signedUrl.hostname}${signedUrl.path}`, {
    headers: signedUrl.headers,
  });

  socket.on('open', function open() {
    console.log('connected!');
  });

  socket.on('error', (error) => {
    console.log('error!', error);
  });

  socket.on('message', (data: string) => {
    console.log('Got logs');
    const logs: Log[] = JSON.parse(data);
    logs.forEach((log) => {
      emitter.emit('log', log);
    });
  });

  return emitter;
};

export {tailRealTimeLogsForLambdas};
