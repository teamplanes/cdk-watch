/* eslint-disable max-classes-per-file */
import * as cdk from '@aws-cdk/core';
import * as path from 'path';
import {WatchableNodejsFunction} from 'cdk-watch';

class DeepNestedStack extends cdk.NestedStack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);
    new WatchableNodejsFunction(this, 'DeepNestedLambda3', {
      functionName: 'DeepNestedLambda3',
      entry: path.resolve(__dirname, `../src/lambda-3.ts`),
      watchOptions: {realTimeLoggingEnabled: true},
    });
  }
}

class NestedStack extends cdk.NestedStack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);
    new WatchableNodejsFunction(this, 'NestedLambda2', {
      functionName: 'NestedLambda2',
      entry: path.resolve(__dirname, `../src/lambda-2.ts`),
      watchOptions: {realTimeLoggingEnabled: true},
    });
    new WatchableNodejsFunction(this, 'NestedLambda3', {
      functionName: 'NestedLambda3',
      entry: path.resolve(__dirname, `../src/lambda-3.ts`),
      watchOptions: {realTimeLoggingEnabled: true},
    });
    new DeepNestedStack(this, 'DeepNestedStack');
  }
}

export class AppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new WatchableNodejsFunction(this, 'RootLambda1', {
      entry: path.resolve(__dirname, `../src/lambda-1.ts`),
      watchOptions: {realTimeLoggingEnabled: true},
      functionName: 'RootLambda1',
    });

    new NestedStack(this, 'NestedStack');
  }
}
