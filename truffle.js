require('babel-register');
require('babel-polyfill');

require('./mocha.js');

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id
    },
  },
};
