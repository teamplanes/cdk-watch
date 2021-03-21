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
    .map(({functionName}) => functionName);

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

  cloudwatchFunctions.forEach((name) => {
    const logger = createCLILoggerForLambda(name);
    tailCloudWatchLogsForLambda(name)
      .on('log', (log) => logger.log(log.toString()))
      .on('error', (log) => logger.error(log));
  });

  const loggers = Object.values(realTimeLogsFunctionMap)
    .flat()
    .reduce(
      (curr, detail) => ({
        ...curr,
        [detail.functionName]: createCLILoggerForLambda(detail.lambdaCdkPath),
      }),
      {} as Record<string, ReturnType<typeof createCLILoggerForLambda>>,
    );
  Object.keys(realTimeLogsFunctionMap).forEach((key) => {
    tailRealTimeLogsForLambdas(
      key,
      realTimeLogsFunctionMap[key].map(({functionName}) => functionName),
    )
      .on('log', (log) => {
        loggers[log.lambda].log(...log.log);
      })
      .on('error', (error) => {
        // eslint-disable-next-line no-console
        console.error(`WebSocket Error`, error);
      });
  });
};

export {tailLogsForLambdas};
