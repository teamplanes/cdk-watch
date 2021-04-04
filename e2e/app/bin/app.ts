#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {AppStack} from '../lib/app-stack';

const app = new cdk.App();
new AppStack(app, 'AppStack', {
  stackName: 'CdkWatchE2EStack',
  env: {region: 'eu-west-1'},
});
