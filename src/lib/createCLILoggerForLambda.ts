/* eslint-disable no-console */
import chalk from 'chalk';
import truncate from 'cli-truncate';

export const createCLILoggerForLambda = (
  lambdaCdkPath: string,
  shouldPrefix = true,
): {
  prefix: string;
  log(...message: any[]): void;
  error(message: string | Error): void;
} => {
  const functionName = truncate(lambdaCdkPath, 20, {position: 'start'});
  const prefix = shouldPrefix ? `[${chalk.grey(functionName)}]` : '';
  return {
    prefix,
    log(...message) {
      if (prefix) {
        console.log(prefix, ...message);
      } else {
        console.log(...message);
      }
    },
    error(message) {
      const error = chalk.red(
        typeof message === 'string' ? message : message.toString(),
      );
      if (prefix) {
        console.error(prefix, error);
      } else {
        console.error(error);
      }
    },
  };
};
