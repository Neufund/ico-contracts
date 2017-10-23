require("babel-register");
require("babel-polyfill");
const TestRPC = require("ethereumjs-testrpc");

/**
 In order to deploy normally without this setup you will have to comment all the code from =====>
 */
const Web3 = require("web3");

function nanoWeb3Provider() {

  const ProviderEngine = require("web3-provider-engine");
  const LedgerWalletSubproviderFactory = require("ledger-wallet-provider");
  const Web3Subprovider = require("web3-provider-engine/subproviders/web3.js");
  const FilterSubprovider = require("web3-provider-engine/subproviders/filters.js");

  const providerUrl = "http://localhost:8545";
  const nanoPath = "44'/60'/0'/0`";

  const web3HttpProvider = new Web3.providers.HttpProvider(providerUrl);
  const engine = new ProviderEngine();

  engine.addProvider(new FilterSubprovider());
  engine.addProvider(
    LedgerWalletSubproviderFactory.default(new Web3(web3HttpProvider), nanoPath)
  );
  engine.addProvider(new Web3Subprovider(web3HttpProvider));

  engine.on('block', function (block) {
    console.log('================================');
    console.log('BLOCK CHANGED:', '#' + block.number.toString('hex'), '0x' + block.hash.toString('hex'));
    console.log('================================');
    engine.stop();
  })
  engine.start();

  return engine;
}
/**
 =====> Till here
 BUG: truffle cannot finish deployment without commenting the above section
 apparently for some reason something happens with there default instance regardless
 if you don't comment this section smart contracts will not deploy
 TEST CASE:  1 - deploy contracts using truffle's default deployer instance
 2 - Use Nano engine with truffle console
 3 - in console commitment = Commitment.at("ICO ADDRESS")
 4 - in console commitment.amendAgreement("ipfs").then((data) => console.log(data))
 Transaction was signed succseffully
 */
module.exports = {
  networks: {
    localhost: {
      network_id: "*",
      host: "localhost",
      port: 8545
    },
    inprocess: {
      network_id: "*",
      provider: TestRPC.provider({
        accounts: Array(10).fill({balance: "12300000000000000000000000"})
      })
    },
    inprocess_test: {
      network_id: "*",
      provider: TestRPC.provider({
        accounts: Array(10).fill({balance: "12300000000000000000000000"})
      })
    },
    inprocess_massive_test: {
      network_id: "*",
      gas: 0xffffffff,
      provider: TestRPC.provider({
        deterministic: true,
        gasLimit: 0xffffffff,
        accounts: Array(100).fill({ balance: "12300000000000000000000000" })
      })
    },
    coverage: {
      network_id: "*",
      gas: 0xfffffffffff,
      gasPrice: 1,
      host: "localhost",
      port: 8555
    },
    ropsten: {
      host: "localhost", // local parity kovan node
      port: 8545,
      network_id: "3"
    },
    kovan: {
      host: "localhost", // local parity kovan node
      port: 8545,
      network_id: "42"
    },
    ropsten_live: {
      host: "localhost", // local parity ropsten
      port: 8544,
      network_id: "3",
      gas: 4300000, // close to current mainnet limit
      gasPrice: 10000000000 // 10 gwei /shannon
    },
    nano: {
      network_id: "*",
      host: "localhost",
      port: 8545,
      gas: 4600000
      // provider: nanoWeb3Provider.nanoWeb3Provider(providerUrl, nanoPath) // Our costume instance
    },
    simulated_live: {
      network_id: "*",
      host: "localhost",
      port: 8545,
      gas: 4600000
    },
    nf_private: {
      host: "localhost",
      port: 8545,
      network_id: "16",
      gas: 4600000,
      // gasPrice: 11904761856
      gasPrice: 21000000000
    },
    nf_private_test: {
      host: "localhost",
      port: 8545,
      network_id: "16",
      gas: 4600000,
      // gasPrice: 11904761856
      gasPrice: 21000000000
    },
    nf_dev_test: {
      host: "localhost",
      port: 8545,
      network_id: "17",
      gas: 4600000,
      // gasPrice: 11904761856
      gasPrice: 21000000000
    },
    live: {
      network_id: 1, // Ethereum public network
      host: "192.168.100.30",
      port: 8545,
      gas: 4300000, // close to current mainnet limit
      gasPrice: 21000000000 // 21 gwei /shannon
      // optional config values
      // host - defaults to "localhost"
      // port - defaults to 8545
      // gas
      // gasPrice
      // from - default address to use for any transaction Truffle makes during migrations
    }
  }
};
