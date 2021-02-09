export interface LambdaManifestType {
  assetPath: string;
  esbuildOptions: esbuild.BuildOptions;
  lambdaLogicalId: string;
  rootStackName: string;
  nestedStackLogicalIds: string[];
}

export interface CdkWatchManifest {
  region: string;
  lambdas: {
    [lambdaCdkPath: string]: LambdaManifestType;
  };
}
