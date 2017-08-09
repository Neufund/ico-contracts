import advanceToBlock from './helpers/advanceToBlock';
import EVMThrow from './helpers/EVMThrow';
import * as chain from './helpers/spawnContracts'

const Crowdsale = artifacts.require('Crowdsale');

const should = require('chai')
  .use(require('chai-as-promised'))
  .should();

contract(Crowdsale, (accounts) => {
  let startTimestamp = Math.floor(new Date() / 1000 - chain.days);

  beforeEach(async () => {
    await chain.spawnLockedAccount(18, 0.1);
    // apply time limit to ICO
    await chain.spawnCrowdsale(startTimestamp, chain.months, chain.ether(1), chain.ether(2000))
  });


  it('should be able to read Commitment parameters', async () => {
    assert.equal(await chain.crowdsale.startDate.call(), startTimestamp);
    assert.equal(await chain.crowdsale.ownedToken.call(), chain.etherToken.address);
    assert.equal(await chain.crowdsale.lockedAccount.call(), chain.lockedAccount.address);
    assert.equal(await chain.crowdsale.curve.call(), chain.curve.address);
  });

  it('should complete Commitment with failed state', async () => {
    assert.equal(await chain.lockedAccount.lockState.call(), 1, 'lock should be in AcceptingLocks');
    const timestamp = await chain.lockedAccount.currentTime();
    assert.equal(await chain.crowdsale.hasEnded.call(), false, 'commitment should run');
    console.log(`obtained timestamp ${timestamp}`);
    // make commitment finish due to end date
    await chain.crowdsale._changeEndDate(timestamp - 1);
    assert.equal(await chain.crowdsale.hasEnded.call(), true, 'commitment should end');
    assert.equal(await chain.crowdsale.wasSuccessful.call(), false, 'commitment should fail');
    // now finalize
    await chain.crowdsale.finalize();
    // check lock state
    assert.equal(await chain.lockedAccount.lockState.call(), 3, 'lock should be in ReleaseAll');
  });

  it('should commit 1 ether', async () => {
    const investor = accounts[1];
    const ticket = 1 * 10 ** 18;
    assert.equal(await chain.crowdsale.hasEnded.call(), false, 'commitment should run');
    await chain.crowdsale.commit({ value: ticket, from: investor });
    assert.equal(await chain.lockedAccount.totalLockedAmount(), ticket, 'lockedAccount balance must match ticket');
    assert.equal(await chain.lockedAccount.totalInvestors(), 1);
    assert.equal(await chain.etherToken.totalSupply(), ticket, 'ticket must be in etherToken');
    const lockBalance = await chain.etherToken.balanceOf(chain.lockedAccount.address);
    assert.equal(lockBalance, ticket, 'balance of lock contract must equal ticket');
    const investorBalance = await chain.lockedAccount.balanceOf(investor);
    const neumarkBalance = await chain.neumark.balanceOf.call(investor);
    assert.equal(investorBalance[1].valueOf(), neumarkBalance.valueOf(), 'neumarks due in lock must equal neumarks in token contract');
  });

  it('commitment should succeed due to cap reached', async () => {
    const investor = accounts[1];
    const ticket = 1 * 10 ** 18;
    assert.equal(await chain.crowdsale.hasEnded.call(), false, 'commitment should run');
    await chain.crowdsale.commit({ value: ticket, from: investor });
    // decrease max cap
    await chain.crowdsale._changeMaxCap(ticket / 2);
    assert.equal(await chain.crowdsale.hasEnded.call(), true, 'commitment should end');
    assert.equal(await chain.crowdsale.wasSuccessful.call(), true, 'commitment should succeed');
    // now finalize
    await chain.crowdsale.finalize();
    // check lock state
    assert.equal(await chain.lockedAccount.lockState.call(), 2, 'lock should be in AcceptingUnlocks');
  });
});
