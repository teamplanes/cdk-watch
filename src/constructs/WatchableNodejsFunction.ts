/* eslint-disable no-new */
/* eslint-disable import/no-extraneous-dependencies */
import {
  BundlingOptions,
  NodejsFunction,
  NodejsFunctionProps,
} from '@aws-cdk/aws-lambda-nodejs';
import {Runtime} from '@aws-cdk/aws-lambda';
import {Asset} from '@aws-cdk/aws-s3-assets';
import * as path from 'path';
import * as fs from 'fs-extra';
import findUp from 'find-up';
import * as cdk from '@aws-cdk/core';
import {BuildOptions, Loader} from 'esbuild';
import {CfnElement} from '@aws-cdk/core';
import {readManifest} from '../lib/readManifest';
import {writeManifest} from '../lib/writeManifest';
import {RealTimeLambdaLogsAPI} from './RealTimeLambdaLogsAPI';
import {CDK_WATCH_CONTEXT_LOGS_ENABLED} from '../consts';
import {NodeModulesLayer} from './NodeModulesLayer';

interface WatchableBundlingOptions extends BundlingOptions {
  /**
   * Similar to `bundling.nodeModules` however in this case your modules will be
   * bundled into a Lambda layer instead of being uploaded with your lambda
   * function code. This has upside when 'watching' your code as the only code
   * that needs to be uploaded each time is your core lambda code rather than
   * any modules, which are unlikely to change frequently. Passing `true` will
   * load all modules found in the "dependencies" of the entries package.json
   */
  nodeModulesLayer?: boolean | string[];
}

// NodeModulesLayer
interface WatchableNodejsFunctionProps extends NodejsFunctionProps {
  /**
   * Bundling options.
   */
  bundling?: WatchableBundlingOptions;
  /**
   * CDK Watch Options
   */
  watchOptions?: {
    /**
     * Default: `false`
     * Set to true to enable this construct to create all the
     * required infrastructure for realtime logging
     */
    realTimeLoggingEnabled?: boolean;
  };
}

/**
 * `extends` NodejsFunction and behaves the same, however `entry` is a required
 * prop to prevent duplicating logic across NodejsFunction and
 * WatchableNodejsFunction to infer `entry`.
 */
class WatchableNodejsFunction extends NodejsFunction {
  public esbuildOptions: BuildOptions;

  public cdkWatchLogsApi?: RealTimeLambdaLogsAPI;

  public readonly local?: cdk.ILocalBundling;

  constructor(
    scope: cdk.Construct,
    id: string,
    props: WatchableNodejsFunctionProps,
  ) {
    if (!props.entry) throw new Error('Expected props.entry');
    const pkgPath = findUp.sync('package.json', {
      cwd: path.dirname(props.entry),
    });
    if (!pkgPath) {
      throw new Error(
        'Cannot find a `package.json` in this project. Using `nodeModules` requires a `package.json`.',
      );
    }
    const nodeModulesLayerOption = props.bundling?.nodeModulesLayer;
    const shouldCreateModulesLayer =
      typeof nodeModulesLayerOption === 'boolean'
        ? nodeModulesLayerOption
        : (nodeModulesLayerOption?.length ?? 0) > 0;

    let nodeModulesLayer: null | NodeModulesLayer = null;
    let moduleNames: string[] = [];
    if (shouldCreateModulesLayer && nodeModulesLayerOption) {
      if (typeof nodeModulesLayerOption === 'boolean') {
        const packageJson = fs.readJSONSync(pkgPath);
        moduleNames = Object.keys(packageJson.dependencies || {});
      } else {
        moduleNames = nodeModulesLayerOption;
      }
      nodeModulesLayer = new NodeModulesLayer(scope, 'NodeModulesLayer', {
        pkgPath,
        nodeModules: moduleNames,
        depsLockFilePath: props.depsLockFilePath,
      });
    }
    const bundling: WatchableBundlingOptions = {
      ...props.bundling,
      externalModules: [
        ...moduleNames,
        ...(props.bundling?.externalModules || ['aws-sdk']),
      ],
    };
    super(scope, id, {
      ...props,
      bundling,
    });

    if (nodeModulesLayer) {
      this.addLayers(nodeModulesLayer);
    }

    const {entry} = props;
    if (!entry) throw new Error('`entry` must be provided');
    const targetMatch = (props.runtime || Runtime.NODEJS_12_X).name.match(
      /nodejs(\d+)/,
    );
    if (!targetMatch) {
      throw new Error('Cannot extract version from runtime.');
    }
    const target = `node${targetMatch[1]}`;

    this.esbuildOptions = {
      target,
      bundle: true,
      entryPoints: [entry],
      platform: 'node',
      minify: bundling?.minify ?? false,
      sourcemap: bundling?.sourceMap,
      external: [
        ...(bundling?.externalModules ?? ['aws-sdk']),
        ...(bundling?.nodeModules ?? []),
        ...(moduleNames ?? []),
      ],
      loader: bundling?.loader as {[ext: string]: Loader} | undefined,
      define: bundling?.define,
      logLevel: bundling?.logLevel,
      keepNames: bundling?.keepNames,
      tsconfig: bundling?.tsconfig
        ? path.resolve(entry, path.resolve(bundling?.tsconfig))
        : findUp.sync('tsconfig.json', {cwd: path.dirname(entry)}),
      banner: bundling?.banner,
      footer: bundling?.footer,
    };

    if (
      scope.node.tryGetContext(CDK_WATCH_CONTEXT_LOGS_ENABLED) ||
      props.watchOptions?.realTimeLoggingEnabled
    ) {
      const [rootStack] = this.parentStacks;
      const logsApiId = 'CDKWatchWebsocketLogsApi';
      this.cdkWatchLogsApi =
        (rootStack.node.tryFindChild(logsApiId) as
          | undefined
          | RealTimeLambdaLogsAPI) ||
        new RealTimeLambdaLogsAPI(rootStack, logsApiId);

      this.addEnvironment(
        'AWS_LAMBDA_EXEC_WRAPPER',
        '/opt/cdk-watch-lambda-wrapper/index.js',
      );
      this.addLayers(this.cdkWatchLogsApi.logsLayerVersion);
      this.addToRolePolicy(this.cdkWatchLogsApi.executeApigwPolicy);
      this.addToRolePolicy(this.cdkWatchLogsApi.lambdaDynamoConnectionPolicy);
      this.addEnvironment(
        'CDK_WATCH_CONNECTION_TABLE_NAME',
        this.cdkWatchLogsApi.CDK_WATCH_CONNECTION_TABLE_NAME,
      );
      this.addEnvironment(
        'CDK_WATCH_API_GATEWAY_MANAGEMENT_URL',
        this.cdkWatchLogsApi.CDK_WATCH_API_GATEWAY_MANAGEMENT_URL,
      );
    }
  }

