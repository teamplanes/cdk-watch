import {AWSError, CloudFormation, CloudWatchLogs} from 'aws-sdk';
import EventEmitter from 'events';
import {parseCloudWatchLog} from './parseCloudwatchLog';

interface LogEventEmitter extends EventEmitter {
  on(
    event: 'log',
    cb: (log: ReturnType<typeof parseCloudWatchLog>) => void,
  ): this;
  on(event: 'error', cb: (error: Error) => void): this;
}

export const tailLogsForLambda = (
  lambdaDetail: CloudFormation.StackResourceDetail,
): LogEventEmitter => {
  const logGroupName = `/aws/lambda/${lambdaDetail.PhysicalResourceId}`;
  const cloudWatchLogs = new CloudWatchLogs();
  let startTime = Date.now();
  const emitter = new EventEmitter();

  const getNextLogs = async () => {
    const {logStreams} = await cloudWatchLogs
      .describeLogStreams({
        logGroupName,
        descending: true,
        limit: 10,
        orderBy: 'LastEventTime',
      })
      .promise();

    const logStreamNames = (
      logStreams?.map(({logStreamName}) => logStreamName) || []
    ).filter(Boolean) as string[];

    const {events} = await cloudWatchLogs
      .filterLogEvents({
        logGroupName,
        logStreamNames,
        startTime,
        interleaved: true,
        limit: 50,
      })
      .promise();

    if (events?.length) {
      events.forEach((log) => {
        if (log.message) {
          emitter.emit(
            'log',
            parseCloudWatchLog(
              log.message,
              log.timestamp ? new Date(log.timestamp) : new Date(),
            ),
          );
        }
      });

      startTime = (events[events.length - 1]?.timestamp || Date.now()) + 1;
    }
  };

  let hasReportedResourceNotFoundException = false;
  const poll = () => {
    getNextLogs().catch((error: Error | AWSError) => {
      if (
        error.name === 'ResourceNotFoundException' &&
        !hasReportedResourceNotFoundException
      ) {
        hasReportedResourceNotFoundException = true;
        // eslint-disable-next-line no-param-reassign
        error.message = `Lambda Log Group not found, this could mean it has not yet been invoked.`;
        emitter.emit('error', error);
      }
    });
  };

  setInterval(poll, 1000);
  setImmediate(poll);

  return emitter;
};
