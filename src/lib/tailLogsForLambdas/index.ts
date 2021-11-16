import {LambdaDetail} from '../../types.d';
import {resolveLogEndpointDetailsFromLambdas} from './resolveLogEndpointDetailsFromLambdas';
import {tailCloudWatchLogsForLambda} from './tailCloudWatchLogsForLambda';
import {tailRealTimeLogsForLambdas} from './tailRealTimeLogsForLambdas';
import {createCLILoggerForLambda} from '../createCLILoggerForLambda';

const tailLogsForLambdas = async (
  lambdaFunctions: LambdaDetail[],
  forceCloudwatch = false,
): Promise<void> => {
  const realTimeEndpointsForLambdas = await resolveLogEndpointDetailsFromLambdas(
    lambdaFunctions,
  );

  // All the lambdas that don't have real time logging setup
  const cloudwatchFunctions = (forceCloudwatch
    ? Object.keys(realTimeEndpointsForLambdas)
    : Object.keys(realTimeEndpointsForLambdas).filter(
        (key) => !realTimeEndpointsForLambdas[key],
      )
  )
    .map((key) => {
      const found = lambdaFunctions.find((func) => func.lambdaCdkPath === key);
      if (!found) throw new Error('Lambda key not found'); // should never happen.
      return found;
    })

  // Keyed by the endpoint, values are arrays of lambda details
  const realTimeLogsFunctionMap = forceCloudwatch
    ? {}
    : Object.keys(realTimeEndpointsForLambdas)
        .filter((key) => !!realTimeEndpointsForLambdas[key])
        .reduce((current, nextKey) => {
          const endpoint = realTimeEndpointsForLambdas[nextKey] as string;
          return {
            ...current,
            [endpoint]: [
              ...(current[endpoint] || []),
              lambdaFunctions.find(
                ({lambdaCdkPath}) => lambdaCdkPath === nextKey,
              ) as LambdaDetail,
            ],
          };
        }, {} as Record<string, LambdaDetail[]>);

  cloudwatchFunctions.forEach((lambda) => {
    const logger = createCLILoggerForLambda(lambda.lambdaCdkPath, lambdaFunctions.length > 1);
    tailCloudWatchLogsForLambda(lambda.functionName)
      .on('log', (log) => logger.log(log.toString()))
      .on('error', (log) => logger.error(log));
  });

  const loggers = Object.values(realTimeLogsFunctionMap)
    .flat()
    .reduce(
      (curr, detail) => ({
        ...curr,
        [detail.functionName]: createCLILoggerForLambda(
          detail.lambdaCdkPath,
          lambdaFunctions.length > 1,
        ),
      }),
      {} as Record<string, ReturnType<typeof createCLILoggerForLambda>>,
    );
  Object.keys(realTimeLogsFunctionMap).forEach((key) => {
    tailRealTimeLogsForLambdas(
      key,
      realTimeLogsFunctionMap[key].map(({functionName}) => functionName),
    )
      .on('log', (log) => {
        if (loggers[log.lambda]) {
          loggers[log.lambda].log(...log.log);
        } else {
          // eslint-disable-next-line no-console
          console.log(...log.log);
        }
      })
      .on('disconnect', () => {
        // eslint-disable-next-line no-console
        console.error(`Logs WebSocket Disconnected`);
        process.exit(1);
      })
      .on('error', (error) => {
        // eslint-disable-next-line no-console
        console.error(`WebSocket Error`, error);
        process.exit(1);
      });
  });
};

export {tailLogsForLambdas};
