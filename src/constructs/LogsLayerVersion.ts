import * as path from 'path';
import {Code, LayerVersion} from '@aws-cdk/aws-lambda';
import {Construct, RemovalPolicy} from '@aws-cdk/core';

export class LogsLayerVersion extends LayerVersion {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      removalPolicy: RemovalPolicy.DESTROY,
      description:
        'Catches Lambda Logs and sends them to API Gateway Connections',
      // NOTE: This file will be bundled into /lib/index.js, so this path must be relative to that
      code: Code.fromAsset(path.join(__dirname, 'lambda-extension')),
    });
  }
}
