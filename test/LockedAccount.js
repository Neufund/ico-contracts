import moment from 'moment'
import gasCost from './helpers/gasCost';
import error from './helpers/error'
import eventValue from './helpers/eventValue'
import * as chain from './helpers/spawnContracts'
import increaseTime, {setTimeTo} from './helpers/increaseTime'
import latestTime, {latestTimestamp} from './helpers/latestTime'

const BigNumber = web3.BigNumber
const expect = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .expect;

const LockedAccount = artifacts.require('LockedAccount');

contract('LockedAccount', (accounts) => {
  let startTimestamp;

  beforeEach(async () => {
    await chain.spawnLockedAccount(18, 0.1);
    // achtung! latestTimestamp() must be called after a block is mined, before that time is not accurrate
    startTimestamp = latestTimestamp();
    await chain.spawnPublicCommitment(startTimestamp, chain.months, chain.ether(1), chain.ether(2000), chain.ether(1), 300.1219871);
  });

  it('should be able to read lock parameters', async () => {
    assert.equal(await chain.lockedAccount.totalLockedAmount.call(), 0);
    assert.equal(await chain.lockedAccount.totalInvestors.call(), 0);
    assert.equal(await chain.lockedAccount.ownedToken.call(), chain.etherToken.address);
  });

  it('should lock 1 ether', async () => {
    // new investor
    const investor = accounts[1];
    const ticket = chain.ether(1);
    // issue real neumarks - we may burn same amount
    let tx = await chain.curve.issue(ticket, {from: investor});
    const neumarks = eventValue(tx, 'NeumarksIssued', 'neumarks');
    expect(await chain.neumark.balanceOf(investor), 'neumarks must be allocated').to.be.bignumber.equal(neumarks);
    // only controller can lock
    await chain.commitment._investFor(investor, ticket, neumarks, { value: ticket, from: investor });
    const timebase = latestTimestamp(); // timestamp of block _investFor was mined
    // assert.equal(error(tx), 0, "Expected OK rc from lock()");
    const investorBalance = await chain.lockedAccount.balanceOf(investor);
    expect(investorBalance[0], 'investor balance should equal locked eth').to.be.bignumber.equal(ticket);
    expect(investorBalance[1], 'investor neumarks due should equal neumarks').to.be.bignumber.equal(neumarks);
    assert.equal(await chain.lockedAccount.totalInvestors(), 1, 'should have 1 investor');
    // verify longstop date independently
    assert.equal(investorBalance[2], timebase + 18 * 30 * chain.days, '18 months in future');
    // lock someone else
    const investor2 = accounts[2];
    await chain.commitment._investFor(investor2, ticket / 2, ticket / 4, { value: ticket / 2, from: investor2 });
    expect(await chain.lockedAccount.totalLockedAmount(), "lock should own locked amount").to.be.bignumber.equal(1.5 * ticket);
    expect(await chain.etherToken.totalSupply(), "lock should own locked amount").to.be.bignumber.equal(1.5 * ticket);
    assert.equal(await chain.lockedAccount.totalInvestors(), 2, 'should have 2 investors');
  });

  it('should unlock', async () => {
    // new investor
    const investor = accounts[1];
    const ticket = chain.ether(1);
    // issue real neumarks - we may burn same amount
    let tx = await chain.curve.issue(ticket, {from: investor});
    const neumarks = eventValue(tx, 'NeumarksIssued', 'neumarks');
    expect(await chain.neumark.balanceOf(investor), 'neumarks must be allocated').to.be.bignumber.equal(neumarks);
    // only controller can lock
    await chain.commitment._investFor(investor, ticket, neumarks, { value: ticket, from: accounts[0] });
    // assert.equal(error(tx), 0, "Expected OK rc from lock()");
    // move time forward within longstop date
    await increaseTime(moment.duration(chain.days, 's'));
    // controller says yes
    await chain.commitment._succ();
    // must enable token transfers
    await chain.neumarkController.enableTransfers(true);
    // investor approves transfer to lock contract to burn neumarks
    //console.log(`investor has ${parseInt(await chain.neumark.balanceOf(investor))}`);
    tx = await chain.neumark.approve(chain.lockedAccount.address, neumarks, {from: investor});
    expect(eventValue(tx, 'Approval', '_amount')).to.be.bignumber.equal(neumarks);
    // only investor can unlock and must burn tokens
    tx = await chain.lockedAccount.unlock({from: investor});
    assert.equal(error(tx), 0, "Expected OK rc from unlock()");
    // console.log(`unlocked ${eventValue(tx, 'FundsUnlocked', 'amount')} ether`);
    expect(await chain.lockedAccount.totalLockedAmount(), 'all money sent to pool and to investor').to.be.bignumber.equal(0);
    expect(await chain.etherToken.totalSupply(), 'ownedToken should still hold full ticket').to.be.bignumber.equal(ticket);
    // returns tuple as array
    const investorBalance = await chain.lockedAccount.balanceOf(investor);
    assert.equal(investorBalance[2], 0, 'investor account deleted'); // checked by timestamp == 0
    assert.equal(await chain.lockedAccount.totalInvestors(), 0, 'should have no investors');
    expect((await chain.etherToken.balanceOf(investor)).plus(await chain.etherToken.balanceOf(chain.feePool.address)), "investor + penalty == 1 ether").to.be.bignumber.equal(ticket);
    // check penalty value
    const penalty = ticket.mul(await chain.lockedAccount.penaltyFraction()).div(chain.ether(1));
    expect(await chain.etherToken.balanceOf(chain.feePool.address), 'fee pool has correct penalty value').to.be.bignumber.equal(penalty);
    // 0 neumarks at the end
    expect(await chain.neumark.balanceOf(investor), 'all investor neumarks burned').to.be.bignumber.equal(0);
  });

  // it -> investor locks twice
  // it -> unlock after long stop
  // it -> unlock in release all
  // it -> unlock throws in prohibited states ()
  // it -> receiveApproval test
});
