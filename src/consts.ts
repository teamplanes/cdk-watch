export const CDK_WATCH_MANIFEST_FILE_NAME = 'manifest.cdk-watch.json';
export const CDK_WATCH_OUTDIR = 'cdk-watch';
// Turns on realtime logs for the whole project (unless you specify
// `realTimeLoggingEnabled: false`) on a per construct basis. i.e. this defaults
// to tru rather than false.
export const CDK_WATCH_CONTEXT_LOGS_ENABLED =
  'cdk-watch:forceRealTimeLoggingEnabled';
// A flag to tell cdk-watch to install node-modules for the layer when running
// the project in watch mode. I can't think of a use-case of why you'd want to
// enable this.
export const CDK_WATCH_CONTEXT_NODE_MODULES_ENABLED =
  'cdk-watch:nodeModulesInstallEnabled';
