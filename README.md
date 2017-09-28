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

You should consider replacing javascript compiler with `solc`, this will increase your turnover several times. Use following patches over cli.bundle.js (into which truffle is packed)
```
--- var result = solc.compileStandard(JSON.stringify(solcStandardInput));
+++ var result = require('child_process').execSync('solc --standard-json', {input: JSON.stringify(solcStandardInput)});
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
We are using version custom version of `solidity-coverage`. Versions later than `0.2.2` introduce a problem as described in
https://github.com/sc-forks/solidity-coverage/issues/118
which results in balances increasing due to code execution and basically the result balance is unpredictable due to returned stipend.
This issue prevents test that check balances to run properly.

Custom version fixes two other bugs:
1. For large trace files, `readFileSync` will fail silently, stream is used to read lines instead
2. `exec` on child process will kill child if stdout buffer overflows, buffer was increased to 10MB
3. It refers to testrpc `4.0.1` that has stipend not modified.

Solidity code coverage runs own testrpc node (modified). You can run this node via
```
./node_modules/ethereumjs-testrpc-sc/build/cli.node.js --gasPrice 1 --gasLimit 0xfffffffffff -v
```
and execute tests via `coverage` network to check coverage behavior.

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
on revert with some probability. This makes running large test suites hard as there is high chance of testrpc to crash.

As snapshotting is used to recover blockchain state after deployment scripts, we have no use of that mechanism and it can be disabled. Here is a patch to test runner
https://github.com/trufflesuite/truffle-core/blob/master/lib/testing/testrunner.js
```
TestRunner.prototype.resetState = function(callback) {
  callback();
 };
```

Snapshotting has other problems that also makes it useless for state management in our tests.
https://github.com/trufflesuite/ganache-core/issues/7
Hopefully PRs solving this are pending.

### Neufund modified Truffle

Modified version of truffle is referenced for running test cases.
1. Revert and snapshot are removed from `truffle-core` (https://github.com/Neufund/truffle-core/commit/83404a758a684e8d3d4806f24bc40a25c0817b79)
2. https://github.com/trufflesuite/truffle/issues/569 is fixed as testing overloaded `transfer` is impossible (https://github.com/Neufund/truffle-contract/commit/ecae09942db60039f2dc4768ceeb88776226f0ca)
