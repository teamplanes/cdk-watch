import * as path from 'path';
import * as esbuild from 'esbuild';
import {copyCdkAssetToWatchOutdir} from '../lib/copyCdkAssetToWatchOutdir';
import {filterManifestByPath} from '../lib/filterManifestByPath';
import {initAwsSdk} from '../lib/initAwsSdk';
import {readManifest} from '../lib/readManifest';
import {resolveLambdaDetailsFromManifest} from '../lib/resolveLambdaDetailsFromManifest';
import {runSynth} from '../lib/runSynth';
import {tailCloudWatchLogsForLambda} from '../lib/tailLogsForLambda/tailCloudWatchLogsForLambda';
import {updateLambdaFunctionCode} from '../lib/updateLambdaFunctionCode';
import {createCLILoggerForLambda} from '../lib/createCLILoggerForLambda';
import {twisters} from '../lib/twisters';

export const watch = async (
  pathGlob: string,
  options: {
    context: string[];
    app: string;
    profile: string;
    logs: boolean;
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

  const lambdaProgressText = 'resolving lambda configuration';
  twisters.put('lambda', {text: lambdaProgressText});
  Promise.all([
    resolveLambdaDetailsFromManifest(filteredManifest),
    esbuild.startService(),
  ] as const)
    .then((result) => {
      twisters.put('lambda', {
        text: lambdaProgressText,
        active: false,
      });
      return result;
    })
    .then(([lambdaDetails, esbuildService]) =>
      Promise.all(
        lambdaDetails.map(async ({detail, lambdaCdkPath, lambdaManifest}) => {
          const logger = createCLILoggerForLambda(lambdaCdkPath);
          const watchOutdir = copyCdkAssetToWatchOutdir(lambdaManifest);
          if (options.logs) {
            tailCloudWatchLogsForLambda(detail)
              .on('log', (log) => {
                logger.log(log.toString());
              })
              .on('error', (error) => {
                logger.error(error.toString());
              });
          }

          logger.log('watching');
          esbuildService
            .build({
              ...lambdaManifest.esbuildOptions,
              outfile: path.join(watchOutdir, 'index.js'),
              // Unless explicitly told not to, turn on treeShaking and minify to
              // improve upload times
              treeShaking: lambdaManifest.esbuildOptions.treeShaking ?? true,
              minify: lambdaManifest.esbuildOptions.minify ?? true,
              // Keep the console clean from build warnings, only print errors
              logLevel: lambdaManifest.esbuildOptions.logLevel ?? 'error',
              watch: {
                onRebuild: (error) => {
                  if (error) {
                    logger.error(
                      `failed to rebuild lambda function code ${error.toString()}`,
                    );
                    return;
                  }

                  const uploadingProgressText = 'uploading function code';
                  twisters.put(`${lambdaCdkPath}:uploading`, {
                    meta: {prefix: logger.prefix},
                    text: uploadingProgressText,
                  });

                  updateLambdaFunctionCode(watchOutdir, detail)
                    .then(() => {
                      twisters.put(`${lambdaCdkPath}:uploading`, {
                        meta: {prefix: logger.prefix},
                        text: uploadingProgressText,
                        active: false,
                      });
                    })
                    .catch((e) => {
                      twisters.put(`${lambdaCdkPath}:uploading`, {
                        text: uploadingProgressText,
                        meta: {error: e},
                        active: false,
                      });
                    });
                },
              },
            })
            .catch((e: Error) => {
              logger.error(`error building lambda: ${e.toString()}`);
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
