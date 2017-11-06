/* eslint-disable global-require */
require("babel-register");
require("babel-polyfill");
const TestRPC = require("ethereumjs-testrpc");

const nanoProvider = (providerUrl, nanoPath, network) =>
  process.argv.some(arg => arg === network)
    ? require("./nanoWeb3Provider").nanoWeb3Provider(providerUrl, nanoPath)
    : undefined;

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
        accounts: Array(10).fill({ balance: "12300000000000000000000000" })
      })
    },
    inprocess_test: {
      network_id: "*",
      provider: TestRPC.provider({
        accounts: Array(10).fill({ balance: "12300000000000000000000000" })
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
      gas: 4600000,
      provider: nanoProvider("http://localhost:8545", "44'/60'/0'/0", "nano")
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
