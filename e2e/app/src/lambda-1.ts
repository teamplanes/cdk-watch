export const handler = async (): Promise<Record<string, any>> => {
  return {
    statusCode: 200,
    body: /* html */ `
      <h1>Lambda 1</h1>
    `,
    headers: {
      'Content-Type': 'text/html',
    },
  };
};
