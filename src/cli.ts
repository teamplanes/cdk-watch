#!/usr/bin/env node
import * as fs from 'fs-extra';
import * as path from 'path';
import {CdkWatchCommand} from './commands';

// NOTE: When this entry is built it's bundled into `/lib/cli.js`. So this is
// relative to that path.
const {version} = fs.readJSONSync(path.resolve(__dirname, '../package.json'));

const program = new CdkWatchCommand(version);

program.parseAsync(process.argv).catch((e) => {
  // eslint-disable-next-line no-console
  console.log(e);
  process.exit(1);
});
