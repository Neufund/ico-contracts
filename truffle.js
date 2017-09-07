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
        accounts: Array(10).fill({ balance: "10000000000000000000000" })
      })
    }
  }
};
