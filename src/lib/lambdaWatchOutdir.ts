import * as path from 'path';
import {CDK_WATCH_OUTDIR} from '../consts';
import {LambdaManifestType} from '../types.d';

export const lambdaWatchOutdir = (lambdaManifest: LambdaManifestType): string =>
  path.join(
    'cdk.out',
    CDK_WATCH_OUTDIR,
    path.relative('cdk.out', lambdaManifest.assetPath),
  );
