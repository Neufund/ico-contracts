import { expect } from "chai";
import moment from "moment";
import advanceToBlock from "./helpers/advanceToBlock";
import EVMThrow from "./helpers/EVMThrow";
import * as chain from "./helpers/spawnContracts";
import eventValue from "./helpers/eventValue";
import { increaseTime, setTimeTo } from "./helpers/increaseTime";
import { latestTime, latestTimestamp } from "./helpers/latestTime";

const WhitelistedCommitment = artifacts.require("WhitelistedCommitment");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

contract("WhitelistedCommitment", ([_, lockAdmin, whitelistAdmin, investor, investor2]) => {
  // commitment starts in one day
  let startTimestamp;

  beforeEach(async () => {
    await chain.spawnLockedAccount(lockAdmin, 18, 0.1);
    // achtung! latestTimestamp() must be called after a block is mined, before that time is not accurrate
    startTimestamp = latestTimestamp() + chain.days;
    await chain.spawnWhitelistedCommitment(
      lockAdmin,
      whitelistAdmin,
      startTimestamp,
      chain.months,
      chain.ether(1),
      chain.ether(2000),
      chain.ether(1),
      218.1192809
    );
  });

  function generateWhitelist(num, minTicket, maxTicket) {}

  it("should set whitelist", async () => {
    await chain.commitment.setWhitelist([investor]);
    assert.equal(await chain.commitment.whitelistedInvestors(0), investor);
    assert.equal(await chain.commitment.whitelisted(investor), 1);
    // not on list
    assert.equal(await chain.commitment.whitelisted(investor2), 0);
  });

  it("should set fixed list", async () => {
    const ticket = chain.ether(100000);
    const ticketEUR = await chain.commitment.convertToEUR(ticket);
    const nmkForTicket = await chain.curve.cumulative(ticketEUR);
    await chain.commitment.setFixed([investor], [ticket]);
    assert.equal(await chain.commitment.fixedCostInvestors(0), investor);
    expect(await chain.commitment.fixedCost(investor), "ticket allowed").to.be.bignumber.equal(
      ticket
    );
    expect(
      await chain.commitment.totalFixedCostAmount(),
      "all allowed must be ticket amount"
    ).to.be.bignumber.equal(ticket);
    expect(await chain.commitment.totalFixedCostNeumarks()).to.be.bignumber
      .equal(nmkForTicket)
      .equal(await chain.neumark.totalSupply());
    // also allowed on whitelist
    assert.equal(await chain.commitment.whitelisted(investor), 1);
    // not on list
    assert.equal(await chain.commitment.fixedCost(investor2), 0);
  });

  async function fixedCostCase(declared, ticket) {
    const ticketEUR = await chain.commitment.convertToEUR(ticket);
    // get neumarks from curve
    const nmkForTicket = await chain.curve.cumulative(ticketEUR);
    await chain.commitment.setFixed([investor], [declared]);
    await setTimeTo(startTimestamp);
    let tx = await chain.commitment.commit({ value: ticket, from: investor });
    const investorBalance = await chain.lockedAccount.balanceOf(investor);
    expect(
      investorBalance[1].valueOf(),
      "neumarks due in lock must equal balance in token contract"
    ).to.be.bignumber.equal(nmkForTicket.div(2).round(0, 4));
  }

  async function setupFixedCostCase(declared, ticket) {
    await chain.commitment.setFixed([investor], [declared]);
    await setTimeTo(startTimestamp);
  }

  //it -> commit fixed and verify numbers (alt cases: below ticket, ticket, above ticket, and all of those but with many commits)
  it("should commit below declared ticket on fixed cost", async () => {
    const declaredSize = chain.ether(5000.2909);
    const ticketSize = chain.ether(1.2);
    await setupFixedCostCase(declaredSize, ticketSize);

    let tx = await chain.commitment.commit({ value: ticketSize, from: investor });

    const ticketInEur = await chain.commitment.convertToEUR(declaredSize);
    const totalSecuredNeumarks = await chain.curve.curve(ticketInEur);
    const expected = totalSecuredNeumarks.mul(ticketSize).div(declaredSize).div(2).round(0, 4);
    const investorBalance = await chain.lockedAccount.balanceOf(investor);
    expect(
      investorBalance[1].valueOf(),
      "neumarks due in lock must equal balance in token contract"
    ).to.be.bignumber.equal(expected);
  });

  it("should commit declared ticket on fixed cost", async () => {
    await fixedCostCase(chain.ether(1.21981798), chain.ether(1.21981798));
  });

  it("should commit declared ticket + 100 wei on fixed cost", async () => {
    // this will execute whole ticket and then use curve to do whitelisting for 100 wei
    await fixedCostCase(chain.ether(1), chain.ether(1).add(100));
  });

  it("should commit above declared ticket on fixed cost", async () => {
    // this will execute whole ticket and then use curve to do whitelisting for 100 wei
    await fixedCostCase(chain.ether(1), chain.ether(1.5));
  });

  it("should commit 1 ether from whitelist", async () => {
    const ticket = chain.ether(1);
    await chain.commitment.setWhitelist([investor]);
    // move to commitment start date
    await setTimeTo(startTimestamp);
    let tx = await chain.commitment.commit({ value: ticket, from: investor });
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
    const lockBalance = await chain.etherToken.balanceOf(chain.lockedAccount.address);
    expect(lockBalance, "balance of lock contract must equal ticket").to.be.bignumber.equal(ticket);
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
});
// it -> check fix cost inv crossing ticket size by 1 wei
// it -> set fixed cost (parametrized test by number of investors)
// it -> set whitelist (parametrized test by number of investors)
// it -> set large whitelist (1000 addresses) and check gas
// it -> commit fixed and verify numbers (alt cases: below ticket, ticket, above ticket, and all of those but with many commits)
// it -> commit whitelisted and verify numbers (case 1: no fixed, case 2: with fixed)
// it -> commit whitelisted then fixed, verify numbers (alt case: vice versa - should not make any impact)
// it -> all neumarks rollbacked on commitment fail
// it -> remaining neumarks rollbacked on commitment success (not taken fixed tickets)

// separate test set for whitelisted -> public commitment
// it -> whitelisted ends ok -> public ends ok (check state of lock and neumark token)
