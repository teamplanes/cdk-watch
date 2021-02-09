import chalk from 'chalk';
import {inspect} from 'util';
import JSON5 from 'json5';
import {LambdaLog} from './parseCloudwatchLog';

const asJson = (msgParam: string) => {
  try {
    return JSON5.parse(msgParam) as Record<string, string>;
  } catch {
    return null;
  }
};

const logLevelColorMap = {
  emerg: chalk.bgRedBright,
  alert: chalk.bgRed,
  crit: chalk.bgRed,
  error: chalk.red,
  warning: chalk.yellow,
  warn: chalk.yellow,
  notice: chalk.blue,
  info: chalk.blue,
  debug: chalk.green,
};

const colorFromLogLevel = (level: keyof typeof logLevelColorMap) => {
  const color = logLevelColorMap[level] || logLevelColorMap.info;
  return color(level);
};

const isLogLevelObject = (log: Record<string, any>) => {
  return (
    log.level &&
    log.message &&
    (logLevelColorMap as Record<string, any>)[log.level]
  );
};

const prettyJsonString = (jsonLog: Record<string, any>) => {
  return inspect(jsonLog, {colors: true, depth: null});
};

const formatJsonLog = (log: string | Record<string, any>) => {
  const jsonLog = (typeof log === 'object' ? log : asJson(log)) as Record<
    string,
    any
  >;
  if (!jsonLog) return log;
  if (isLogLevelObject(jsonLog)) {
    const logLevelMessageAsJsonOrString =
      asJson(jsonLog.message) || jsonLog.message;
    return [
      `[${colorFromLogLevel(jsonLog.level)}]`,
      typeof logLevelMessageAsJsonOrString === 'object'
        ? prettyJsonString(logLevelMessageAsJsonOrString)
        : logLevelMessageAsJsonOrString,
    ].join(' ');
  }
  return prettyJsonString(jsonLog);
};

export const logToString = (log: LambdaLog): string => {
  const [, minutes, seconds] = log.info.timestamp
    .toLocaleTimeString()
    .split(':');
  const time = `${chalk.blue(minutes)}${chalk.grey(':')}${chalk.blue(seconds)}`;

  switch (log.event) {
    case 'START':
    case 'END':
    case 'REPORT': {
      const report = [
        time,
        chalk.yellow(log.event),
        chalk.gray(log.info.requestId),
      ]
        .filter(Boolean)
        .join(' ');
      if (log.event === 'REPORT') {
        return [
          report,
          [
            log.info.duration,
            log.info.billedDuration,
            log.info.initDuration,
            log.info.maxMemoryUsed,
          ]
            .filter(Boolean)
            .join(' '),
        ].join(': ');
      }
      return report;
    }
    case 'JSON_LOG':
    case 'NATIVE_LOG': {
      return [time, formatJsonLog(log.message)].join(' ');
    }
    case 'UNKNOWN':
      return [time, log.message].join(' ');
    default:
      return [time, log.message].join(' ');
  }
};
