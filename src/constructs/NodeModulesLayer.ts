import execa from 'execa';
import * as fs from 'fs-extra';
import * as path from 'path';
import objectHash from 'object-hash';
import {Code, LayerVersion} from 'aws-cdk-lib/aws-lambda';
import {Construct} from 'constructs';
import {RemovalPolicy} from 'aws-cdk-lib';
import {CDK_WATCH_OUTDIR} from '../consts';

interface NodeModulesLayerProps {
  depsLockFilePath?: string;
  pkgPath: string;
  nodeModules: string[];
  skip?: boolean;
}

enum Installer {
  NPM = 'npm',
  YARN = 'yarn',
}

// TODO: Use new PackageManager class instead
enum LockFile {
  NPM = 'package-lock.json',
  YARN = 'yarn.lock',
}

/**
 * Find the lowest of multiple files by walking up parent directories. If
 * multiple files exist at the same level, they will all be returned.
 * Ref: https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/aws-lambda-nodejs/lib/util.ts
 */
export function findUpMultiple(
  names: string[],
  directory: string = process.cwd(),
): string[] {
  const absoluteDirectory = path.resolve(directory);

  const files = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const name of names) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) {
      files.push(file);
    }
  }

  if (files.length > 0) {
    return files;
  }

  const {root} = path.parse(absoluteDirectory);
  if (absoluteDirectory === root) {
    return [];
  }

  return findUpMultiple(names, path.dirname(absoluteDirectory));
}

/**
 * Find a file by walking up parent directories
 * Ref: https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/aws-lambda-nodejs/lib/util.ts
 */
export function findUp(
  name: string,
  directory: string = process.cwd(),
): string | undefined {
  return findUpMultiple([name], directory)[0];
}

/**
 * Ref: https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/aws-lambda-nodejs/lib/util.ts
 */
export function tryGetModuleVersionFromPkg(
  mod: string,
  pkgJson: {[key: string]: any},
  pkgPath: string,
): string | undefined {
  const dependencies = {
    ...(pkgJson.dependencies ?? {}),
    ...(pkgJson.devDependencies ?? {}),
    ...(pkgJson.peerDependencies ?? {}),
  };

  if (!dependencies[mod]) {
    return undefined;
  }

  // If it's a "file:" version, make it absolute
  const fileMatch = dependencies[mod].match(/file:(.+)/);
  if (fileMatch && !path.isAbsolute(fileMatch[1])) {
    const absoluteFilePath = path.join(path.dirname(pkgPath), fileMatch[1]);
    return `file:${absoluteFilePath}`;
  }

  return dependencies[mod];
}

/**
 * Returns a module version by requiring its package.json file
 *
 * Ref: https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/aws-lambda-nodejs/lib/util.ts
 */
export function tryGetModuleVersionFromRequire(
  mod: string,
): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    // eslint-disable-next-line import/no-dynamic-require, global-require, @typescript-eslint/no-var-requires
    return require(`${mod}/package.json`).version;
  } catch (err) {
    return undefined;
  }
}

/**
 * Extract versions for a list of modules.
 *
 * First lookup the version in the package.json and then fallback to requiring
 * the module's package.json. The fallback is needed for transitive dependencies.
 *
 * Ref: https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/aws-lambda-nodejs/lib/util.ts
 */
export function extractDependencies(
  pkgPath: string,
  modules: string[],
): {[key: string]: string} {
  const dependencies: {[key: string]: string} = {};

  // Use require for cache
  // eslint-disable-next-line import/no-dynamic-require, global-require, @typescript-eslint/no-var-requires
  const pkgJson = require(pkgPath);

  // eslint-disable-next-line no-restricted-syntax
  for (const mod of modules) {
    const version =
      tryGetModuleVersionFromPkg(mod, pkgJson, pkgPath) ??
      tryGetModuleVersionFromRequire(mod);
    if (!version) {
      throw new Error(
        `Cannot extract version for module '${mod}'. Check that it's referenced in your package.json or installed.`,
      );
    }
    dependencies[mod] = version;
  }

  return dependencies;
}

/**
 * Copied from cdk source:
 * https://github.com/aws/aws-cdk/blob/ca42461acd4f42a8bd7c0fb05788c7ea50834de2/packages/@aws-cdk/aws-lambda-nodejs/lib/function.ts#L88-L103
 */
const getDepsLock = (propsDepsLockFilePath?: string) => {
  let depsLockFilePath: string;
  if (propsDepsLockFilePath) {
    if (!fs.existsSync(propsDepsLockFilePath)) {
      throw new Error(`Lock file at ${propsDepsLockFilePath} doesn't exist`);
    }
    if (!fs.statSync(propsDepsLockFilePath).isFile()) {
      throw new Error('`depsLockFilePath` should point to a file');
    }
    depsLockFilePath = path.resolve(propsDepsLockFilePath);
  } else {
    const lockFile = findUp(LockFile.YARN) ?? findUp(LockFile.NPM);
    if (!lockFile) {
      throw new Error(
        'Cannot find a package lock file (`yarn.lock` or `package-lock.json`). Please specify it with `depsFileLockPath`.',
      );
    }
    depsLockFilePath = lockFile;
  }

  return depsLockFilePath;
};

export class NodeModulesLayer extends LayerVersion {
  public readonly layerVersion: string;

  constructor(scope: Construct, id: string, props: NodeModulesLayerProps) {
    const depsLockFilePath = getDepsLock(props.depsLockFilePath);

    const {pkgPath} = props;

    // Determine dependencies versions, lock file and installer
    const dependenciesPackageJson = {
      dependencies: extractDependencies(pkgPath, props.nodeModules),
    };
    let installer = Installer.NPM;
    let lockFile = LockFile.NPM;
    if (depsLockFilePath.endsWith(LockFile.YARN)) {
      lockFile = LockFile.YARN;
      installer = Installer.YARN;
    }

    const layerBase = path.join(
      process.cwd(),
      'cdk.out',
      CDK_WATCH_OUTDIR,
      'node-module-layers',
      scope.node.addr,
    );
    const outputDir = path.join(layerBase, 'nodejs');

    fs.ensureDirSync(outputDir);
    fs.copyFileSync(depsLockFilePath, path.join(outputDir, lockFile));
    fs.writeJsonSync(
      path.join(outputDir, 'package.json'),
      dependenciesPackageJson,
    );
    const layerVersion = objectHash(dependenciesPackageJson);

    if (!props.skip) {
      // eslint-disable-next-line no-console
      console.log('Installing node_modules in layer');
      execa.sync(installer, ['install'], {
        cwd: outputDir,
        stderr: 'inherit',
        stdout: 'ignore',
        stdin: 'ignore',
      });
    }

    super(scope, id, {
      removalPolicy: RemovalPolicy.DESTROY,
      description: 'NodeJS Modules Packaged into a Layer by cdk-watch',
      code: Code.fromAsset(layerBase),
      layerVersionName: layerVersion,
    });

    this.layerVersion = layerVersion;
  }
}
