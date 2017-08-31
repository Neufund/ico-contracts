require("babel-register");
require("babel-polyfill");
const TestRPC = require("ethereumjs-testrpc");

module.exports = {
  networks: {
    development: {
      network_id: "*",
      provider: TestRPC.provider()
    }
  }
};
