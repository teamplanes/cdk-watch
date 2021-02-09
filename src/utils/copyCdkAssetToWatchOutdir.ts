import * as fs from 'fs-extra';
import {LambdaManifestType} from '../types.d';
import {lambdaWatchOutdir} from './lambdaWatchOutdir';

export const copyCdkAssetToWatchOutdir = (
  lambdaManifest: LambdaManifestType,
): string => {
  const watchOutdir = lambdaWatchOutdir(lambdaManifest);
  fs.copySync(lambdaManifest.assetPath, watchOutdir, {
    errorOnExist: false,
    recursive: true,
    overwrite: true,
  });
  return watchOutdir;
};
