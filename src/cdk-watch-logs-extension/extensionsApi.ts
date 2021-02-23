/* eslint-disable no-console */
import * as path from 'path';
import fetch from 'node-fetch';

const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-01-01/extension`;

export const register = async (): Promise<{
  lambdaExtensionIdentifier: string;
}> => {
  const res = await fetch(`${baseUrl}/register`, {
    method: 'post',
    body: JSON.stringify({
      events: ['INVOKE', 'SHUTDOWN'],
    }),
    headers: {
      'Content-Type': 'application/json',
      'Lambda-Extension-Name': path.basename(__dirname),
    },
  });

  if (!res.ok) {
    console.error('register failed', await res.text());
  }

  return {
    lambdaExtensionIdentifier: res.headers.get(
      'lambda-extension-identifier',
    ) as string,
  };
};

export const next = async (extensionId: string): Promise<null | any> => {
  const res = await fetch(`${baseUrl}/event/next`, {
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
      'Lambda-Extension-Identifier': extensionId,
    },
  });

  if (!res.ok) {
    console.error('next failed', await res.text());
    return null;
  }
  return res.json();
};
