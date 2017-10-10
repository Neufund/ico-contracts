require("babel-register");
require("babel-polyfill");
const TestRPC = require("ethereumjs-testrpc");

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
      host: "localhost", // local parity kovan node
      port: 8545,
      network_id: "3"
    },
    simulated_live: {
      network_id: "*",
      host: "localhost",
      port: 8545
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
