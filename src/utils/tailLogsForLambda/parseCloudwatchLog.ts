import * as os from 'os';
import {logToString} from './logToString';

const asJson = (msgParam: string) => {
  try {
    return JSON.parse(msgParam) as Record<string, string>;
  } catch {
    return null;
  }
};

const isDate = (str: string) => {
  return !Number.isNaN(new Date(str).getTime());
};

const KNOWN_NATIVE_LOG_LEVELS = ['ERROR', 'INFO', 'WARN'];
const KNOWN_ERROR_MESSAGES = [
  'Unknown application error occurredError',
  'Process exited before completing request',
];

const reportMessageToObject = (
  message: string,
  prefix: string,
): Record<string, string> => {
  if (prefix === 'START') {
    // Start comes through a little different without the use of `\t`. So using
    // this ugly hack to extract only the request id for now!
    const [RequestId] = message
      .replace(`${prefix} RequestId: `, '')
      .split(' Version: ');
    return {RequestId};
  }
  return Object.fromEntries(
    message
      .replace(`${prefix} `, '')
      .split('\t')
      .map((part) => {
        return part.split(': ');
      }),
  );
};

const parseStartEvent = (message: string, timestamp: Date) => {
  const objectified = reportMessageToObject(message, 'START');
  return {
    raw: message,
    event: 'START',
    message,
    info: {requestId: objectified.RequestId, timestamp},
    toString(): string {
      return logToString(this);
    },
  } as const;
};

const parseEndEvent = (message: string, timestamp: Date) => {
  const objectified = reportMessageToObject(message, 'END');
  return {
    raw: message,
    event: 'END',
    message,
    info: {requestId: objectified.RequestId, timestamp},
    toString(): string {
      return logToString(this);
    },
  } as const;
};

const parseReportEvent = (message: string, timestamp: Date) => {
  const objectified = reportMessageToObject(message, 'REPORT');

  return {
    raw: message,
    event: 'REPORT',
    message,
    info: {
      requestId: objectified.RequestId,
      duration: objectified.Duration,
      billedDuration: objectified['Billed Duration'],
      memorySize: objectified['Memory Size'],
      maxMemoryUsed: objectified['Max Memory Used'],
      initDuration: objectified['Init Duration'],
      timestamp,
    },
    toString(): string {
      return logToString(this);
    },
  } as const;
};

// TODO: Fix inferred type, use class.
const parseCloudWatchLog = (log: string, timestamp: Date) => {
  const msg = log.replace(os.EOL, '');

  if (msg.startsWith('START')) {
    return parseStartEvent(msg, timestamp);
  }

  if (msg.startsWith('END')) {
    return parseEndEvent(msg, timestamp);
  }

  if (msg.startsWith('REPORT')) {
    return parseReportEvent(msg, timestamp);
  }

  if (KNOWN_ERROR_MESSAGES.includes(msg.trim())) {
    return {
      raw: msg,
      event: 'ERROR',
      message: msg.trim(),
      info: {
        requestId: undefined,
        level: 'ERROR',
        timestamp,
      },
      toString(): string {
        return logToString(this);
      },
    } as const;
  }

  const jsonMessage = asJson(msg);
  if (jsonMessage) {
    return {
      raw: msg,
      event: 'JSON_LOG',
      message: jsonMessage,
      info: {timestamp},
      toString(): string {
        return logToString(this);
      },
    } as const;
  }

  const splitMessage = msg.split('\t');

  if (splitMessage.length < 3) {
    return {
      raw: msg,
      event: 'UNKNOWN',
      message: msg,
      info: {timestamp},
      toString(): string {
        return logToString(this);
      },
    } as const;
  }

  let date = '';
  let reqId = '';
  let level = '';
  let text = '';
  let textParts = [];
  if (isDate(splitMessage[0])) {
    if (KNOWN_NATIVE_LOG_LEVELS.includes(splitMessage[2])) {
      [date, reqId, level, ...textParts] = splitMessage;
      text = textParts.join(`\t`);
    } else {
      [date, reqId, ...textParts] = splitMessage;
      text = textParts.join(`\t`);
    }
  } else if (isDate(splitMessage[1])) {
    [level, date, reqId, ...textParts] = splitMessage;
    text = textParts.join(`\t`);
  } else {
    return {
      raw: msg,
      event: 'UNKNOWN',
      message: msg,
      info: {timestamp},
      toString(): string {
        return logToString(this);
      },
    } as const;
  }
  return {
    raw: msg,
    event: 'NATIVE_LOG',
    message: text,
    info: {
      timestamp: new Date(date),
      requestId: reqId === 'undefined' ? undefined : reqId,
      level,
    },
    toString(): string {
      return logToString(this);
    },
  } as const;
};

export type LambdaLog = ReturnType<typeof parseCloudWatchLog>;

export {parseCloudWatchLog};
