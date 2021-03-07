import {filterManifestByPath} from '../lib/filterManifestByPath';
import {initAwsSdk} from '../lib/initAwsSdk';
import {readManifest} from '../lib/readManifest';
import {resolveLambdaDetailsFromManifest} from '../lib/resolveLambdaDetailsFromManifest';
import {runSynth} from '../lib/runSynth';
import {tailCloudWatchLogsForLambda} from '../lib/tailLogsForLambda/tailCloudWatchLogsForLambda';
import {createCLILoggerForLambda} from '../lib/createCLILoggerForLambda';
import {resolveLogEndpointDetailsFromManifest} from '../lib/resolveLogEndpointDetailsFromManifest';

export const logs = async (
  pathGlob: string,
  options: {
    context: string[];
    app: string;
    profile: string;
  },
): Promise<void> => {
  await runSynth({
    context: options.context || [],
    app: options.app,
    profile: options.profile,
  });

  const manifest = readManifest();
  if (!manifest) throw new Error('cdk-watch manifest file was not found');
  initAwsSdk(manifest.region, options.profile);
  const filteredManifest = filterManifestByPath(pathGlob, manifest);

  Promise.all([
    resolveLambdaDetailsFromManifest(filteredManifest),
    resolveLogEndpointDetailsFromManifest(filteredManifest),
  ])
    .then(([lambdaDetails]) =>
      Promise.all(
        lambdaDetails.map(async ({detail, lambdaCdkPath}) => {
          const logger = createCLILoggerForLambda(lambdaCdkPath);
          tailCloudWatchLogsForLambda(detail)
            .on('log', (log) => {
              logger.log(log.toString());
            })
            .on('error', (error) => {
              logger.error(error.toString());
            });
        }),
      ),
    )
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    });
};
