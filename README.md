# `cdk-watch` 👀

> Run your CDK Stack's Lambda functions as if they were in a development environment.

- As simple as `cdkw "MyApp/MyApi/**"`
- Your code will be watched and built with the same esbuild config as when deploying your stack
- Simply switch-out your existing `NodejsFunction` with the `WatchableNodejsFunction` construct
- Opt-in to real-time logs, so no more digging through CloudWatch to find your Lambda's logs
- Load your node modules as a separate lambda layer (allows for faster build/upload times)
- Written in TypeScript
- No extra infrastructure required, unless you are opting-in to real-time logs

---

<div align="center">
  <img src="https://cdk-watch-static.s3.eu-west-2.amazonaws.com/demo.gif" width="500">
</div>

---

## Getting Started

#### 1. CDK Updates

Simply switch to use the `WatchableNodejsFunction` rather than the `NodejsFunction`.
```patch
- import {NodejsFunction} from '@aws-cdk/aws-lambda-nodejs';
+ import {WatchableNodejsFunction} from 'cdk-watch';

// ...

- const lambda = new NodejsFunction(this, 'Lambda', {
+ const lambda = new WatchableNodejsFunction(this, 'Lambda', {
  entry: path.resolve(__dirname, '../src/my-lambda.ts'),
  handler: 'handler',
});
```

#### 2. Run Your Stack

```sh
# Run all Lambda functions
$ yarn cdkw "**"

# Run just your API Lambdas, for example
$ yarn cdkw "MyStack/API/**"

# Run without logs
$ yarn cdkw "MyStack/API/**" --no-logs

# Pass context to synth
$ yarn cdkw "MyStack/API/**" -c foo=bar -c hello=world

# If you are using npm
$ npm run cdkw "**"
```

*Skip to the [command reference](#command-reference).*

---

## Real-time Logs

`cdk-watch` provides real-time logs over web-sockets to make the development
feedback-loop faster when debugging your lambdas. This is an additional feature
that requires opt-in, and you have two options for achieving this.
1. **Turn on for all Lambdas:** To turn on real-time logging by default for all
   watchable lambdas in your stack you can set the context variable
   `cdk-watch:forceRealTimeLoggingEnabled` to `true`.
2. To set an individual Lambda to support real-time logging you can pass a prop
   to the `WatchableNodejsFunction`: `watchOptions.realTimeLoggingEnabled=true`.

### How does real-time logging work?

When deploying your stack the `WatchableNodejsFunction` will include the
necessary infrastructure to support WebSockets via API Gateway. It'll also
assign a Lambda Layer Extension to wrap your lambda, the wrapper will patch the
`console` and forward all logs to all API Gateway connections. If you have
multiple lambdas in your stack it'll only create the require infrastructure
once, and reuse it for all lambdas that need it.

## Node Modules Layer

CDK-Watch allows you to install your node-modules a stand alone layer. This
means that when you deploy `cdk-watch` will install your modules in a separate
asset and install them as the lambda's layer. This is great for dev-performance
as the upload bundle will be much smaller. You can configure this using the
`bundling.nodeModulesLayer` property:

```ts
bundling: {
  // Install only "knex" as a standalone layer
  nodeModulesLayer: {include: ['knex']}
}
```

OR:

```ts
bundling: {
  // Install every module found in your package.json except "knex"
  nodeModulesLayer: {exclude: ['knex']}
}
```

## How, what & why?

### Why would you want to do this?

- Deploying via CDK is slow, it takes 1 minute to release an update to a
  zero-dependency, 1 line Lambda function
- AWS provides a tonne of great services, therefore running your code and CDK
  Stack on AWS when developing makes sense rather than attempting to fully
  replicate the environment locally, or missing out on using some of it's services
- Provided you keep your Lambda's small, an update via `cdk-watch` will take a
  couple of seconds

### How does it work?

1. `cdkw` will run `cdk synth`
2. At synthesis the `WatchableNodejsFunction` construct will write a manifest
   file including Lambda Logical IDs, their Stack names and their esbuild config
3. The CLI will now read the manifest and make API calls to fetch the Physical
   IDs of the lambdas
4. The CLI will start polling the logs of each Lambda
5. The CLI will now start esbuild in `watch` mode for each Lambda
6. When the code successfully rebuilds it Zips and uploads the output to Lambda
   directly by calling `updateFunctionCode`

### How is this different from [Serverless-Stack](https://github.com/serverless-stack/serverless-stack)?

SST runs your Lambda functions locally by mocking the deployed lambda with your
local environment. It comes with a number of performance benefits due to the
fact that it doesn't need to upload your function code every time it change.
That said, `cdk-watch` does not come with a slow feedback loop, you can expect
1s-5s from the moment you save a file to the moment its available on AWS. The
upside of `cdk-watch` is we deploy no extra infrastructure to facilitate the
development environment so there is less discrepancy between prod and pre-prod
environments.

---

## Command Reference

For more info on each command add a `--help` flag after any one of them.

- **Watch:** `cdkw "**"` watch your Lambda where the CDK construct path matches
  the glob
- **List:** `cdkw ls "**"` lists all your available `WatchableNodejsFunction`
  Constructs, a convenience command to help you get find paths you need
- **Once:** `cdkw once "**"` updates your lambda's once, rather than in watch
- **Logs:** `cdkw logs "**"` just tails logs for each of the matching lambdas

---

✈️ / [planes.studio](https://planes.studio)
