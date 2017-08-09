import gasCost from './helpers/gasCost';
import error from './helpers/error'
import eventValue from './helpers/eventValue'
import * as chain from './helpers/spawnContracts'

const LockedAccount = artifacts.require('LockedAccount');
const TestCommitmentContract = artifacts.require('TestCommitmentContract');

contract('LockedAccount', (accounts) => {
  let testCommitmentContract;

  beforeEach(async () => {
    await chain.spawnLockedAccount(18, 0.1);
    // spawn test contracts
    testCommitmentContract = await TestCommitmentContract.new(chain.lockedAccount.address, chain.etherToken.address);
    await chain.lockedAccount.setController(testCommitmentContract.address);
  });

  it('should be able to read lock parameters', async () => {
    assert.equal(await chain.lockedAccount.totalLockedAmount.call(), 0);
    assert.equal(await chain.lockedAccount.totalInvestors.call(), 0);
    assert.equal(await chain.lockedAccount.ownedToken.call(), chain.etherToken.address);
  });

  it('should lock 1 ether', async () => {
    // new investor
    const investor = accounts[1];
    // mock lock time to test it
    let timebase = web3.eth.blockNumber;
    const ticket = chain.ether(1);
    await chain.lockedAccount.mockTime(timebase);
    // issue real neumarks - we may burn same amount
    let tx = await chain.curve.issue(ticket, investor);
    const neumarks = parseInt(eventValue(tx, 'NeumarksIssued', 'neumarks'));
    assert.equal(parseInt(await chain.neumark.balanceOf(investor)), neumarks, 'neumarks must be allocated');
    // only controller can lock
    tx = await testCommitmentContract.investFor(investor, ticket, neumarks, { value: ticket, from: investor });
    assert.equal(error(tx), 0, "Expected OK rc from lock()");
    const investorBalance = await chain.lockedAccount.balanceOf(investor);
    assert.equal(parseInt(investorBalance[0]), ticket, 'investor balance should equal locked eth');
    assert.equal(parseInt(investorBalance[1]), neumarks, 'investor neumarks due should equal neumarks');
    assert.equal(await chain.lockedAccount.totalInvestors(), 1, 'should have 1 investor');
    // verify longstop date independently
    assert.equal(investorBalance[2], timebase + 18 * 30 * chain.days, 'more or less 18 months in future');
    // lock someone else
    const investor2 = accounts[2];
    tx = await testCommitmentContract.investFor(investor2, ticket / 2, ticket / 4, { value: ticket / 2, from: investor2 });
    assert.equal(await chain.lockedAccount.totalLockedAmount(), 1.5 * ticket, "lock should own locked amount");
    assert.equal(await chain.etherToken.totalSupply(), 1.5 * ticket, 'ownedToken should own locked amount');
    assert.equal(await chain.lockedAccount.totalInvestors(), 2, 'should have 2 investors');
  });

  it('should unlock', async () => {
    // new investor
    const investor = accounts[1];
    // mock lock time to test it
    let timebase = web3.eth.blockNumber;
    const ticket = chain.ether(1);
    await chain.lockedAccount.mockTime(timebase);
    // issue real neumarks - we may burn same amount
    let tx = await chain.curve.issue(ticket, investor);
    const neumarks = parseInt(eventValue(tx, 'NeumarksIssued', 'neumarks'));
    assert.equal(parseInt(await chain.neumark.balanceOf(investor)), neumarks, 'neumarks must be allocated');
    // only controller can lock
    tx = await testCommitmentContract.investFor(investor, ticket, neumarks, { value: ticket, from: accounts[0] });
    assert.equal(error(tx), 0, "Expected OK rc from lock()");
    // move time forward within longstop date
    await chain.lockedAccount.mockTime(timebase + chain.days);
    // controller says yes
    await testCommitmentContract.succ();
    // must enable token transfers
    await chain.neumarkController.enableTransfers(true);
    // investor approves transfer to curve contract
    //console.log(`investor has ${parseInt(await chain.neumark.balanceOf(investor))}`);
    await chain.neumark.approve(chain.curve.address, neumarks, {from: investor});
    // only investor can unlock and must burn tokens
    tx = await chain.lockedAccount.unlock({from: investor});
    assert.equal(error(tx), 0, "Expected OK rc from unlock()");
    // console.log(`unlocked ${eventValue(tx, 'FundsUnlocked', 'amount')} ether`);
    // check if ownedToken supply is 1 ether
    assert.equal(await chain.lockedAccount.totalLockedAmount(), 0, "all money sent to pool and to investor");
    assert.equal(await chain.etherToken.totalSupply(), ticket, 'ownedToken should still hold 1 ether');
    // returns tuple as array
    const investorBalance = await chain.lockedAccount.balanceOf(investor);
    assert.equal(investorBalance[2], 0, 'investor account deleted'); // checked by timestamp == 0
    assert.equal(await chain.lockedAccount.totalInvestors(), 0, 'should have no investors');
    assert.equal(parseInt(await chain.etherToken.balanceOf(investor)) + parseInt(await chain.etherToken.balanceOf(chain.feePool.address)),
      ticket, "investor + penalty == 1 ether");
    // check penalty value
    const penalty = (ticket * await chain.lockedAccount.PENALTY_PRC()) / await chain.lockedAccount.FP_SCALE();
    assert.equal(await chain.etherToken.balanceOf(chain.feePool.address), penalty, 'fee pool has correct penalty value');
    // 0 neumarks at the end
    assert.equal(parseInt(await chain.neumark.balanceOf(investor)), 0, 'all investor neumarks burned');
  });
});
