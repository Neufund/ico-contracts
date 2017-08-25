import { expect } from "chai";
import advanceToBlock from "./helpers/advanceToBlock";
import EVMThrow from "./helpers/EVMThrow";
import * as chain from "./helpers/spawnContracts";
import { eventValue } from "./helpers/events";
import { increaseTime, setTimeTo } from "./helpers/increaseTime";
import { latestTime, latestTimestamp } from "./helpers/latestTime";

const TestCommitment = artifacts.require("TestCommitment");

contract("PublicCommitment", ([lockAdmin, investor, investor2]) => {
  let startTimestamp;
  const commitmentDuration = chain.months;

  beforeEach(async () => {
    await chain.spawnLockedAccount(lockAdmin, 18, 0.1);
    // achtung! latestTimestamp() must be called after a block is mined, before that time is not accurrate
    startTimestamp = latestTimestamp() + chain.days;
    // apply time limit to ICO
    await chain.spawnPublicCommitment(
      lockAdmin,
      startTimestamp,
      commitmentDuration,
      chain.ether(1),
      chain.ether(2000),
      chain.ether(1),
      218.1192809
    );
  });

  it("first commit sets caps", async () => {
    await setTimeTo(startTimestamp); // start commitment
    assert.equal(
      await chain.lockedAccount.controller(),
      chain.commitment.address,
      "must controll lockedAccount"
    );
    expect(await chain.commitment.capsInitialized()).to.be.false;
    await chain.commitment.commit({ value: chain.ether(1), from: investor });
    // caps are set from min and max commitments
    expect(
      await chain.commitment.maxAbsCap(),
      "max cap to max commitment"
    ).to.be.bignumber.equal(chain.ether(2000));
    expect(
      await chain.commitment.minAbsCap(),
      "min cap to min commitment"
    ).to.be.bignumber.equal(chain.ether(1));
    expect(await chain.commitment.capsInitialized()).to.be.true;
  });

  it("should be able to read Commitment parameters", async () => {
    assert.equal(
      await chain.commitment.startDate.call(),
      startTimestamp,
      "startDate"
    );
    assert.equal(
      await chain.commitment.paymentToken.call(),
      chain.etherToken.address
    );
    assert.equal(
      await chain.commitment.lockedAccount.call(),
      chain.lockedAccount.address
    );
    assert.equal(await chain.commitment.curve.call(), chain.curve.address);
    expect(await chain.commitment.minCommitment()).to.be.bignumber.equal(
      chain.ether(1)
    );
    // caps must be zero before investment
    expect(await chain.commitment.maxAbsCap()).to.be.bignumber.equal(0);
  });

  it("commit before startDate", async () => {});

  it("commit after startDate", async () => {
    // few cases of ETH->EUR->Neumark using PublicCommitment and independent check of values
  });

  it("should complete Commitment with failed state without any investors", async () => {
    await setTimeTo(startTimestamp); // commitment starts
    assert.equal(
      await chain.lockedAccount.lockState.call(),
      1,
      "lock should be in AcceptingLocks"
    );
    await setTimeTo(startTimestamp + chain.days); // day forward
    assert.equal(
      await chain.commitment.hasEnded.call(),
      false,
      "commitment should run"
    );
    await chain.commitment.initializeCaps();
    // make commitment finish due to end date
    await setTimeTo(startTimestamp + commitmentDuration); // day forward
    assert.equal(
      await chain.commitment.hasEnded.call(),
      true,
      "commitment should end"
    );
    assert.equal(
      await chain.commitment.wasSuccessful.call(),
      false,
      "commitment should fail"
    );
    // now finalize
    await chain.commitment.finalize();
    assert.equal(
      await chain.commitment.isFinalized(),
      true,
      "should be finalized"
    );
    // check lock state
    assert.equal(
      await chain.lockedAccount.lockState.call(),
      3,
      "lock should be in ReleaseAll"
    );
  });

  it("should commit 1 ether", async () => {
    const ticket = 1 * 10 ** 18;
    expect(await chain.neumark.totalSupply()).to.be.bignumber.equal(0);
    await setTimeTo(startTimestamp); // commitment starts
    assert.equal(
      await chain.commitment.hasEnded.call(),
      false,
      "commitment should run"
    );
    const tx = await chain.commitment.commit({ value: ticket, from: investor });
    // check event
    const event = eventValue(tx, "FundsInvested");
    expect(event).to.exist;
    expect(event.args.amount).to.be.bignumber.equal(ticket);
    // check balances
    expect(
      await chain.lockedAccount.totalLockedAmount(),
      "lockedAccount balance must match ticket"
    ).to.be.bignumber.equal(ticket);
    assert.equal(await chain.lockedAccount.totalInvestors(), 1);
    expect(
      await await chain.etherToken.totalSupply(),
      "ticket must be in etherToken"
    ).to.be.bignumber.equal(ticket);
    const lockBalance = await chain.etherToken.balanceOf(
      chain.lockedAccount.address
    );
    expect(
      lockBalance,
      "balance of lock contract must equal ticket"
    ).to.be.bignumber.equal(ticket);
    const investorBalance = await chain.lockedAccount.balanceOf(investor);
    const neumarkBalance = await chain.neumark.balanceOf.call(investor);
    // console.log(`investor ${investorBalance[1].valueOf()} total nmk ${neumarkBalance.valueOf()}`)
    expect(
      investorBalance[1],
      "neumarks due in lock must equal balance in token contract"
    ).to.be.bignumber.equal(neumarkBalance.valueOf());
    // fifth force and investor's neumarks should be same (half half split)
    const operatorBalance = await chain.neumark.balanceOf(chain.operatorWallet);
    // console.log(`${chain.operatorWallet} has ${operatorBalance}`);
    const supply = await chain.neumark.totalSupply();
    expect(supply, "lock and operator have all neumarks").to.be.bignumber.equal(
      operatorBalance.plus(investorBalance[1])
    );
    // allow for 1 wei difference
    expect(
      operatorBalance.minus(investorBalance[1]).abs(),
      "half half split"
    ).to.be.bignumber.below(2);
  });

  it("commitment should succeed due to cap reached", async () => {
    const ticket = 2 * 10 ** 18;
    await setTimeTo(startTimestamp); // commitment starts
    assert.equal(
      await chain.commitment.hasEnded.call(),
      false,
      "commitment should run"
    );
    await chain.commitment.commit({ value: ticket, from: investor });
    // decrease max cap so it is exactly ticket
    await setTimeTo(startTimestamp + chain.days); // day forward
    await chain.commitment._changeMaxCap(ticket);
    assert.equal(
      await chain.commitment.hasEnded.call(),
      true,
      "commitment should end"
    );
    assert.equal(
      await chain.commitment.wasSuccessful.call(),
      true,
      "commitment should succeed - min cap reached"
    );
    // now finalize
    await chain.commitment.finalize();
    // check lock state
    assert.equal(
      await chain.lockedAccount.lockState.call(),
      2,
      "lock should be in AcceptingUnlocks"
    );
    // check if neumarks transferable
    assert.equal(
      await chain.neumark.transfersEnabled(),
      true,
      "neumark transfers should be enabled"
    );
  });

  it("converts to EUR correctly and issues Neumark", async () => {
    // few cases of ETH->EUR->Neumark using PublicCommitment and independent check of values
  });

  // it -> check min ticket

  it("check ETH EURT Neumark rates in investment", async () => {
    // few cases of ETH->EUR->Neumark using PublicCommitment and independent check of values
  });

  it("fails to re-activate Commitment by escape hatch", async () => {
    // escape hatch is used after Commitment is finalized
    // this will lower the amount so in theory if C was finished due to cap it may become active again!
    // checking finalize will prevent it
  });

  it("cap revealing no-repeat and no-before", async () => {
    // disregard this test case until situation with caps is clear
  });

  it("commitment should succeed due to endDate reached", async () => {
    //
  });

  // it -> first ticket commits max cap
  // it -> a really large ticket like ether(10000000)
  // it -> commit after max cap reached
  // it -> send ether to default func should fail
  // it -> implement all cases from zeppeling Crowdsale.js and CappedCrowdsale.js
});
