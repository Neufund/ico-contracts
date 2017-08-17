# ICO contracts

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

### Auto fixing linting problems
```
yarn lint:fix
```

### Testing
To run single test, use following syntax
```
truffle test test/LockedAccount.js test/setup.js
```
