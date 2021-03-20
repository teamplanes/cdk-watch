import * as aws4 from 'aws4';
import * as AWS from 'aws-sdk';
import WebSocket from 'ws';
import ReconnectingWebSocket from 'reconnecting-websocket';
import {URL} from 'url';
import EventEmitter from 'events';
import {Log} from '../../lambda-extension/cdk-watch-lambda-wrapper/patchConsole';

interface LogEventEmitter extends EventEmitter {
  on(event: 'log', cb: (log: Log) => void): this;
  on(event: 'error', cb: (error: Error) => void): this;
}

const tailRealTimeLogsForLambdas = (
  endpoint: string,
  lambdas: string[],
): LogEventEmitter => {
  const emitter = new EventEmitter();

  const url = new URL(endpoint);
  url.searchParams.append('lambdas', lambdas.join(','));
  const signedUrl = aws4.sign(
    {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
    },
    AWS.config.credentials,
  );

  class ReconnectWebSocket extends WebSocket {
    constructor(
      address: string,
      protocols?: string | string[],
      options?: WebSocket.ClientOptions,
    ) {
      super(address, protocols, {...options, headers: signedUrl.headers});
    }
  }

  const socket = new ReconnectingWebSocket(
    `wss://${signedUrl.hostname}${signedUrl.path}`,
    [],
    {
      WebSocket: ReconnectWebSocket,
    },
  );

  socket.onopen = () => {
    emitter.emit('connect');
  };

  socket.onclose = () => {
    emitter.emit('disconnect');
  };

  socket.onerror = (error) => {
    emitter.emit('error', error);
  };

  socket.onmessage = ({data}) => {
    const logs: Log[] = JSON.parse(data);
    logs.forEach((log) => {
      emitter.emit('log', log);
    });
  };

  return emitter;
};

export {tailRealTimeLogsForLambdas};
