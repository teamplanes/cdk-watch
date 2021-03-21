import minimatch from 'minimatch';
import {CdkWatchManifest} from '../types.d';

export const filterManifestByPath = (
  pathMatch: string,
  manifest: CdkWatchManifest,
): CdkWatchManifest => {
  const filtered = Object.keys(manifest.lambdas)
    .filter(minimatch.filter(pathMatch))
    .reduce(
      (current, next) => ({
        ...current,
        lambdas: {...current.lambdas, [next]: manifest.lambdas[next]},
      }),
      {...manifest, lambdas: {}},
    );

  if (!Object.keys(filtered.lambdas).length)
    throw new Error(`No Lambdas found at "${pathMatch}"`);
  return filtered;
};
