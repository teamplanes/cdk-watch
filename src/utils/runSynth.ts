import execa from 'execa';

export const runSynth = (options: {
  context: string[];
  profile?: string;
  app?: string;
}): void => {
  execa.sync(
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
};
