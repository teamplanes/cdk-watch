/* eslint-disable no-new */
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import {Stack} from 'aws-cdk-lib/core';
import {Construct, DependencyGroup} from 'constructs';
import {LogsLayerVersion} from './LogsLayerVersion';

export class RealTimeLambdaLogsAPI extends cdk.NestedStack {
  public readonly connectFn: lambda.Function;

  public readonly disconnectFn: lambda.Function;

  public readonly defaultFn: lambda.Function;

  /** role needed to send messages to websocket clients */
  public readonly apigwRole: iam.Role;

  public readonly CDK_WATCH_CONNECTION_TABLE_NAME: string;

  public readonly CDK_WATCH_API_GATEWAY_MANAGEMENT_URL: string;

  private connectionTable: dynamodb.Table;

  public executeApigwPolicy: iam.PolicyStatement;

  public logsLayerVersion: LogsLayerVersion;

  public websocketApi: apigwv2.CfnApi;

  public lambdaDynamoConnectionPolicy: iam.PolicyStatement;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const stack = Stack.of(this);
    const routeSelectionKey = 'action';
    // NOTE: This file will be bundled into /lib/index.js, so this path must be relative to that
    const websocketHandlerCodePath = path.join(__dirname, 'websocketHandlers');

    this.logsLayerVersion = new LogsLayerVersion(this, 'LogsLayerVersion');

    // table where websocket connections will be stored
    const websocketTable = new dynamodb.Table(this, 'connections', {
      partitionKey: {
        name: 'connectionId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      writeCapacity: 5,
      readCapacity: 5,
    });

    this.websocketApi = new apigwv2.CfnApi(this, 'LogsWebsocketApi', {
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: `$request.body.${routeSelectionKey}`,
      name: `${id}LogsWebsocketApi`,
    });

    const basePermissions = websocketTable.tableArn;
    const indexPermissions = `${basePermissions}/index/*`;
    this.lambdaDynamoConnectionPolicy = new iam.PolicyStatement({
      actions: ['dynamodb:*'],
      resources: [basePermissions, indexPermissions],
    });

    const connectLambdaRole = new iam.Role(this, 'connect-lambda-role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    connectLambdaRole.addToPolicy(this.lambdaDynamoConnectionPolicy);
    connectLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole',
      ),
    );

