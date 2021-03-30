import execa from 'execa';
import {CDK_WATCH_CONTEXT_NODE_MODULES_ENABLED} from '../consts';
import {twisters} from './twisters';
import {writeManifest} from './writeManifest';

export const runSynth = async (options: {
  context: string[];
  profile?: string;
  app?: string;
}): Promise<void> => {
  // Create a fresh manifest
  writeManifest({region: '', lambdas: {}});

  const synthProgressText = 'synthesizing CDK app';
  twisters.put('synth', {text: synthProgressText});
  await execa(
    'cdk',
    [
      'synth',
      ...options.context.map((context) => `--context ${context}`),
      // If the user has defined CDK_WATCH_CONTEXT_NODE_MODULES_ENABLED then
      // don't set it to our default value
      ...(options.context.some((context) =>
        context.includes(CDK_WATCH_CONTEXT_NODE_MODULES_ENABLED),
      )
        ? []
        : [`--context ${CDK_WATCH_CONTEXT_NODE_MODULES_ENABLED}=1`]),
      '--quiet',
      options.profile && `--profile=${options.profile}`,
      options.app && `--app=${options.app}`,
    ].filter(Boolean) as string[],
    {preferLocal: true, stdio: 'inherit'},
  );
  twisters.put('synth', {active: false, text: synthProgressText});
};
