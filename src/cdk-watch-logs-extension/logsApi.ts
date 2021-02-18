const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-08-15/logs`;

export const subscribe = async (extensionId: string, subscriptionBody: any) => {
  const res = await fetch(baseUrl, {
    method: 'put',
    body: JSON.stringify(subscriptionBody),
    headers: {
      'Content-Type': 'application/json',
      'Lambda-Extension-Identifier': extensionId,
    },
  });

  if (!res.ok) {
    console.error('logs subscription failed', await res.text());
  } else {
    console.error('logs subscription ok', await res.text());
  }
};
