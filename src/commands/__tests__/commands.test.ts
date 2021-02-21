/* eslint-disable import/first */
jest.mock('../list');
jest.mock('../logs');
jest.mock('../once');
jest.mock('../watch');
import {list} from '../list';
import {logs} from '../logs';
import {once} from '../once';
import {watch} from '../watch';
import {CdkWatchCommand} from '..';

const buildArgv = (cmd: string) => ['/path/to/node', 'cdkw', ...cmd.split(' ')];

describe('commands CLI', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('program runs watch as the default command', async () => {
    const program = new CdkWatchCommand();
    await program.parseAsync(buildArgv('**'));
    expect(watch).toBeCalledWith('**', {logs: true}, expect.anything());
    expect(list).toBeCalledTimes(0);
    expect(logs).toBeCalledTimes(0);
    expect(once).toBeCalledTimes(0);
  });

  test('program runs watch when command name is provided', async () => {
    const program = new CdkWatchCommand();
    await program.parseAsync(buildArgv('watch My/Path'));
    expect(watch).toBeCalledWith('My/Path', {logs: true}, expect.anything());
    expect(list).toBeCalledTimes(0);
    expect(logs).toBeCalledTimes(0);
    expect(once).toBeCalledTimes(0);
  });

  const otherCommands = {list, logs, once};
  test.each`
    command
    ${'list'}
    ${'logs'}
    ${'once'}
  `(
    'command runs correct function',
    async ({command}: {command: keyof typeof otherCommands}) => {
      const program = new CdkWatchCommand();
      await program.parseAsync(buildArgv(`${command} My/Path`));
      expect(otherCommands[command]).toBeCalledWith(
        'My/Path',
        expect.anything(),
        expect.anything(),
      );
    },
  );

  test.each`
    flag                                       | expected
    ${'-c foo=bar'}                            | ${['foo=bar']}
    ${'--context foo=bar'}                     | ${['foo=bar']}
    ${'-c foo=bar -c foo1=bar1'}               | ${['foo=bar', 'foo1=bar1']}
    ${'--context foo=bar --context foo1=bar1'} | ${['foo=bar', 'foo1=bar1']}
  `(
    'context flags are passed through to the command function',
    async ({flag, expected}) => {
      (watch as jest.Mock).mockReset();
      const program = new CdkWatchCommand();
      await program.parseAsync(buildArgv(`watch My/Path ${flag}`));
      expect(watch).toBeCalledWith(
        'My/Path',
        {logs: true, context: expected},
        expect.anything(),
      );
    },
  );
});
