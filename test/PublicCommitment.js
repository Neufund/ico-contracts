import advanceToBlock from './helpers/advanceToBlock';
import EVMThrow from './helpers/EVMThrow';
import * as chain from './helpers/spawnContracts'
import eventValue from './helpers/eventValue'

const BigNumber = web3.BigNumber

const TestCommitment = artifacts.require('TestCommitment');

const expect = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .expect;

contract(TestCommitment, ([owner, investor, investor2]) => {
  let startTimestamp = Math.floor(new Date() / 1000 - chain.days);

  beforeEach(async () => {
    await chain.spawnLockedAccount(18, 0.1);
    // apply time limit to ICO
    await chain.spawnPublicCommitment(startTimestamp, chain.months, chain.ether(1), chain.ether(2000), chain.ether(1), 218.1192809)
  });

  it('first commit sets caps', async () => {
    assert.equal(await chain.lockedAccount.controller(), chain.commitment.address, 'must controll lockedAccount');
    expect(await chain.commitment.capsInitialized()).to.be.false;
    await chain.commitment.commit({ value: chain.ether(1), from: investor });
    // caps are set from min and max commitments
    expect(await chain.commitment.maxAbsCap(), 'max cap to max commitment').to.be.bignumber.equal(chain.ether(2000));
    expect(await chain.commitment.minAbsCap(), 'min cap to min commitment').to.be.bignumber.equal(chain.ether(1));
    expect(await chain.commitment.capsInitialized()).to.be.true;
  });

  it('should be able to read Commitment parameters', async () => {
    assert.equal(await chain.commitment.startDate.call(), startTimestamp);
    assert.equal(await chain.commitment.paymentToken.call(), chain.etherToken.address);
    assert.equal(await chain.commitment.lockedAccount.call(), chain.lockedAccount.address);
    assert.equal(await chain.commitment.curve.call(), chain.curve.address);
    assert.equal(await chain.commitment.minCommitment.call(), chain.ether(1));
    // caps must be zero before investment
    assert.equal(await chain.commitment.maxAbsCap.call(), 0);
  });

  it('should complete Commitment with failed state without any investors', async () => {
    assert.equal(await chain.lockedAccount.lockState.call(), 1, 'lock should be in AcceptingLocks');
    const timestamp = await chain.lockedAccount.currentTime();
    await chain.commitment._changeEndDate(timestamp + 1 * chain.days);
    assert.equal(await chain.commitment.hasEnded.call(), false, 'commitment should run');
    await chain.commitment.initializeCaps();
    // make commitment finish due to end date
    await chain.commitment.mockTime(timestamp + 1 * chain.days + 1 );
    assert.equal(await chain.commitment.hasEnded.call(), true, 'commitment should end');
    assert.equal(await chain.commitment.wasSuccessful.call(), false, 'commitment should fail');
    // now finalize
    await chain.commitment.finalize();
    assert.equal(await chain.commitment.isFinalized(), true, 'should be finalized');
    // check lock state
    assert.equal(await chain.lockedAccount.lockState.call(), 3, 'lock should be in ReleaseAll');
  });

  it('should commit 1 ether', async () => {
    const ticket = 1 * 10 ** 18;
    assert.equal(await chain.commitment.hasEnded.call(), false, 'commitment should run');
    let tx = await chain.commitment.commit({ value: ticket, from: investor });
    // check event
    const event = eventValue(tx, 'FundsInvested');
    expect(event).to.exist;
    expect(event.args.amount).to.be.bignumber.equal(ticket);
    // check balances
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
    const ticket = 2 * 10 ** 18;
    assert.equal(await chain.commitment.hasEnded.call(), false, 'commitment should run');
    await chain.commitment.commit({ value: ticket, from: investor });
    // decrease max cap
    await chain.commitment._changeMaxCap(ticket * 0.75);
    assert.equal(await chain.commitment.hasEnded.call(), true, 'commitment should end');
    assert.equal(await chain.commitment.wasSuccessful.call(), true, 'commitment should succeed - min cap reached');
    // now finalize
    await chain.commitment.finalize();
    // check lock state
    assert.equal(await chain.lockedAccount.lockState.call(), 2, 'lock should be in AcceptingUnlocks');
  });

  it('converts to EUR correctly and issues Neumark', async () => {
    // few cases of ETH->EUR->Neumark using PublicCommitment and independent check of values
  });

  // it -> check min ticket
  // it -> check fix cost inv crossing ticket size by 1 wei

  it('check ETH EUT Neumark rates in investment', async () => {
    // few cases of ETH->EUR->Neumark using PublicCommitment and independent check of values
  });

  it('fails to re-activate Commitment by escape hatch', async () => {
    // escape hatch is used after C is finalized
    // this will lower the cap so in theory if C was finished due to cap it may become active again!
  });

  it('cap revealing no-repeat and no-before', async () => {
  });
});
