#!/usr/bin/env node
import {program, Option, Command} from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import {list} from './commands/list';
import {logs} from './commands/logs';
import {once} from './commands/once';
import {watch} from './commands/watch';

const {version} = fs.readJSONSync(path.resolve(__dirname, '../package.json'));
program.version(version);

const profileOption = new Option(
  '-p, --profile <profile>',
  'pass the name of the AWS profile that you want to use',
);
const logsOption = new Option(
  '--no-logs',
  "don't subscribe to CloudWatch logs for each of your lambdas",
);
const cdkContextOption = new Option(
  '-c, --context <key=value...>',
  'pass context to the cdk synth command',
);
const cdkAppOption = new Option(
  '-a, --app <app>',
  'pass the --app option to the underlying synth command',
);

const mainWatchCommand = program
  .arguments('<pathGlob>')
  .description(
    'for each lambda matched by the path glob, watch the source-code and redeploy on change',
  )
  .addHelpText(
    'after',
    `\nExample:
  $ cdkw "**"
  $ cdkw "MyStack/API/**"
  $ cdkw --profile=planes --no-logs "**"\n`,
  )
  .passThroughOptions()
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .addOption(cdkAppOption)
  .addOption(logsOption)
  .action(watch);

const logsCommand = new Command('logs');
logsCommand
  .arguments('<pathGlob>')
  .description(
    'for each lambda matched by the path glob, poll the associated log groups',
  )
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .action(logs);

const onceCommand = new Command('once');
onceCommand
  .arguments('<pathGlob>')
  .description(
    'for each lambda matched by the path glob, build and deploy the source code once',
  )
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .action(once);

const listCommand = new Command('list');
listCommand
  .alias('ls')
  .arguments('<pathGlob>')
  .description('list all lambdas matching the path glob')
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .action(list);

mainWatchCommand.addCommand(logsCommand);
mainWatchCommand.addCommand(onceCommand);
mainWatchCommand.addCommand(listCommand);
mainWatchCommand.parseAsync(process.argv).catch((e) => {
  // eslint-disable-next-line no-console
  console.log(e);
  process.exit(1);
});
