import {filterManifestByPath} from '../lib/filterManifestByPath';
import {initAwsSdk} from '../lib/initAwsSdk';
import {readManifest} from '../lib/readManifest';
import {resolveLambdaNamesFromManifest} from '../lib/resolveLambdaNamesFromManifest';
import {runSynth} from '../lib/runSynth';
import {tailLogsForLambdas} from '../lib/tailLogsForLambdas';

export const logs = async (
  pathGlob: string,
  options: {
    context: string[];
    app: string;
    profile: string;
    forceCloudwatch: boolean;
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

  const lambdaFunctions = await resolveLambdaNamesFromManifest(
    filteredManifest,
  );
  await tailLogsForLambdas(lambdaFunctions, options.forceCloudwatch);
};
