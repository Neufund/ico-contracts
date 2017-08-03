import ether from './helpers/ether';
import advanceToBlock from './helpers/advanceToBlock';
import EVMThrow from './helpers/EVMThrow';

const Crowdsale = artifacts.require('Crowdsale');
const LockedAccount = artifacts.require('LockedAccount');
const EtherToken = artifacts.require('EtherToken');
const NeumarkController = artifacts.require('NeumarkController');
const Curve = artifacts.require('Curve');

const Ether = Wie => (Wie * 1000000000000000000);

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const money = new ether(1);

contract(Crowdsale, () => {
  it('should be able to read Commitment parameters', async () => {
    const instance = await Crowdsale.deployed();
    assert.equal(await instance.startDate.call(), 1501804800);
    assert.equal(await instance.ownedToken.call(), EtherToken.address);
    assert.equal(await instance.lockedAccount.call(), LockedAccount.address);
    assert.equal(await instance.curve.call(), Curve.address);
  });

  it('should complete Commitment with failed state', async () => {
    const instance = await Crowdsale.deployed();
    const lock = await LockedAccount.deployed();
    assert.equal(await lock.lockState.call(), 1, 'lock should be in AcceptingLocks');
    const timestamp = await instance.currentTime();
    assert.equal(await instance.hasEnded.call(), false, 'commitment should run');
    console.log(`obtained timestamp ${timestamp}`);
    // make commitment finish due to end date
    await instance._changeEndDate(timestamp - 1);
    assert.equal(await instance.hasEnded.call(), true, 'commitment should end');
    assert.equal(await instance.wasSuccessful.call(), false, 'commitment should fail');
    // now finalize
    await instance.finalize();
    // check lock state
    assert.equal(await lock.lockState.call(), 3, 'lock should be in ReleaseAll');
  });
});
