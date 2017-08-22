import { expect } from "chai";
import moment from "moment";
import gasCost from "./helpers/gasCost";
import error from "./helpers/error";
import eventValue from "./helpers/eventValue";
import * as chain from "./helpers/spawnContracts";
import increaseTime, { setTimeTo } from "./helpers/increaseTime";
import latestTime, { latestTimestamp } from "./helpers/latestTime";
import EvmError from "./helpers/EVMThrow";

const TestLockedAccountMigrationTarget = artifacts.require("TestLockedAccountMigrationTarget");

contract("TestLockedAccountMigrationTarget", ([owner, investor, investor2]) => {
  let startTimestamp;
  let migrationTarget;

  beforeEach(async () => {
    await chain.spawnLockedAccount(18, 0.1);
    // achtung! latestTimestamp() must be called after a block is mined, before that time is not accurrate
    startTimestamp = latestTimestamp();
    await chain.spawnPublicCommitment(
      startTimestamp,
      chain.months,
      chain.ether(1),
      chain.ether(2000),
      chain.ether(1),
      300.1219871
    );
    migrationTarget = await TestLockedAccountMigrationTarget.new(
      chain.etherToken.address,
      chain.curve.address,
      18 * chain.months,
      chain.ether(1).mul(0.1).round()
    );
  });

  // it -> check in invalid states in enableMigration

  it("call migrate not from source should throw", async () => {
    // this dummy setting should pass
    console.log(investor);
    await migrationTarget.setMigrationSource(investor2);
    await migrationTarget.migrateInvestor(investor, 1, 1, startTimestamp, { from: investor2 });
    // this should not, only investor2 (which is source) can call migrate on target
    await expect(migrationTarget
      .migrateInvestor(investor, 1, 1, startTimestamp, { from: owner }))
      .to.be.rejectedWith(EvmError);
  });

  it("target that returns false on migration should throw", async () => {
    const ticket = chain.ether(1);
    const neumarks = ticket.mul(6.5);
    // lock investor
    await chain.commitment._investFor(investor, ticket, neumarks, {
      value: ticket,
      from: investor,
    });
    await migrationTarget.setMigrationSource(chain.lockedAccount.address);
    let tx = await chain.lockedAccount.enableMigration(migrationTarget.address);
    await migrationTarget.setShouldMigrationFail(true);
    tx = await expect(chain.lockedAccount.migrate({ from: investor }))
      .to.be.rejectedWith(EvmError);
  });

  it("target with invalid source should throw", async () => {
    // we set invalid source here
    await migrationTarget.setMigrationSource(investor);
    // accepts only lockedAccount as source
    await expect(chain.lockedAccount
      .enableMigration(migrationTarget.address))
      .to.be.rejectedWith(EvmError);
  });

  async function migrateOne() {
    const ticket = chain.ether(1);
    const neumarks = ticket.mul(6.5);
    // lock investor
    await chain.commitment._investFor(investor, ticket, neumarks, {
      value: ticket,
      from: investor,
    });
    let investorBalance = await chain.lockedAccount.balanceOf(investor);
    await migrationTarget.setMigrationSource(chain.lockedAccount.address);
    assert.equal(
      await migrationTarget.getMigrationFrom(),
      chain.lockedAccount.address,
      "correct migration source set"
    );
    let tx = await chain.lockedAccount.enableMigration(migrationTarget.address);
    let event = eventValue(tx, "MigrationEnabled");
    expect(event).to.exist;
    expect(event.args.target).to.be.equal(migrationTarget.address);
    // migrate investor
    tx = await chain.lockedAccount.migrate({ from: investor });
    event = eventValue(tx, "InvestorMigrated");
    expect(event).to.exist;
    expect(event.args.investor).to.be.equal(investor);
    expect(event.args.amount).to.be.bignumber.equal(ticket);
    expect(event.args.neumarks).to.be.bignumber.equal(neumarks);
    expect(event.args.unlockDate).to.be.bignumber.equal(investorBalance[2]);
    // check invariants
    expect(await chain.lockedAccount.totalLockedAmount()).to.be.bignumber.equal(0);
    expect(await migrationTarget.totalLockedAmount()).to.be.bignumber.equal(ticket);
    expect(await chain.lockedAccount.totalInvestors()).to.be.bignumber.equal(0);
    expect(await migrationTarget.totalInvestors()).to.be.bignumber.equal(1);
    // check balance on old - no investor
    investorBalance = await chain.lockedAccount.balanceOf(investor);
    // unlockDate == 0: does not exit
    expect(investorBalance[2], "unlockDate zeroed == no account").to.be.bignumber.equal(0);
  }

  it("should migrate investor", async () => {
    await migrateOne();
  });

  it("migrate same investor twice should do nothing", async () => {
    await migrateOne();
    let tx = await chain.lockedAccount.migrate({ from: investor });
    let event = eventValue(tx, "InvestorMigrated");
    expect(event).to.not.exist;
  });

  it("migrate non existing investor should do nothing", async () => {
    await migrateOne();
    let tx = await chain.lockedAccount.migrate({ from: investor2 });
    let event = eventValue(tx, "InvestorMigrated");
    expect(event).to.not.exist;
  });

  it("enabling migration for a second time should throw", async () => {
    await migrationTarget.setMigrationSource(chain.lockedAccount.address);
    await chain.lockedAccount.enableMigration(migrationTarget.address);
    // must throw
    await expect(chain.lockedAccount
      .enableMigration(migrationTarget.address))
      .to.be.rejectedWith(EvmError);
  });
});
