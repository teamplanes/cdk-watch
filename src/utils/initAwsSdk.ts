import * as AWS from 'aws-sdk';

export const initAwsSdk = (region: string, profile?: string): void => {
  AWS.config.region = region;
  AWS.config.credentials = new AWS.SharedIniFileCredentials({
    profile,
  });
};
