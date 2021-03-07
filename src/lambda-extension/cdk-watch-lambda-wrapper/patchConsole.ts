/* eslint-disable no-console */
export type LogLevel =
  | 'info'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'trace'
  | 'fatal';

export type Log = {level: LogLevel; log: any[]; lambda: string};

export const patchConsole = (logs: Log[]): void => {
  const {log, debug, info, warn, error, trace, fatal} = console as Console & {
    fatal: typeof console.log;
  };

  console.log = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'info',
      log: params,
    });
    log.apply(console, params);
  };
  console.debug = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'debug',
      log: params,
    });
    debug.apply(console, params);
  };
  console.info = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'info',
      log: params,
    });
    info.apply(console, params);
  };
  console.warn = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'warn',
      log: params,
    });
    warn.apply(console, params);
  };
  console.error = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'error',
      log: params,
    });
    error.apply(console, params);
  };
  console.trace = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'trace',
      log: params,
    });
    trace.apply(console, params);
  };
  (console as any).fatal = (...params: any[]) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'fatal',
      log: params,
    });
    fatal.apply(console, params);
  };
};
