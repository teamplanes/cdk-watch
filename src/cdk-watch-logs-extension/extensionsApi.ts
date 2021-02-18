import * as path from 'path';

const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-01-01/extension`;

export const register = async (): Promise<any> => {
  const res = await fetch(`${baseUrl}/register`, {
    method: 'post',
    body: JSON.stringify({
      events: ['INVOKE', 'SHUTDOWN'],
    }),
    headers: {
      'Content-Type': 'application/json',
      // The extension name must match the file name of the extension itself that's in /opt/extensions/
      // In this case that's: nodejs-example-logs-api-extension
      'Lambda-Extension-Name': path.basename(__dirname),
    },
  });

  if (!res.ok) {
    console.error('register failed', await res.text());
  }

  return res.headers.get('lambda-extension-identifier');
};

export const next = async (extensionId: string): Promise<any> => {
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