    const disconnectLambdaRole = new iam.Role(this, 'disconnect-lambda-role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    disconnectLambdaRole.addToPolicy(this.lambdaDynamoConnectionPolicy);
    disconnectLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole',
      ),
    );

    const messageLambdaRole = new iam.Role(this, 'message-lambda-role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    messageLambdaRole.addToPolicy(this.lambdaDynamoConnectionPolicy);
    messageLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole',
      ),
    );

    const resourceStr = this.createResourceStr(
      stack.account,
      stack.region,
      this.websocketApi.ref,
    );

    this.executeApigwPolicy = new iam.PolicyStatement({
      actions: ['execute-api:Invoke', 'execute-api:ManageConnections'],
      resources: [resourceStr],
      effect: iam.Effect.ALLOW,
    });

    const lambdaProps = {
      code: lambda.Code.fromAsset(websocketHandlerCodePath),
      timeout: cdk.Duration.seconds(300),
      runtime: lambda.Runtime.NODEJS_12_X,
      logRetention: logs.RetentionDays.FIVE_DAYS,
      role: disconnectLambdaRole,
      environment: {
        CDK_WATCH_CONNECTION_TABLE_NAME: websocketTable.tableName,
      },
    };

    const connectLambda = new lambda.Function(this, 'ConnectLambda', {
      handler: 'index.onConnect',
      description: 'Connect a user.',
      ...lambdaProps,
    });

    const disconnectLambda = new lambda.Function(this, 'DisconnectLambda', {
      handler: 'index.onDisconnect',
      description: 'Disconnect a user.',
      ...lambdaProps,
    });

    const defaultLambda = new lambda.Function(this, 'DefaultLambda', {
      handler: 'index.onMessage',
      description: 'Default',
      ...lambdaProps,
    });

    // access role for the socket api to access the socket lambda
    const policy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [
        connectLambda.functionArn,
        disconnectLambda.functionArn,
        defaultLambda.functionArn,
      ],
      actions: ['lambda:InvokeFunction'],
    });

    const role = new iam.Role(this, `LogsWebsocketIamRole`, {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });
    role.addToPolicy(policy);

    // websocket api lambda integration
    const connectIntegration = new apigwv2.CfnIntegration(
      this,
      'connect-lambda-integration',
      {
        apiId: this.websocketApi.ref,
        integrationType: 'AWS_PROXY',
        integrationUri: this.createIntegrationStr(
          stack.region,
          connectLambda.functionArn,
        ),
        credentialsArn: role.roleArn,
      },
    );

    const disconnectIntegration = new apigwv2.CfnIntegration(
      this,
      'disconnect-lambda-integration',
      {
        apiId: this.websocketApi.ref,
        integrationType: 'AWS_PROXY',
        integrationUri: this.createIntegrationStr(
          stack.region,
          disconnectLambda.functionArn,
        ),
        credentialsArn: role.roleArn,
      },
    );

    const defaultIntegration = new apigwv2.CfnIntegration(
      this,
      'default-lambda-integration',
      {
        apiId: this.websocketApi.ref,
        integrationType: 'AWS_PROXY',
        integrationUri: this.createIntegrationStr(
          stack.region,
          defaultLambda.functionArn,
        ),
        credentialsArn: role.roleArn,
      },
    );

    // Example route definition
    const connectRoute = new apigwv2.CfnRoute(this, 'connect-route', {
      apiId: this.websocketApi.ref,
      routeKey: '$connect',
      authorizationType: 'AWS_IAM',
      target: `integrations/${connectIntegration.ref}`,
    });

    const disconnectRoute = new apigwv2.CfnRoute(this, 'disconnect-route', {
      apiId: this.websocketApi.ref,
      routeKey: '$disconnect',
      authorizationType: 'NONE',
      target: `integrations/${disconnectIntegration.ref}`,
    });

    const defaultRoute = new apigwv2.CfnRoute(this, 'default-route', {
      apiId: this.websocketApi.ref,
      routeKey: '$default',
      authorizationType: 'NONE',
      target: `integrations/${defaultIntegration.ref}`,
    });

    // allow other other tables to grant permissions to these lambdas
    this.connectFn = connectLambda;
    this.disconnectFn = disconnectLambda;
    this.defaultFn = defaultLambda;
    this.connectionTable = websocketTable;
    this.apigwRole = messageLambdaRole;

    // deployment
    const apigwWssDeployment = new apigwv2.CfnDeployment(
      this,
      'apigw-deployment',
      {apiId: this.websocketApi.ref},
    );

    // stage
    const apiStage = new apigwv2.CfnStage(this, 'apigw-stage', {
      apiId: this.websocketApi.ref,
      autoDeploy: true,
      deploymentId: apigwWssDeployment.ref,
      stageName: 'v1',
      defaultRouteSettings: {
        throttlingBurstLimit: 500,
        throttlingRateLimit: 1000,
      },
    });

    // all routes are dependencies of the deployment
    const routes = new DependencyGroup();
    routes.add(connectRoute);
    routes.add(disconnectRoute);
    routes.add(defaultRoute);

    // add the dependency
    apigwWssDeployment.node.addDependency(routes);

    this.CDK_WATCH_CONNECTION_TABLE_NAME = websocketTable.tableName;
    this.CDK_WATCH_API_GATEWAY_MANAGEMENT_URL = this.createConnectionString(
      apiStage.stageName,
      stack.region,
      this.websocketApi.ref,
    );
  }

  private createIntegrationStr = (region: string, fnArn: string): string =>
    `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${fnArn}/invocations`;

  private createConnectionString = (
    route: string,
    region: string,
    ref: string,
  ) => `https://${ref}.execute-api.${region}.amazonaws.com/${route}`;

  private createResourceStr = (
    accountId: string,
    region: string,
    ref: string,
  ): string => `arn:aws:execute-api:${region}:${accountId}:${ref}/*`;

  public grantReadWrite = (lambdaFunction: lambda.Function): void => {
    this.connectionTable.grantReadWriteData(lambdaFunction);
  };
}
