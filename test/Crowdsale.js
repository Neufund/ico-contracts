import advanceToBlock from './helpers/advanceToBlock';
import EVMThrow from './helpers/EVMThrow';

const Crowdsale = artifacts.require('Crowdsale');
const LockedAccount = artifacts.require('LockedAccount');
const EtherToken = artifacts.require('EtherToken');
const NeumarkController = artifacts.require('NeumarkController');
const NeumarkFactory = artifacts.require('NeumarkFactory');
const Neumark = artifacts.require('Neumark');
const Curve = artifacts.require('Curve');

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const months = 30 * 24 * 60 * 60;
const FP_SCALE = 10000;
const ether = wei => (wei * 10**18);

contract(Crowdsale, (accounts) => {
  let neumark;
  let neumarkController;
  let etherToken;
  let lockedAccount;
  let curve;
  let crowdsale;

  beforeEach(async () => {
    console.log('deploying contracts');
    let neumarkFactory = await NeumarkFactory.new();
    neumark = await Neumark.new(neumarkFactory.address);
    neumarkController = await NeumarkController.new(neumark.address);
    await neumark.changeController(neumarkController.address);
    console.log('ETR-T and LockedAccount deploying...');
    etherToken = await EtherToken.new();
    lockedAccount = await LockedAccount.new(
      etherToken.address,
      neumark.address,
      18 * months,
      Math.round(0.1 * FP_SCALE)
    );
    curve = await Curve.new(neumarkController.address);
    console.log('Deploying crowdsale');
    crowdsale = await Crowdsale.new(1501804800, 1502356520, ether(1), ether(2000),
      etherToken.address, neumarkController.address, lockedAccount.address, curve.address);
    // console.log(lockedAccount.setController);
    await lockedAccount.setController(crowdsale.address);
    console.log('Contracts deployed!');
  });


  it('should be able to read Commitment parameters', async () => {
    const instance = await Crowdsale.deployed();
    assert.equal(await instance.startDate.call(), 1501804800);
    assert.equal(await instance.ownedToken.call(), EtherToken.address);
    assert.equal(await instance.lockedAccount.call(), LockedAccount.address);
    assert.equal(await instance.curve.call(), Curve.address);
  });

  it('should complete Commitment with failed state', async () => {
    assert.equal(await lockedAccount.lockState.call(), 1, 'lock should be in AcceptingLocks');
    const timestamp = await lockedAccount.currentTime();
    assert.equal(await crowdsale.hasEnded.call(), false, 'commitment should run');
    console.log(`obtained timestamp ${timestamp}`);
    // make commitment finish due to end date
    await crowdsale._changeEndDate(timestamp - 1);
    assert.equal(await crowdsale.hasEnded.call(), true, 'commitment should end');
    assert.equal(await crowdsale.wasSuccessful.call(), false, 'commitment should fail');
    // now finalize
    await crowdsale.finalize();
    // check lock state
    assert.equal(await lockedAccount.lockState.call(), 3, 'lock should be in ReleaseAll');
  });

  it('should commit 1 ether', async () => {
    const investor = accounts[0];
    const ticket = 1 * 10**18;
    assert.equal(await crowdsale.hasEnded.call(), false, 'commitment should run');
    await crowdsale.commit({value: ticket, from: investor});
    assert.equal(await lockedAccount.totalLockedAmount(), ticket, 'lockedAccount balance must match ticket');
    assert.equal(await lockedAccount.totalInvestors(), 1);
    assert.equal(await etherToken.totalSupply(), ticket, 'ticket must be in etherToken');
    const lockBalance = await etherToken.balanceOf(lockedAccount.address);
    assert.equal(lockBalance, ticket, 'balance of lock contract must equal ticket');
    const investorBalance = await lockedAccount.balanceOf(investor);
    const neumarkBalance = await neumark.balanceOf.call(investor);
    console.log(neumarkBalance.valueOf());
    assert.equal(investorBalance[1].valueOf(), neumarkBalance.valueOf(), 'neumarks due in lock must equal neumarks in token contract');
  });
});
