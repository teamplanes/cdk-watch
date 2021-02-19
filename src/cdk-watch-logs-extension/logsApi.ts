/* eslint-disable no-console */
import fetch from 'node-fetch';
import {RECEIVER_PORT, TIMEOUT_MS, MAX_BYTES, MAX_ITEMS} from './consts';

const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-08-15/logs`;

const SUBSCRIPTION_BODY = {
  destination: {
    protocol: 'HTTP',
    URI: `http://sandbox:${RECEIVER_PORT}`,
  },
  types: ['function', 'platform'],
  buffering: {
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_BYTES,
    maxItems: MAX_ITEMS,
  },
};

export const subscribe = async (extensionId: string): Promise<void> => {
  const res = await fetch(baseUrl, {
    method: 'put',
    body: JSON.stringify(SUBSCRIPTION_BODY),
    headers: {
      'Content-Type': 'application/json',
      'Lambda-Extension-Identifier': extensionId,
    },
  });

  if (!res.ok) {
    console.error('logs subscription failed', await res.text());
  }
};
