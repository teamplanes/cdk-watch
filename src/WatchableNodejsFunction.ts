/* eslint-disable no-new */
/* eslint-disable import/no-extraneous-dependencies */
import {NodejsFunction, NodejsFunctionProps} from '@aws-cdk/aws-lambda-nodejs';
import {Runtime} from '@aws-cdk/aws-lambda';
import {Asset} from '@aws-cdk/aws-s3-assets';
import * as path from 'path';
import findUp from 'find-up';
import * as cdk from '@aws-cdk/core';
import {BuildOptions, Loader} from 'esbuild';
import {readManifest} from './utils/readManifest';
import {writeManifest} from './utils/writeManifest';
import {RealTimeLambdaLogsAPI} from './RealTimeLambdaLogsAPI';

type WatchableNodejsFunctionProps = NodejsFunctionProps;

/**
 * `extends` NodejsFunction and behaves the same, however `entry` is a required
 * prop to prevent duplicating logic across NodejsFunction and
 * WatchableNodejsFunction to infer `entry`.
 */
class WatchableNodejsFunction extends NodejsFunction {
  public esbuildOptions: BuildOptions;

  constructor(
    scope: cdk.Construct,
    id: string,
    props: WatchableNodejsFunctionProps,
  ) {
    super(scope, id, props);
    const {entry} = props;
    if (!entry) throw new Error('`entry` must be provided');
    const target = props.runtime?.runtimeEquals(Runtime.NODEJS_10_X)
      ? 'node10'
      : 'node12';
    this.esbuildOptions = {
      target,
      bundle: true,
      entryPoints: [entry],
      platform: 'node',
      minify: props.bundling?.minify,
      sourcemap: props.bundling?.sourceMap,
      external: [
        ...(props.bundling?.externalModules ?? []),
        ...(props.bundling?.nodeModules ?? []),
      ],
      loader: props.bundling?.loader as {[ext: string]: Loader} | undefined,
      define: props.bundling?.define,
      logLevel: props.bundling?.logLevel,
      keepNames: props.bundling?.keepNames,
      tsconfig: props.bundling?.tsconfig
        ? path.resolve(entry, path.resolve(props.bundling?.tsconfig))
        : findUp.sync('tsconfig.json', {cwd: path.dirname(entry)}),
      banner: props.bundling?.banner,
      footer: props.bundling?.footer,
    };

    const [rootStack] = this.parentStacks;
    const logsApiId = 'CDKWatchWebsocketLogsApi';
    const logsApi =
      (rootStack.node.tryFindChild(logsApiId) as
        | undefined
        | RealTimeLambdaLogsAPI) ||
      new RealTimeLambdaLogsAPI(rootStack, logsApiId);

    this.addLayers(logsApi.logsLayerVersion);
    this.addEnvironment(
      'CDK_WATCH_CONNECTION_TABLE_NAME',
      logsApi.CDK_WATCH_CONNECTION_TABLE_NAME,
    );
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
