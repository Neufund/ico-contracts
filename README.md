# ICO contracts

## Running locally
```
yarn          # installs all dependencies
yarn testrpc  # run testnet

# open new terminal window
yarn deploy
```

## Developing
```
yarn testrpc # run test net
yarn test # run tests
```
Supported compiler: `Version: 0.4.15+commit.bbb8e64f.Linux.g++`
Always use
```
truffle compile --all
```
Truffle is not able to track dependencies correctly and will not recompile files that import other files

You should consider replacing javascript compiler with `solc`, this will increase your turnover several time. Use following pathces over cli.bundle.js (into which truffle is packed)
```
--- var result = solc.compileStandard(JSON.stringify(solcStandardInput));
+++ var result = require('child_process').execSync('solc --standard-json', {input: JSON.stringify(solcStandardInput)});
```
and
```
---                config.artifactor = new Artifactor(temporaryDirectory);
+++               // config.artifactor = new Artifactor(temporaryDirectory);
```

### Auto fixing linting problems
```
yarn lint:fix
```

### Test coverage
```
yarn test:coverage
```

you will find coverage report in `coverage/index.html`.

### Testing
To run all tests, use the following
```
yarn test
```

To run single test, use following syntax
```
yarn truffle test test/LockedAccount.js test/setup.js
```

To run single test case from a test use following syntax
```
it.only('test case', ...
```

*Remarks on current state of tests in truffle and testrpc*

Applies to `truffle 3.4.9` with `testrpc 4.0.1`.

Truffle uses snapshotting mechanism (`evm_snapshot` and `evm_revert`) to revert to clean state between test suites. Current version of testrpc does not handle it correctly and will fail
on revert with some probability. This makes running large test suites hard as there is high chance of testrpc to crash. For that reason `yarn test` will run all test files separately.
Test coverage still works on a batch of files as we need unified report.

As snapshotting is used to recover blockchain state after deployment scripts, we have no use of that mechanism and it can be disabled. Here is a patch test runner
https://github.com/trufflesuite/truffle-core/blob/master/lib/testing/testrunner.js
```
TestRunner.prototype.resetState = function(callback) {
  callback();
 };
```

Snapshotting has other problems that also makes it useless for state management in our tests.
https://github.com/trufflesuite/ganache-core/issues/7
Hopefully PRs solving this are pending.
