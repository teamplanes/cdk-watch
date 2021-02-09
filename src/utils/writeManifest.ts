import * as path from 'path';
import * as fs from 'fs-extra';
import {CdkWatchManifest} from '../types.d';
import {CDK_WATCH_MANIFEST_FILE_NAME} from '../consts';

export const writeManifest = (manifest: CdkWatchManifest): void => {
  const manifestPath = path.join(
    process.cwd(),
    'cdk.out',
    CDK_WATCH_MANIFEST_FILE_NAME,
  );
  fs.writeJsonSync(manifestPath, manifest);
};
