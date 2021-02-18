<h1 align="center"><code>cdk-watch</code> 👀</h1>

<p align="center">
  Run your CDK Stack's Lambda functions as if they were in a development environment
</p>

<p align="center">
  <code>cdkw "MyStack/API/**"</code><br />
   <small>
    <code>yarn add cdk-watch</code>
  </small>
</p>

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
$ yarn cdkw --no-logs "MyStack/API/**"

# If you are using npm
$ npm run cdkw "**"
```

*Skip to the [command reference](#command-reference).*

---

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
