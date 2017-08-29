import { expect } from "chai";
import moment from "moment";
import error from "./helpers/error";
import { eventValue } from "./helpers/events";
import * as chain from "./helpers/spawnContracts";
import increaseTime, { setTimeTo } from "./helpers/increaseTime";
import latestTime, { latestTimestamp } from "./helpers/latestTime";
import EvmError from "./helpers/EVMThrow";

const TestFeeDistributionPool = artifacts.require("TestFeeDistributionPool");

contract("LockedAccount", ([admin, investor, investor2]) => {
  let startTimestamp;

  beforeEach(async () => {
    await chain.spawnLockedAccount(admin, 18, 0.1);
    // achtung! latestTimestamp() must be called after a block is mined, before that time is not accurrate
    startTimestamp = latestTimestamp();
    await chain.spawnPublicCommitment(
      admin,
      startTimestamp,
      chain.months,
      chain.ether(1),
      chain.ether(2000),
      chain.ether(1),
      300.1219871
    );
  });

  it("should be able to read lock parameters", async () => {
    assert.equal(await chain.lockedAccount.totalLockedAmount.call(), 0);
    assert.equal(await chain.lockedAccount.totalInvestors.call(), 0);
    assert.equal(
      await chain.lockedAccount.assetToken.call(),
      chain.etherToken.address
    );
  });

  async function expectLockEvent(tx, investor, ticket, neumarks) {
    const event = eventValue(tx, "FundsLocked");
    expect(event).to.exist;
    expect(event.args.investor).to.be.bignumber.equal(investor);
    expect(event.args.amount).to.be.bignumber.equal(ticket);
    expect(event.args.neumarks).to.be.bignumber.equal(neumarks);
  }

  async function lockEther(investor, ticket) {
    // initial state of the lock
    const initialLockedAmount = await chain.lockedAccount.totalLockedAmount();
    const initialAssetSupply = await chain.etherToken.totalSupply();
    const initialNumberOfInvestors = await chain.lockedAccount.totalInvestors();
    const initialNeumarksBalance = await chain.neumark.balanceOf(investor);
    const initialLockedBalance = await chain.lockedAccount.balanceOf(investor);
    // issue real neumarks and check against
    let tx = await chain.neumark.issueForEuro(ticket, { from: investor });
    const neumarks = eventValue(tx, "NeumarksIssued", "neumarkUlp");
    expect(
      await chain.neumark.balanceOf(investor),
      "neumarks must be allocated"
    ).to.be.bignumber.equal(neumarks.add(initialNeumarksBalance));
    // only controller can lock
    tx = await chain.commitment._investFor(investor, ticket, neumarks, {
      value: ticket,
      from: investor
    });
    await expectLockEvent(tx, investor, ticket, neumarks);
    const timebase = latestTimestamp(); // timestamp of block _investFor was mined
    const investorBalance = await chain.lockedAccount.balanceOf(investor);
    expect(
      investorBalance[0],
      "investor balance should equal locked eth"
    ).to.be.bignumber.equal(ticket.add(initialLockedBalance[0]));
    expect(
      investorBalance[1],
      "investor neumarks due should equal neumarks"
    ).to.be.bignumber.equal(neumarks.add(initialLockedBalance[1]));
    // verify longstop date independently, value is convertable to int so do it
    let unlockDate = timebase + 18 * 30 * chain.days;
    if (parseInt(initialLockedBalance[2]) > 0) {
      // earliest date is preserved for repeated investor address
      unlockDate = parseInt(initialLockedBalance[2]);
    }
    expect(parseInt(investorBalance[2]), "18 months in future").to.equal(
      unlockDate
    );
    expect(
      await chain.lockedAccount.totalLockedAmount(),
      "lock should own locked amount"
    ).to.be.bignumber.equal(initialLockedAmount.add(ticket));
    expect(
      await chain.etherToken.totalSupply(),
      "lock should own locked amount"
    ).to.be.bignumber.equal(initialAssetSupply.add(ticket));
    const newInvestors = parseInt(initialLockedBalance[2]) > 0 ? 0 : 1;
    expect(
      await chain.lockedAccount.totalInvestors(),
      "total number of investors"
    ).to.be.bignumber.equal(initialNumberOfInvestors.add(newInvestors));

    return neumarks;
  }

  it("should lock 1 ether", async () => {
    await lockEther(investor, chain.ether(1));
  });

  it("should lock ether two different investors", async () => {
    await lockEther(investor, chain.ether(1));
    await lockEther(investor2, chain.ether(0.5));
  });

  it("should lock ether same investor", async () => {
    await lockEther(investor, chain.ether(1));
    await lockEther(investor, chain.ether(0.5));
  });

  async function unlockEtherWithApprove(investor, ticket, neumarkToBurn) {
    // investor approves transfer to lock contract to burn neumarks
    // console.log(`investor has ${parseInt(await chain.neumark.balanceOf(investor))}`);
    let tx = await chain.neumark.approve(
      chain.lockedAccount.address,
      neumarkToBurn,
      {
        from: investor
      }
    );
    expect(eventValue(tx, "Approval", "amount")).to.be.bignumber.equal(
      neumarkToBurn
    );
    // only investor can unlock and must burn tokens
    tx = await chain.lockedAccount.unlock({ from: investor });

    return tx;
  }

  async function unlockEtherWithCallback(investor, ticket, neumarkToBurn) {
    // investor approves transfer to lock contract to burn neumarks
    // console.log(`investor has ${await chain.neumark.balanceOf(investor)} against ${neumarkToBurn}`);
    // console.log(`${chain.lockedAccount.address} should spend`);
    // await chain.lockedAccount.receiveApproval(investor, neumarkToBurn, chain.neumark.address, "");
    const tx = await chain.neumark.approveAndCall(
      chain.lockedAccount.address,
      neumarkToBurn,
      "",
      {
        from: investor
      }
    );
    expect(eventValue(tx, "Approval", "amount")).to.be.bignumber.equal(
      neumarkToBurn
    );

    return tx;
  }

  async function unlockEtherWithCallbackUnknownToken(
    investor,
    ticket,
    neumarkToBurn
  ) {
    // ether token is not allowed to call unlock on LockedAccount
    await expect(
      chain.etherToken.approveAndCall(
        chain.lockedAccount.address,
        neumarkToBurn,
        "",
        {
          from: investor
        }
      )
    ).to.be.rejectedWith(EvmError);
  }

  async function expectPenaltyEvent(tx, investor, ticket) {
    const penalty = ticket
      .mul(await chain.lockedAccount.penaltyFraction())
      .div(chain.ether(1));
    const disbursalPool = await chain.lockedAccount.penaltyDisbursalAddress();
    const event = eventValue(tx, "PenaltyDisbursed");
    expect(event).to.exist;
    expect(event.args.investor).to.be.bignumber.equal(investor);
    expect(event.args.amount).to.be.bignumber.equal(penalty);
    expect(event.args.toPool).to.be.bignumber.equal(disbursalPool);
  }

  async function expectLastTransferEvent(tx, from, to, val) {
    const event = eventValue(tx, "Transfer");
    // console.log(event);
    expect(event).to.exist;
    expect(event.args.from).to.equal(from);
    expect(event.args.to).to.equal(to);
    expect(event.args.amount).to.be.bignumber.equal(val);
  }

  async function expectUnlockEvent(tx, investor, ticket, withPenalty) {
    if (withPenalty) {
      const penalty = ticket
        .mul(await chain.lockedAccount.penaltyFraction())
        .div(chain.ether(1));
      ticket = ticket.sub(penalty);
    }
    const event = eventValue(tx, "FundsUnlocked");
    expect(event).to.exist;
    expect(event.args.investor).to.be.bignumber.equal(investor);
    expect(event.args.amount).to.be.bignumber.equal(ticket);
  }

  async function assertCorrectUnlock(tx, investor, ticket) {
    const disbursalPool = await chain.lockedAccount.penaltyDisbursalAddress();
    assert.equal(error(tx), 0, "Expected OK rc from unlock()");
    const penalty = ticket
      .mul(await chain.lockedAccount.penaltyFraction())
      .div(chain.ether(1));
    // console.log(`unlocked ${eventValue(tx, 'FundsUnlocked', 'amount')} ether`);
    expect(
      await chain.lockedAccount.totalLockedAmount(),
      "all money sent to pool and to investor"
    ).to.be.bignumber.equal(0);
    expect(
      await chain.etherToken.totalSupply(),
      "assetToken should still hold full ticket"
    ).to.be.bignumber.equal(ticket);
    // returns tuple as array
    const investorBalance = await chain.lockedAccount.balanceOf(investor);
    assert.equal(investorBalance[2], 0, "investor account deleted"); // checked by timestamp == 0
    assert.equal(
      await chain.lockedAccount.totalInvestors(),
      0,
      "should have no investors"
    );
    expect(
      (await chain.etherToken.balanceOf(investor)).plus(
        await chain.etherToken.balanceOf(disbursalPool)
      ),
      "investor + penalty == 1 ether"
    ).to.be.bignumber.equal(ticket);
    // check penalty value
    expect(
      await chain.etherToken.balanceOf(disbursalPool),
      "fee pool has correct penalty value"
    ).to.be.bignumber.equal(penalty);
    // 0 neumarks at the end
    expect(
      await chain.neumark.balanceOf(investor),
      "all investor neumarks burned"
    ).to.be.bignumber.equal(0);
  }

  async function enableUnlocks() {
    // move time forward within longstop date
    await increaseTime(moment.duration(chain.days, "s"));
    // controller says yes
    await chain.commitment._succ();
    // must enable token transfers
    await chain.neumark.enableTransfer(true);
  }

  it("should unlock with approval on contract disbursal", async () => {
    const ticket = chain.ether(1);
    const neumarks = await lockEther(investor, ticket);
    await enableUnlocks();
    const testDisbursal = await TestFeeDistributionPool.new();
    // change disbursal pool
    await chain.lockedAccount.setPenaltyDisbursal(testDisbursal.address);
    const unlockTx = await unlockEtherWithApprove(investor, ticket, neumarks);
    // check if disbursal pool logged transfer
    await assertCorrectUnlock(unlockTx, investor, ticket);
    await expectPenaltyEvent(unlockTx, investor, ticket);
    await expectUnlockEvent(unlockTx, investor, ticket, true);
  });

  it("should unlock with approval on simple address disbursal", async () => {
    const ticket = chain.ether(1);
    const neumarks = await lockEther(investor, ticket);
    await enableUnlocks();
    const unlockTx = await unlockEtherWithApprove(investor, ticket, neumarks);
    await assertCorrectUnlock(unlockTx, investor, ticket);
    await expectPenaltyEvent(unlockTx, investor, ticket);
    await expectUnlockEvent(unlockTx, investor, ticket, true);
  });

  it("should unlock with approveAndCall on simple address disbursal", async () => {
    const ticket = chain.ether(1);
    const neumarks = await lockEther(investor, ticket);
    await enableUnlocks();
    const unlockTx = await unlockEtherWithCallback(investor, ticket, neumarks);
    await assertCorrectUnlock(unlockTx, investor, ticket);
    // truffle will not return events that are not in ABI of called contract so line below uncommented
    // await expectPenaltyEvent(unlockTx, investor, penalty, disbursalPool);
    // instead look for transfer event of a pool
    const disbursalPool = await chain.lockedAccount.penaltyDisbursalAddress();
    const penalty = ticket
      .mul(await chain.lockedAccount.penaltyFraction())
      .div(chain.ether(1));
    // todo: find correct transfer event, not last
    // await expectLastTransferEvent(unlockTx, chain.lockedAccount.address, disbursalPool, penalty);
  });

  it("should throw on approveAndCall with unknown token", async () => {
    const ticket = chain.ether(1);
    const neumarks = await lockEther(investor, ticket);
    await enableUnlocks();
    await unlockEtherWithCallbackUnknownToken(investor, ticket, neumarks);
  });

  // it -> unlock after long stop
  // it -> unlock in release all
  // it -> unlock throws in prohibited states ()
  // it -> change fee disbursal
  // it -> fee disbursal to address
  // it -> fee disbursal to contract
  // it -> fee disbursal to contract that has no callback function
  // it -> tries to burn not enough neumarks with unlock and receiveApproval
  // it -> ACL control for methods: enableMigration, setController, setPenaltyDisbursal
});
