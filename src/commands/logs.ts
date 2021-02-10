import {filterManifestByPath} from '../utils/filterManifestByPath';
import {initAwsSdk} from '../utils/initAwsSdk';
import {readManifest} from '../utils/readManifest';
import {resolveLambdaDetailsFromManifest} from '../utils/resolveLambdaDetailsFromManifest';
import {runSynth} from '../utils/runSynth';
import {tailLogsForLambda} from '../utils/tailLogsForLambda';
import {createCLILoggerForLambda} from '../utils/createCLILoggerForLambda';

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

  resolveLambdaDetailsFromManifest(filteredManifest)
    .then((lambdaDetails) =>
      Promise.all(
        lambdaDetails.map(async ({detail, lambdaCdkPath}) => {
          const logger = createCLILoggerForLambda(lambdaCdkPath);
          tailLogsForLambda(detail)
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
