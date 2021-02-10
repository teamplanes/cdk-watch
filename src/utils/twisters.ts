import chalk from 'chalk';
import Twisters from 'twisters';

export const twisters = new Twisters<{prefix?: string; error?: Error}>({
  pinActive: true,
  messageDefaults: {
    render: (message, frame) => {
      const {active, text, meta} = message;
      const prefix = meta?.prefix ? `${meta?.prefix} ` : '';
      const completion = meta?.error
        ? `error: ${chalk.red(meta.error.toString())}`
        : 'done';
      return active && frame
        ? `${prefix}${text}... ${frame}`
        : `${prefix}${text}... ${completion}`;
    },
  },
});
