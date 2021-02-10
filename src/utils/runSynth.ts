import execa from 'execa';
import {twisters} from './twisters';

export const runSynth = async (options: {
  context: string[];
  profile?: string;
  app?: string;
}): Promise<void> => {
  const synthProgressText = 'synthesizing CDK app';
  twisters.put('synth', {text: synthProgressText});
  await execa(
    'cdk',
    [
      'synth',
      ...options.context.map((context) => `--context=${context}`),
      '--quiet',
      options.profile && `--profile=${options.profile}`,
      options.app && `--app=${options.app}`,
    ].filter(Boolean) as string[],
    {preferLocal: true, stdio: 'inherit'},
  );
  twisters.put('synth', {active: false, text: synthProgressText});
};
