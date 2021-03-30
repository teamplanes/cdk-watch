export const CDK_WATCH_MANIFEST_FILE_NAME = 'manifest.cdk-watch.json';
export const CDK_WATCH_OUTDIR = 'cdk-watch';
// Turns on realtime logs for the whole project (unless you specify
// `realTimeLoggingEnabled: false`) on a per construct basis. i.e. this defaults
// to tru rather than false.
export const CDK_WATCH_CONTEXT_LOGS_ENABLED =
  'cdk-watch:forceRealTimeLoggingEnabled';
// A flag to tell cdk to not install node-modules for the layer when
// running synth. This is on by default when running any cdk-commands
export const CDK_WATCH_CONTEXT_NODE_MODULES_DISABLED =
  'cdk-watch:nodeModulesInstallDisabled';
