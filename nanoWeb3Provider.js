const Web3 = require("web3");
const ProviderEngine = require("web3-provider-engine");
const LedgerWalletSubproviderFactory = require("ledger-wallet-provider");
const Web3Subprovider = require("web3-provider-engine/subproviders/web3.js");
const FilterSubprovider = require("web3-provider-engine/subproviders/filters.js");

export function nanoWeb3Provider(providerUrl, nanoPath) {
  const web3HttpProvider = new Web3.providers.HttpProvider(providerUrl);
  const engine = new ProviderEngine();

  engine.addProvider(new FilterSubprovider());
  engine.addProvider(
    LedgerWalletSubproviderFactory.default(new Web3(web3HttpProvider), nanoPath)
  );
  engine.addProvider(new Web3Subprovider(web3HttpProvider));

  engine.on("block", () => {
    // console.log("================================");
    // console.log(
    //   "BLOCK CHANGED:",
    //   `#${block.number.toString("hex")}`,
    //   `0x${block.hash.toString("hex")}`
    // );
    // console.log("================================");
  });
  engine.start();

  return engine;
}
