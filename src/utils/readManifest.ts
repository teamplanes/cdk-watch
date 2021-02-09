import * as path from 'path';
import * as fs from 'fs-extra';
import {CdkWatchManifest} from '../types.d';
import {CDK_WATCH_MANIFEST_FILE_NAME} from '../consts';

export const readManifest = (): CdkWatchManifest | undefined => {
  const manifestPath = path.join(
    process.cwd(),
    'cdk.out',
    CDK_WATCH_MANIFEST_FILE_NAME,
  );
  return fs.readJsonSync(manifestPath, {throws: false});
};
