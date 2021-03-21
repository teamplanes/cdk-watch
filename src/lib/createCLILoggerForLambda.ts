/* eslint-disable no-console */
import chalk from 'chalk';
import truncate from 'cli-truncate';

export const createCLILoggerForLambda = (
  lambdaCdkPath: string,
): {
  prefix: string;
  log(...message: any[]): void;
  error(message: string | Error): void;
} => {
  const functionName = truncate(lambdaCdkPath, 20, {position: 'start'});
  const prefix = `[${chalk.grey(functionName)}]`;
  return {
    prefix,
    log(...message) {
      console.log(prefix, ...message);
    },
    error(message) {
      console.error(
        prefix,
        chalk.red(typeof message === 'string' ? message : message.toString()),
      );
    },
  };
};
