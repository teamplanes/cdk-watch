import esbuild from 'esbuild';

export interface LambdaManifestType {
  assetPath: string;
  esbuildOptions: esbuild.BuildOptions;
  lambdaLogicalId: string;
  rootStackName: string;
  nestedStackLogicalIds: string[];
  realTimeLogsApiLogicalId: string | undefined;
  realTimeLogsStackLogicalId: string | undefined;
}

export interface CdkWatchManifest {
  region: string;
  lambdas: {
    [lambdaCdkPath: string]: LambdaManifestType;
  };
}
