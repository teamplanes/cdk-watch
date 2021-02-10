import {filterManifestByPath} from '../utils/filterManifestByPath';
import {initAwsSdk} from '../utils/initAwsSdk';
import {readManifest} from '../utils/readManifest';
import {resolveLambdaDetailsFromManifest} from '../utils/resolveLambdaDetailsFromManifest';
import {runSynth} from '../utils/runSynth';
import {updateLambdaFunctionCode} from '../utils/updateLambdaFunctionCode';
import {createCLILoggerForLambda} from '../utils/createCLILoggerForLambda';
import {twisters} from '../utils/twisters';

export const once = async (
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
  resolveLambdaDetailsFromManifest(filteredManifest)
    .then((result) => {
      twisters.put('lambda', {
        text: lambdaProgressText,
        active: false,
      });
      return result;
    })
    .then((lambdaDetails) =>
      Promise.all(
        lambdaDetails.map(async ({detail, lambdaCdkPath, lambdaManifest}) => {
          const {prefix} = createCLILoggerForLambda(lambdaCdkPath);
          const lambdaUploadText = 'uploading lambda function code';
          twisters.put(lambdaCdkPath, {meta: {prefix}, text: lambdaUploadText});
          return updateLambdaFunctionCode(
            lambdaManifest.assetPath,
            detail,
          ).then(() =>
            twisters.put(lambdaCdkPath, {
              meta: {prefix},
              active: false,
              text: lambdaUploadText,
            }),
          );
        }),
      ),
    )
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    });
};
