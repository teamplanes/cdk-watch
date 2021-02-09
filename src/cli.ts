#!/usr/bin/env node
import {program, Option} from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import {watch} from './commands/watch';

const {version} = fs.readJSONSync(path.resolve(__dirname, '../package.json'));
program.version(version);

const profileOption = new Option('-p, --profile <profile>');
const logsOption = new Option('--no-logs');
const cdkContextOption = new Option('-c, --context <key=value...>');
const cdkAppOption = new Option('-a, --app <app>');

program
  .arguments('<pathGlob>')
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .addOption(cdkAppOption)
  .addOption(logsOption)
  .action(watch);

program
  .command('ls <pathGlob>')
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .action((pathGlob) => console.log('TODO: ls', path));

program
  .command('logs <pathGlob>')
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .action((pathGlob) => console.log('TODO: logs', path));

program
  .command('once <pathGlob>')
  .addOption(cdkContextOption)
  .addOption(profileOption)
  .action((pathGlob) => console.log('TODO: once', path));

program.parse(process.argv);
