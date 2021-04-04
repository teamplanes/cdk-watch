export const handler = async (): Promise<Record<string, any>> => {
  return {
    statusCode: 200,
    body: /* html */ `
      <h1>Example App</h1>
      <p>Hello, world!</p>
    `,
    headers: {
      'Content-Type': 'text/html',
    },
  };
};
