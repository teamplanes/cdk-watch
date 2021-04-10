#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {AppStack} from '../lib/app-stack';

const app = new cdk.App();

const stackName = app.node.tryGetContext('stackName');
const region = app.node.tryGetContext('region');
if (!stackName) throw new Error('stackName expected in context');
if (!region) throw new Error('region expected in context');
new AppStack(app, 'AppStack', {
  stackName,
  env: {region},
});
