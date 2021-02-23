#!/usr/bin/env node
import {CdkWatchCommand} from './commands';

const program = new CdkWatchCommand();

program.parseAsync(process.argv).catch((e) => {
  // eslint-disable-next-line no-console
  console.log(e);
  process.exit(1);
});
