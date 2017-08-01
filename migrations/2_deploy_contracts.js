const ConvertLib = artifacts.require('./ConvertLib.sol');
const MetaCoin = artifacts.require('./MetaCoin.sol');
const NeumarkFactory = artifacts.require('./NeumarkFactory.sol');
const NeumarkController = artifacts.require('./NeumarkController.sol');
const Neumark = artifacts.require('./Neumark.sol');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = deployer =>
  deployer.then(async () => {
    console.log('Constracts deploying...');
    await deployer.deploy(ConvertLib);
    await deployer.link(ConvertLib, MetaCoin);
    await deployer.deploy(MetaCoin);
    await deployer.deploy(NeumarkFactory);
    await deployer.deploy(Neumark, NeumarkFactory.address);
    await deployer.deploy(NeumarkController, Neumark.address);
    const neumark = await Neumark.deployed();
    await neumark.changeController(NeumarkController.address);

    //await sleep(10000); // Verify that Truffle actually waits for the promise to complete.
    console.log('Contracts deployed!');
  });