  /**
   * Returns all the parents of this construct's  stack (i.e. if this construct
   * is within a NestedStack etc etc).
   */
  private get parentStacks() {
    const parents: cdk.Stack[] = [this.stack];
    // Get all the nested stack parents into an array, the array will start with
    // the root stack all the way to the stack holding the lambda as the last
    // element in the array.
    while (parents[0].nestedStackParent) {
      parents.unshift(parents[0].nestedStackParent as cdk.Stack);
    }
    return parents;
  }

  /**
   * When this stack is synthesized, we output a manifest which gives the CLI
   * the info it needs to run the lambdas in watch mode. This will include the
   * logical IDs and the stack name (and logical IDs of nested stacks).
   */
  public synthesize(session: cdk.ISynthesisSession): void {
    super.synthesize(session);

    const asset = this.node
      .findAll()
      .find((construct) => construct instanceof Asset) as Asset;

    if (!asset) {
      throw new Error(
        "WatchableNodejsFunction could not find an Asset in it's children",
      );
    }

    const assetPath = path.join(session.outdir, asset.assetPath);
    const [rootStack, ...nestedStacks] = this.parentStacks;
    const cdkWatchManifest = readManifest() || {
      region: this.stack.region,
      lambdas: {},
    };
    cdkWatchManifest.region = this.stack.region;

    cdkWatchManifest.lambdas =
      typeof cdkWatchManifest.lambdas === 'object'
        ? cdkWatchManifest.lambdas
        : {};
    cdkWatchManifest.lambdas[this.node.path] = {
      assetPath,
      realTimeLogsStackLogicalId: this.cdkWatchLogsApi
        ? this.stack.getLogicalId(
            this.cdkWatchLogsApi.nestedStackResource as CfnElement,
          )
        : undefined,
      realTimeLogsApiLogicalId: this.cdkWatchLogsApi?.websocketApi
        ? this.stack.getLogicalId(this.cdkWatchLogsApi.websocketApi)
        : undefined,
      esbuildOptions: this.esbuildOptions,
      lambdaLogicalId: this.stack.getLogicalId(
        this.node.defaultChild as cdk.CfnResource,
      ),
      rootStackName: rootStack.stackName,
      nestedStackLogicalIds: nestedStacks.map(
        (nestedStack) =>
          nestedStack.nestedStackParent?.getLogicalId(
            nestedStack.nestedStackResource as cdk.CfnResource,
          ) as string,
      ),
    };

    writeManifest(cdkWatchManifest);
  }
}

export {WatchableNodejsFunction, WatchableNodejsFunctionProps};
