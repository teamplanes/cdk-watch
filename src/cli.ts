#!/usr/bin/env node
import {program, Option} from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
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

program
  .arguments('<pathGlob>')
  .description(
    'for each lambda matched by the path glob, watch the source-code and redeploy on change',
  )
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .addOption(cdkAppOption)
  .addOption(logsOption)
  .action(watch);

program
  .command('ls <pathGlob>')
  .description('list all lambdas matching the path glob')
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .action((pathGlob) => console.log('TODO: ls', path));

program
  .command('logs <pathGlob>')
  .description(
    'for each lambda matched by the path glob, poll the associated log groups',
  )
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .action((pathGlob) => console.log('TODO: logs', path));

program
  .command('once <pathGlob>')
  .description(
    'for each lambda matched by the path glob, build and deploy the source code once',
  )
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .action((pathGlob) => console.log('TODO: once', path));

program.parse(process.argv);
