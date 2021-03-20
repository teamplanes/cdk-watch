/* eslint-disable no-console */
export type LogLevel =
  | 'info'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'trace'
  | 'fatal';

export type Log = {level: LogLevel; log: any[]; date: number; lambda: string};

export const patchConsole = (logs: Log[]): void => {
  const {log, debug, info, warn, error, trace, fatal} = console as Console & {
    fatal: typeof console.log;
  };

  console.log = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'info',
      date: Date.now(),
      log: params,
    });
    log.apply(console, params);
  };
  console.debug = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'debug',
      date: Date.now(),
      log: params,
    });
    debug.apply(console, params);
  };
  console.info = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'info',
      date: Date.now(),
      log: params,
    });
    info.apply(console, params);
  };
  console.warn = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'warn',
      date: Date.now(),
      log: params,
    });
    warn.apply(console, params);
  };
  console.error = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'error',
      date: Date.now(),
      log: params,
    });
    error.apply(console, params);
  };
  console.trace = (...params) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'trace',
      date: Date.now(),
      log: params,
    });
    trace.apply(console, params);
  };
  (console as any).fatal = (...params: any[]) => {
    logs.push({
      lambda: process.env.AWS_LAMBDA_FUNCTION_NAME as string,
      level: 'fatal',
      date: Date.now(),
      log: params,
    });
    fatal.apply(console, params);
  };
};
