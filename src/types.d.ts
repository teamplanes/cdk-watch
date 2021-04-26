import esbuild from 'esbuild';

export interface LambdaManifestType {
  assetPath: string;
  esbuildOptions: esbuild.BuildOptions;
  lambdaLogicalId: string;
  rootStackName: string;
  nestedStackLogicalIds: string[];
  realTimeLogsApiLogicalId: string | undefined;
  realTimeLogsStackLogicalId: string | undefined;
  nodeModulesLayerVersion: string | undefined;
}

export interface LambdaMap {
  [lambdaCdkPath: string]: LambdaManifestType;
}

export interface CdkWatchManifest {
  region: string;
  lambdas: LambdaMap;
}

export interface LambdaDetail {
  functionName: string;
  lambdaCdkPath: string;
  lambdaManifest: LambdaManifestType;
  layers: string[];
}
