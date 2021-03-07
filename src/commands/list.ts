import chalk from 'chalk';
import OS from 'os';
import {filterManifestByPath} from '../lib/filterManifestByPath';
import {readManifest} from '../lib/readManifest';
import {runSynth} from '../lib/runSynth';

export const list = async (
  pathGlob: string | undefined,
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
  const filteredManifest = pathGlob
    ? filterManifestByPath(pathGlob, manifest)
    : manifest;
  // eslint-disable-next-line no-console
  console.log(
    Object.keys(filteredManifest.lambdas)
      .map((key) => `- ${chalk.blue(key)}`)
      .join(OS.EOL),
  );
};
