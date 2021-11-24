/* eslint-disable no-new */
/* eslint-disable import/no-extraneous-dependencies */
import {
  BundlingOptions,
  NodejsFunction,
  NodejsFunctionProps,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import {Runtime} from 'aws-cdk-lib/aws-lambda';
import {Asset} from 'aws-cdk-lib/aws-s3-assets';
import * as path from 'path';
import * as fs from 'fs-extra';
import findUp from 'find-up';
import * as cdk from 'aws-cdk-lib';
import {BuildOptions, Loader} from 'esbuild';
import minimatch from 'minimatch';
import {Construct} from 'constructs';
import {readManifest} from '../lib/readManifest';
import {writeManifest} from '../lib/writeManifest';
import {RealTimeLambdaLogsAPI} from './RealTimeLambdaLogsAPI';
import {
  CDK_WATCH_CONTEXT_LOGS_ENABLED,
  CDK_WATCH_CONTEXT_NODE_MODULES_DISABLED,
} from '../consts';
import {NodeModulesLayer} from './NodeModulesLayer';

type NodeModulesSelectOption =
  | {
      // whitelist the modules you'd like to install in the layer
      include: string[];
    }
  | {
      // include all but blacklist those you'd like to not include in the layer
      exclude: string[];
    };

interface WatchableBundlingOptions extends BundlingOptions {
  /**
   * Similar to `bundling.nodeModules` however in this case your modules will be
   * bundled into a Lambda layer instead of being uploaded with your lambda
   * function code. This has upside when 'watching' your code as the only code
   * that needs to be uploaded each time is your core lambda code rather than
   * any modules, which are unlikely to change frequently. You can either select
   * the modules you  want t =o include in the layer, or include all and select
   * the module's you'd like to exclude. Globs are accepted here.
   */
  nodeModulesLayer?: NodeModulesSelectOption;
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

const getNodeModuleLayerDependencies = (
  pkgJsonPath: string,
  selectOption: NodeModulesSelectOption,
) => {
  if ('include' in selectOption) {
    return selectOption.include;
  }

  const packageJson = fs.readJSONSync(pkgJsonPath);
  return Object.keys(packageJson.dependencies || {}).filter(
    (key) => !selectOption.exclude.some((pattern) => minimatch(key, pattern)),
  );
};

/**
 * `extends` NodejsFunction and behaves the same, however `entry` is a required
 * prop to prevent duplicating logic across NodejsFunction and
 * WatchableNodejsFunction to infer `entry`.
 */
class WatchableNodejsFunction extends NodejsFunction {
  public esbuildOptions: BuildOptions;

  public cdkWatchLogsApi?: RealTimeLambdaLogsAPI;

  public readonly local?: cdk.ILocalBundling;

  private readonly nodeModulesLayerVersion: string | undefined;

  constructor(
    scope: Construct,
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
    const nodeModulesLayerSelectOption = props.bundling?.nodeModulesLayer;

    let moduleNames: string[] | null = null;
    if (nodeModulesLayerSelectOption) {
      moduleNames = getNodeModuleLayerDependencies(
        pkgPath,
        nodeModulesLayerSelectOption,
      );
    }
    const bundling: WatchableBundlingOptions = {
      ...props.bundling,
      externalModules: [
        ...(moduleNames || []),
        ...(props.bundling?.externalModules || ['aws-sdk']),
      ],
    };
    super(scope, id, {
      ...props,
      bundling,
    });
    const shouldSkipInstall =
      scope.node.tryGetContext(CDK_WATCH_CONTEXT_NODE_MODULES_DISABLED) === '1';
    if (moduleNames) {
      const nodeModulesLayer = new NodeModulesLayer(this, 'NodeModulesLayer', {
        nodeModules: moduleNames,
        pkgPath,
        depsLockFilePath: props.depsLockFilePath,
        skip: shouldSkipInstall,
      });
      this.addLayers(nodeModulesLayer);
      this.nodeModulesLayerVersion = nodeModulesLayer.layerVersion;
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

    this.node.addValidation({
      validate: () => {
        try {
          this.outputManifest();
          return [];
        } catch (error) {
          return [(error as Error).message];
        }
      },
    });
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
  public outputManifest(): void {
    const asset = this.node
      .findAll()
      .find((construct) => construct instanceof Asset) as Asset;

    if (!asset) {
      throw new Error(
        "WatchableNodejsFunction could not find an Asset in it's children",
      );
    }

    const assetPath = path.join('', asset.assetPath);
    const [rootStack, ...nestedStacks] = this.parentStacks;
    const cdkWatchManifest = readManifest() || {
      region: this.stack.region,
      lambdas: {},
    };

    if (cdk.Token.isUnresolved(this.stack.region)) {
      throw new Error(
        '`stack.region` is an unresolved token. `cdk-watch` requires a concrete region to be set.',
      );
    }

    cdkWatchManifest.region = this.stack.region;

    cdkWatchManifest.lambdas =
      typeof cdkWatchManifest.lambdas === 'object'
        ? cdkWatchManifest.lambdas
        : {};
    cdkWatchManifest.lambdas[this.node.path] = {
      assetPath,
      nodeModulesLayerVersion: this.nodeModulesLayerVersion,
      realTimeLogsStackLogicalId: this.cdkWatchLogsApi
        ? this.stack.getLogicalId(
            this.cdkWatchLogsApi.nestedStackResource as cdk.CfnElement,
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
