import * as path from 'path';
import * as esbuild from 'esbuild';
import chalk from 'chalk';
import {copyCdkAssetToWatchOutdir} from '../lib/copyCdkAssetToWatchOutdir';
import {filterManifestByPath} from '../lib/filterManifestByPath';
import {initAwsSdk} from '../lib/initAwsSdk';
import {readManifest} from '../lib/readManifest';
import {resolveLambdaNamesFromManifest} from '../lib/resolveLambdaNamesFromManifest';
import {runSynth} from '../lib/runSynth';
import {updateLambdaFunctionCode} from '../lib/updateLambdaFunctionCode';
import {createCLILoggerForLambda} from '../lib/createCLILoggerForLambda';
import {twisters} from '../lib/twisters';
import {tailLogsForLambdas} from '../lib/tailLogsForLambdas';

export const watch = async (
  pathGlob: string,
  options: {
    context: string[];
    app: string;
    profile: string;
    logs: boolean;
    skipInitial: boolean;
    forceCloudwatch?: boolean;
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
  resolveLambdaNamesFromManifest(filteredManifest)
    .then((result) => {
      twisters.put('lambda', {
        text: lambdaProgressText,
        active: false,
      });
      return result;
    })
    .then(async (lambdaDetails) => {
      if (options.logs) {
        await tailLogsForLambdas(lambdaDetails, options.forceCloudwatch);
      }
      return Promise.all(
        lambdaDetails.map(
          async ({functionName, lambdaCdkPath, layers, lambdaManifest}) => {
            if (
              lambdaManifest.nodeModulesLayerVersion &&
              !layers.includes(lambdaManifest.nodeModulesLayerVersion)
            ) {
              // eslint-disable-next-line no-console
              console.warn(
                chalk.yellow(
                  '[Warning]: Function modules layer is out of sync with published layer version, this can lead to runtime errors. To fix, do a full `cdk deploy`.',
                ),
              );
            }

            const logger = createCLILoggerForLambda(
              lambdaCdkPath,
              lambdaDetails.length > 1,
            );
            const watchOutdir = copyCdkAssetToWatchOutdir(lambdaManifest);

            const updateFunction = () => {
              const uploadingProgressText = 'uploading function code';
              twisters.put(`${lambdaCdkPath}:uploading`, {
                meta: {prefix: logger.prefix},
                text: uploadingProgressText,
              });

              return updateLambdaFunctionCode(watchOutdir, functionName)
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
            };

            if (!options.skipInitial) {
              await updateFunction();
            }

            logger.log('waiting for changes');
            esbuild
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
                    } else {
                      updateFunction();
                    }
                  },
                },
              })
              .catch((e: Error) => {
                logger.error(`error building lambda: ${e.toString()}`);
              });
          },
        ),
      );
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    });
};
