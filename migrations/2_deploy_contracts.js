require('babel-register');

const NeumarkFactory = artifacts.require('./NeumarkFactory.sol');
const NeumarkController = artifacts.require('./NeumarkController.sol');
const Neumark = artifacts.require('./Neumark.sol');
const LockedAccount = artifacts.require('LockedAccount');
const SafeMath = artifacts.require('SafeMath');
const EtherToken = artifacts.require('EtherToken');
const Crowdsale = artifacts.require('Crowdsale');
const Curve = artifacts.require('./Curve.sol');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const months = 30 * 24 * 60 * 60;
const FP_SCALE = 10000;
const ether = Wei => Wei * 10 ** 18;

/* const minCap = new web3.BigNumber(web3.toWei(1, 'ether'));
const maxCap = new web3.BigNumber(web3.toWei(30, 'ether'));
const startDate = Date.now.getTime() / 1000; */

module.exports = deployer =>
  deployer.then(async () => {
    console.log('Neumark deploying...');
    await deployer.deploy(NeumarkFactory);
    await deployer.deploy(Neumark, NeumarkFactory.address);
    await deployer.deploy(NeumarkController, Neumark.address);
    const neumark = await Neumark.deployed();
    await neumark.changeController(NeumarkController.address);
    console.log('ETR-T and LockedAccount deploying...');
    await deployer.deploy(EtherToken);
    const etherToken = await EtherToken.deployed();
    await deployer.deploy(Curve, NeumarkController.address);
    await deployer.deploy(
      LockedAccount,
      etherToken.address,
      Curve.address,
      18 * months,
      Math.round(0.1 * ether(1)) // fractions are in 10**18
    );
    const lock = await LockedAccount.deployed();
    console.log('Deploying crowdsale');
    await deployer.deploy(
      Crowdsale,
      Date.now() / 1000 + 60,
      Date.now() / 1000 + 900,
      ether(1),
      ether(2000),
      etherToken.address,
      lock.address,
      Curve.address
    );
    const crowdsale = await Crowdsale.deployed();
    await lock.setController(crowdsale.address);
    //  await sleep(10000); // Verify that Truffle actually waits for the promise to complete.
    console.log('Contracts deployed!');

    console.log('----------------------------------');
    console.log(`ICO contract: ${crowdsale.address}`);
    console.log('----------------------------------');
  });
