import {Command, Option} from 'commander';
import {list} from './list';
import {logs} from './logs';
import {once} from './once';
import {watch} from './watch';

class CdkWatchCommand extends Command {
  constructor(version: string) {
    super();

    this.version(version);

    const profileOption = new Option(
      '-p, --profile <profile>',
      'pass the name of the AWS profile that you want to use',
    );
    const logsOption = new Option(
      '--no-logs',
      "don't subscribe to CloudWatch logs for each of your lambdas",
    );
    const forceCloudwatchLogsOption = new Option(
      '--force-cloudwatch',
      'force polling cloudwatch streams rather than using real-time logs',
    );
    const cdkContextOption = new Option(
      '-c, --context <key=value...>',
      'pass context to the cdk synth command',
    );
    const cdkAppOption = new Option(
      '-a, --app <app>',
      'pass the --app option to the underlying synth command',
    );

    this.command('watch', {isDefault: true})
      .arguments('<pathGlob>')
      .description(
        'for each lambda matched by the path glob, watch the source-code and redeploy on change',
      )
      .addHelpText(
        'after',
        `\nExample:
    $ cdkw "**"
    $ cdkw "MyStack/API/**"
    $ cdkw "**" --profile=planes --no-logs\n`,
      )
      .addOption(cdkContextOption)
      .addOption(profileOption)
      .addOption(cdkAppOption)
      .addOption(logsOption)
      .addOption(forceCloudwatchLogsOption)
      .action(watch);

    this.command('logs')
      .arguments('<pathGlob>')
      .description(
        'for each lambda matched by the path glob, poll the associated log groups',
      )
      .addOption(cdkContextOption)
      .addOption(profileOption)
      .addOption(forceCloudwatchLogsOption)
      .action(logs);

    this.command('once')
      .arguments('<pathGlob>')
      .description(
        'for each lambda matched by the path glob, build and deploy the source code once',
      )
      .addOption(cdkContextOption)
      .addOption(profileOption)
      .action(once);

    this.command('list')
      .alias('ls')
      .arguments('<pathGlob>')
      .description('list all lambdas matching the path glob')
      .addOption(cdkContextOption)
      .addOption(profileOption)
      .action(list);
  }
}

export {CdkWatchCommand};
