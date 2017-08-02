require('babel-register');

// import ether from './helpers/ether';

const NeumarkFactory = artifacts.require('./NeumarkFactory.sol');
const NeumarkController = artifacts.require('./NeumarkController.sol');
const Neumark = artifacts.require('./Neumark.sol');
const LockedAccount = artifacts.require('LockedAccount');
const SafeMath = artifacts.require('SafeMath');
const EtherToken = artifacts.require('EtherToken');
const Crowdsale = artifacts.require('Crowdsale');


const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const months = 30 * 24 * 60 * 60;
const FP_SCALE = 10000;
/* const minCap = new web3.BigNumber(web3.toWei(1, 'ether'));
const maxCap = new web3.BigNumber(web3.toWei(30, 'ether'));
const startDate = Date.now.getTime() / 1000; */

module.exports = deployer =>
  deployer.then(async () => {
    console.log('Neumark deploying...');
    await deployer.deploy(SafeMath);
    await deployer.deploy(NeumarkFactory);
    await deployer.deploy(Neumark, NeumarkFactory.address);
    await deployer.deploy(NeumarkController, Neumark.address);
    const neumark = await Neumark.deployed();
    await neumark.changeController(NeumarkController.address);
    console.log('ETR-T and LockedAccount deploying...');
    await deployer.deploy(EtherToken);
    await deployer.link(SafeMath, EtherToken);
    const etherToken = await EtherToken.deployed();
    await deployer.link(SafeMath, LockedAccount);
    await deployer.deploy(LockedAccount, etherToken.address, neumark.address, 18 * months, Math.round(0.1 * FP_SCALE));
    const lock = await LockedAccount.deployed();
    console.log('Deploying crowdsale');
    await deployer.deploy(Crowdsale, etherToken.address, neumark.address, lock.address);
    const crowdsale = await Crowdsale.deployed();
    await lock.setController(crowdsale.address);
  //  await sleep(10000); // Verify that Truffle actually waits for the promise to complete.
    console.log('Contracts deployed!');
  });
