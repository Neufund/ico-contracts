import { expect } from "chai";
import { hasEvent, eventValue } from "./helpers/events";
import * as chain from "./helpers/spawnContracts";
import { latestTimestamp } from "./helpers/latestTime";
import EvmError from "./helpers/EVMThrow";
import roles from "./helpers/roles";
import {
  promisify,
  saveBlockchain,
  restoreBlockchain
} from "./helpers/evmCommands";

const TestLockedAccountMigrationTarget = artifacts.require(
  "TestLockedAccountMigrationTarget"
);

// this low gas price is forced by code coverage
const gasPrice = new web3.BigNumber(0x01);

contract(
  "TestLockedAccountMigrationTarget",
  ([_, admin, investor, investor2]) => {
    let snapshot;
    let startTimestamp;
    let migrationTarget;
    let assetToken;

    async function deployMigrationTarget() {
      const target = await TestLockedAccountMigrationTarget.new(
        chain.accessControl.address,
        chain.forkArbiter.address,
        "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT",
        assetToken.address,
        chain.neumark.address,
        18 * chain.months,
        chain.ether(1).mul(0.1).round()
      );
      await chain.accessControl.setUserRole(
        admin,
        roles.lockedAccountAdmin,
        target.address,
        1
      );

      return target;
    }

    before(async () => {
      await chain.spawnLockedAccount(admin, 18, 0.1);
      // achtung! latestTimestamp() must be called after a block is mined, before that time is not accurrate
      startTimestamp = await latestTimestamp();
      await chain.spawnPublicCommitment(
        admin,
        startTimestamp,
        chain.months,
        chain.ether(1),
        chain.ether(2000),
        chain.ether(1),
        300.1219871
      );
      assetToken = chain.etherToken;
      migrationTarget = await deployMigrationTarget();
      snapshot = await saveBlockchain();
    });

    beforeEach(async () => {
      await restoreBlockchain(snapshot);
      snapshot = await saveBlockchain();
    });

    // it -> check in invalid states in enableMigration

    it("call migrate not from source should throw", async () => {
      const ticket = 1; // 1 wei ticket
      // test migration accepts any address
      await migrationTarget.setMigrationSource(investor2, { from: admin });
      // set allowance in asset token
      await assetToken.deposit(investor2, ticket, {
        from: admin,
        value: ticket
      });
      await assetToken.approve(migrationTarget.address, 1, {
        from: investor2
      });
      await migrationTarget.migrateInvestor(
        investor,
        ticket,
        1,
        startTimestamp,
        {
          from: investor2
        }
      );
      // set allowances again
      await assetToken.deposit(investor, ticket, {
        from: admin,
        value: ticket
      });
      await assetToken.approve(migrationTarget.address, ticket, {
        from: investor
      });
      // this should not, only investor2 (which is source) can call migrate on target
      await expect(
        migrationTarget.migrateInvestor(investor, ticket, 1, startTimestamp, {
          from: investor
        })
      ).to.be.rejectedWith(EvmError);
    });

    it("target that returns false on migration should throw", async () => {
      const ticket = chain.ether(1);
      const neumarks = ticket.mul(6.5);
      // lock investor
      await chain.commitment.investFor(investor, ticket, neumarks, {
        value: ticket,
        from: investor
      });
      await migrationTarget.setMigrationSource(chain.lockedAccount.address, {
        from: admin
      });
      await chain.lockedAccount.enableMigration(migrationTarget.address, {
        from: admin
      });

      await migrationTarget.setShouldMigrationFail(true, { from: admin });
      await expect(
        chain.lockedAccount.migrate({ from: investor })
      ).to.be.rejectedWith(EvmError);
    });

    it("target with invalid source should throw", async () => {
      // we set invalid source here
      await migrationTarget.setMigrationSource(investor, { from: admin });
      // accepts only lockedAccount as source
      await expect(
        chain.lockedAccount.enableMigration(migrationTarget.address)
      ).to.be.rejectedWith(EvmError);
    });

    async function migrateOne(ticket, investorAddress) {
      const neumarks = ticket.mul(6.5);
      // lock investor
      await chain.commitment.investFor(investorAddress, ticket, neumarks, {
        value: ticket,
        from: investorAddress
      });
      const investorBalanceBefore = await chain.lockedAccount.balanceOf(
        investorAddress
      );
      const assetBalanceSourceBefore = await assetToken.balanceOf(
        chain.lockedAccount.address
      );
      await migrationTarget.setMigrationSource(chain.lockedAccount.address, {
        from: admin
      });
      assert.equal(
        await migrationTarget.getMigrationFrom(),
        chain.lockedAccount.address,
        "correct migration source set"
      );
      let tx = await chain.lockedAccount.enableMigration(
        migrationTarget.address,
        { from: admin }
      );
      let event = eventValue(tx, "LogMigrationEnabled");
      expect(event).to.exist;
      expect(event.args.target).to.be.equal(migrationTarget.address);
      // migrate investor
      tx = await chain.lockedAccount.migrate({ from: investorAddress });
      event = eventValue(tx, "LogInvestorMigrated");
      expect(event).to.exist;
      expect(event.args.investor).to.be.equal(investorAddress);
      expect(event.args.amount).to.be.bignumber.equal(ticket);
      expect(event.args.neumarks).to.be.bignumber.equal(neumarks);
      expect(event.args.unlockDate).to.be.bignumber.equal(
        investorBalanceBefore[2]
      );
      // check invariants
      expect(
        await chain.lockedAccount.totalLockedAmount()
      ).to.be.bignumber.equal(0);
      expect(await migrationTarget.totalLockedAmount()).to.be.bignumber.equal(
        ticket
      );
      expect(await chain.lockedAccount.totalInvestors()).to.be.bignumber.equal(
        0
      );
      expect(await migrationTarget.totalInvestors()).to.be.bignumber.equal(1);
      // check balance on old - no investor
      const investorBalanceAfter = await chain.lockedAccount.balanceOf(
        investorAddress
      );
      // unlockDate == 0: does not exit
      expect(
        investorBalanceAfter[2],
        "unlockDate zeroed == no account"
      ).to.be.bignumber.equal(0);
      // check asset balance
      const assetBalanceSourceAfter = await assetToken.balanceOf(
        chain.lockedAccount.address
      );
      const assetBalanceTargetAfter = await assetToken.balanceOf(
        migrationTarget.address
      );
      expect(assetBalanceSourceAfter).to.be.bignumber.eq(
        assetBalanceSourceBefore.sub(ticket)
      );
      expect(assetBalanceTargetAfter).to.be.bignumber.eq(ticket);
    }

    async function enableReleaseAll() {
      await migrationTarget.setController(admin, { from: admin });
      await migrationTarget.controllerFailed({ from: admin });
    }

    async function withdrawAsset(investorAddress, amount) {
      const initalBalance = await promisify(web3.eth.getBalance)(
        investorAddress
      );
      const tx = await assetToken.withdraw(amount, {
        from: investorAddress,
        gasPrice
      });
      const afterBalance = await promisify(web3.eth.getBalance)(
        investorAddress
      );
      const gasCost = gasPrice.mul(tx.receipt.gasUsed);
      expect(afterBalance).to.be.bignumber.eq(
        initalBalance.add(amount).sub(gasCost)
      );
    }

    it("should migrate investor", async () => {
      await migrateOne(chain.ether(1), investor);
    });

    it("should migrate investor then unlock and withdraw", async () => {
      const ticket = chain.ether(1);
      await migrateOne(ticket, investor);
      await enableReleaseAll();
      // no need to burn neumarks
      await migrationTarget.unlock({ from: investor });
      await withdrawAsset(investor, ticket);
    });

    it("migrate same investor twice should do nothing", async () => {
      await migrateOne(chain.ether(1), investor);
      const tx = await chain.lockedAccount.migrate({ from: investor });
      expect(hasEvent(tx, "LogInvestorMigrated")).to.be.false;
    });

    it("migrate non existing investor should do nothing", async () => {
      await migrateOne(chain.ether(1), investor);
      const tx = await chain.lockedAccount.migrate({ from: investor2 });
      expect(hasEvent(tx, "LogInvestorMigrated")).to.be.false;
    });

    it("enabling migration for a second time should throw", async () => {
      await migrationTarget.setMigrationSource(chain.lockedAccount.address, {
        from: admin
      });
      await chain.lockedAccount.enableMigration(migrationTarget.address, {
        from: admin
      });
      // must throw
      await expect(
        chain.lockedAccount.enableMigration(migrationTarget.address)
      ).to.be.rejectedWith(EvmError);
    });
  }
);
