import minimatch from 'minimatch';
import {CdkWatchManifest} from '../types.d';

export const filterManifestByPath = (
  pathMatch: string,
  manifest: CdkWatchManifest,
): CdkWatchManifest =>
  Object.keys(manifest.lambdas)
    .filter(minimatch.filter(pathMatch))
    .reduce(
      (current, next) => ({
        ...current,
        lambdas: {...current.lambdas, [next]: manifest.lambdas[next]},
      }),
      {...manifest, lambdas: {}},
    );
