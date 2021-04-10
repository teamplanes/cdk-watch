export const handler = async (): Promise<Record<string, any>> => {
  return {
    statusCode: 200,
    body: JSON.stringify({message: 'Lambda 2'}),
  };
};
