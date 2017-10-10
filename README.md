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

## Deployment

### Deployed contracts (2_deploy_contracts.js)
Contracts are deployed in following order
1. **RoleBasedAccessControl** - used to set up access permissions in other contracts, see below
2. **EthereumForkArbiter** - used to indicate fork that is actually supported (legally and technically),
3. **Neumark** - ERC20/223 and snapshotable token representing Neumark reward to investors,
4. **EtherToken** - encapsulates Ether as a token
5. **EuroToken** - represents Euro as a token (EUR-T), see below,
6. **LockedAccount(EtherToken)** - represents investor's individual investment account with unlock date, for Ether investment,
7. **LockedAccount(EuroToken)** - represents investor's individual investment account with unlock date, for EUR-T investment,
8. **Commitment** - represents ICBM process with pre-ICO, and ICO stages, whitelisting, possibility to invest in Ether/EUR-T and other features.

Commitment contracts currently serves as a 'Universe'. All contracts, agreements and parameters we officially support during ICBM may be found in it or in other aggregated contracts.

### Contracts parameters (2_deploy_contracts.js and config.js)
Several contracts require parameters to be set in constructors as specified below. Once set those parameters cannot be changed.

**LockedAccount**
1. **LOCK_DURATION** - duration of lock after which `unlock` comes without penalty, in seconds
2. **PENALTY_FRACTION** - unlock penalty as fraction of investment amount, where 10\*\*18 is 100%, 10\*\*17 is 10% etc.

**Commitment**
1. **START_DATE** - start date of ICBM (see `StateMachine` contract for process details), as Unix/Ethereum timestamp (UTC),
2. **CAP_EUR** - safety cap (in EUR-T) which corresponds to maximum number of Neumarks that may be issued during ICBM, in "wei" (10**-18 parts of EUR-T).
3. **MIN_TICKET_EUR** - minimum ticket in EUR-T, represented as above
4. **ETH_EUR_FRACTION** - EUR-T to ETH rate used during whole ICBM. we use constant rate to compute Neumark reward, there's no oracle.
5. **PLATFORM_OPERATOR_WALLET** - see below.

**Agreements**
1. **RESERVATION_AGREEMENT** - ipfs link to Reservation Agreement, attached to `Commitment` contract
2. **NEUMARK_HOLDER_AGREEMENT** - ipfs link to Neumark Token Holder Agreeement attached to `Neumark` contract

Please note that several ICBM duration parameters are encoded in `StateMachine` contract. You may choose to change them form test deployments.

### Roles and Accounts (3_deploy_permissions.js, config.js)
Several accounts are required to deploy on `mainnet` due to many roles with specific permissions that are required to control ICBM and Neumark token. Below is a list of those roles.

|Role|Description|Mainnet account|Scope|
|-----|----------|---------------|-----|
|LOCKED ACCOUNT ADMIN|May attach controller, set fee disbursal pool and migration in Locked Account contract| PO Admin | LockedAccount |
|WHITELIST ADMIN|May setup whitelist and abort Commitment contract with curve rollback| PO Admin | Commitment |
|NEUMARK ISSUER|May issue (generate) Neumarks (only Commitment or ETOs contract may have this right)| N/A| Commitment |
|TRANSFER ADMIN|May enable/disable transfers on Neumark| PO Admin | Neumark |
|RECLAIMER|may reclaim tokens/ether from contracts| PO Admin | global role |
|PLATFORM OPERATOR REPRESENTATIVE|Represents legally platform operator in case of forks and contracts with legal agreement attached| PO Management | global role |
|EURT DEPOSIT MANAGER|Allows to deposit EUR-T and allow addresses to send and receive EUR-T | PO Admin | EuroToken |
|ACCESS CONTROLLER|Assigns permissions to addresses and may change access policy for a contract| PO Admin | global role |
|PLATFORM OPERATOR WALLET|Stores Platform Operator Neumark reward and (temporarily) unlock penalties| PO Wallet | N/A |

Please note that ACCESS CONTROL role is initially assigned to an address of the deploying account (like in `Ownable` pattern). This permission is then relinquished to PO Admin account.
Accounts are separate physical devices (Nano Ledger S). Please note that account used to deploy has no other uses and its private key can be safely destroyed after control is relinquished.

### Euro Token transfer permissions (3_deploy_permissions.js)
Euro Token is heavily policed token, where only holders with permission may receive or send EUR-T. Transfer permissions are managed by EURT DEPOSIT MANAGER role which also is the sole issuer of EUR-T. `Issue EUR-T` operation enables issued address to receive EUR-T (and is done only against KYCed accounts) so after deployment no further changes to transfer permissions are necessary. Please note that permission to `transfer from` enables such address to act as a broker (`transferFrom`) which may be used by addresses without such permission to send EUR-T to other address. This property is used by Commitment and LockedAccount contracts to deposit EUR-T during ICBM process.

*EURT DEPOSIT MANAGER issues to -> investor (has transfer to) which approves -> Commitment contract (has transfer from and to) to -> transfer to LockedAccount contract (transfer from and to)*

Full list of transfer permission is as follows.

|who|transfer to|transfer from|
|---|-----------|-------------|
|EUR-T investor| Y | N |
|Commitment| Y | Y |
|LockedAccount| Y | Y |

### Linking LockedAccount (4_link_contracts.js)
Both `LockedAccount` instances must be linked to Commitment contract (which becomes their controller) to be able to store investor's assets and provide unlock mechanism. Both LockedAccount must also have unlock penalty disbursal pool set for `unlock` operation to work. Per whitepaper, until platform is deployed, penalties are stored in Platform Operator wallet (however `LockedAccount` supports disbursal contracts as well). Linking requires `LOCKED ACCOUNT ROLE`.

### Amend legal agreements (5_amend_agreements.js)
`Neumark` and `Commitment` contracts need to be provided ipfs link to legal agreement. Otherwise all functions of those contracts that require it will revert. In case of main network this must happen via transaction from `PLATFORM OPERATOR REPRESENTATIVE` using its respective Nano S and it's not done in deployment scripts in this repo. In case of other networks, mock legal agreements will be immediately attached.

### Setting whitelist
Whitelist may be set during `Before` state of `Commitment` contract. This is not part of deployment script in this repo. Setting whitelist requires `WHITELIST ADMIN` role.


### Networks defined in truffle
There are several conventions in naming truffle networks used for deployment.
**Network with names ending with `_live`** will be deployed in production mode which means that:
1. Live accounts addresses as specified in `config.js` will be assigned to roles.
2. Live smart contracts parameters as specified in `config.js` will be deployed
2. Agreements will not be attached.
3. Deployer will set ACCESS_CONTROLLER as secondary access control admin address and will remove itself as global ACCESS_CONTROLLER (see `6_relinquish_control.js`)

**Other networks** will be deployed in test mode which means that:
1. All roles are assigned to accounts[0], which is also deployer. This account controls everything.
2. Modify `config.js` as you wish to deploy with custom smart contract parameters.
2. Everything is deployed and set up. Commitment contract should be ready to go after deployment.

**Special networks**
1. *simulated_live* will be deployed as live network but is intended to be used against testrpc. Roles will be assigned to testrpc provided accounts. It is intended to test various administrative operations (like enabling/disabling transfers) before live deployment.
2. *inprocess_test* and *coverage* will not deploy anything.

```
yarn truffle migrate --reset --network simulated_live
```
