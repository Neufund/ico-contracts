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
const TestLockedAccountController = artifacts.require(
  "TestLockedAccountController"
);

// this low gas price is forced by code coverage
const gasPrice = new web3.BigNumber(0x01);

contract(
  "TestLockedAccountMigrationTarget",
  ([_, admin, investor, investor2, otherMigrationSource]) => {
    let snapshot;
    let startTimestamp;
    let migrationTarget;
    let assetToken;
    let controller;

    async function deployMigrationTarget() {
      const target = await TestLockedAccountMigrationTarget.new(
        chain.accessControl.address,
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
      controller = await TestLockedAccountController.new(
        chain.lockedAccount.address
      );
      await chain.lockedAccount.setController(controller.address, {
        from: admin
      });
      // achtung! latestTimestamp() must be called after a block is mined, before that time is not accurrate
      startTimestamp = await latestTimestamp();
      assetToken = chain.etherToken;
      migrationTarget = await deployMigrationTarget();
      snapshot = await saveBlockchain();
    });

    beforeEach(async () => {
      await restoreBlockchain(snapshot);
      snapshot = await saveBlockchain();
    });

    // it -> check in invalid states in enableMigration

    async function depositForController(ticket, from) {
      await chain.etherToken.deposit({ from, value: ticket });
      await chain.etherToken.transfer(controller.address, ticket, { from });
    }

    function expectMigrationEnabledEvent(tx, target) {
      const event = eventValue(tx, "LogMigrationEnabled");
      expect(event).to.exist;
      expect(event.args.target).to.be.equal(target);
    }

    function expectInvestorMigratedEvent(
      tx,
      investorAddress,
      ticket,
      neumarks,
      unlockDate
    ) {
      const event = eventValue(tx, "LogInvestorMigrated");
      expect(event).to.exist;
      expect(event.args.investor).to.be.equal(investorAddress);
      expect(event.args.amount).to.be.bignumber.equal(ticket);
      expect(event.args.neumarks).to.be.bignumber.equal(neumarks);
      // check unlockDate optionally
      if (unlockDate) {
        expect(event.args.unlockDate).to.be.bignumber.equal(unlockDate);
      }
    }

    async function migrateOne(ticket, investorAddress) {
      const neumarks = ticket.mul(6.5);
      // lock investor
      await depositForController(ticket, investorAddress);
      await controller.investFor(investorAddress, ticket, neumarks, {
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
      expect(await migrationTarget.currentMigrationSource()).to.eq(
        chain.lockedAccount.address
      );
      let tx = await chain.lockedAccount.enableMigration(
        migrationTarget.address,
        { from: admin }
      );
      expectMigrationEnabledEvent(tx, migrationTarget.address);
      // migrate investor
      tx = await chain.lockedAccount.migrate({ from: investorAddress });
      expectInvestorMigratedEvent(
        tx,
        investorAddress,
        ticket,
        neumarks,
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

    it("call migrate not from source should throw", async () => {
      const ticket = 1; // 1 wei ticket
      // test migration accepts any address
      await migrationTarget.setMigrationSource(otherMigrationSource, {
        from: admin
      });
      // set allowance in asset token
      await assetToken.deposit({
        from: otherMigrationSource,
        value: ticket
      });
      await assetToken.approve(migrationTarget.address, 1, {
        from: otherMigrationSource
      });
      await migrationTarget.migrateInvestor(
        investor2,
        ticket,
        1,
        startTimestamp,
        {
          from: otherMigrationSource
        }
      );
      // set allowances again
      await assetToken.deposit({
        from: otherMigrationSource,
        value: ticket
      });
      await assetToken.approve(migrationTarget.address, ticket, {
        from: otherMigrationSource
      });
      // this should not, only otherMigrationSource can call migrate on target
      await expect(
        migrationTarget.migrateInvestor(investor, ticket, 1, startTimestamp, {
          from: admin
        })
      ).to.be.rejectedWith(EvmError);
    });

    it("target that returns false on migration should throw", async () => {
      const ticket = chain.ether(1);
      const neumarks = ticket.mul(6.5);
      // lock investor
      await depositForController(ticket, investor);
      await controller.investFor(investor, ticket, neumarks, {
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

    it("rejects target with source address not matching contract enabling migration", async () => {
      // we set invalid source here
      await migrationTarget.setMigrationSource(otherMigrationSource, {
        from: admin
      });
      // accepts only lockedAccount as source
      await expect(
        chain.lockedAccount.enableMigration(migrationTarget.address)
      ).to.be.rejectedWith(EvmError);
    });

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

    it("should reject investor migration before it is enabled", async () => {
      const ticket = chain.ether(3.18919182);
      const neumarks = chain.ether(1.189729111);
      await depositForController(ticket, investor);
      await controller.investFor(investor, ticket, neumarks, {
        from: investor
      });
      await migrationTarget.setMigrationSource(chain.lockedAccount.address, {
        from: admin
      });
      // uncomment below for this test to fail
      /* await chain.lockedAccount.enableMigration(
        migrationTarget.address,
        {from: admin}
      ); */
      await expect(
        chain.lockedAccount.migrate({ from: investor })
      ).to.be.rejectedWith(EvmError);
    });

    it("should migrate investor in AcceptUnlocks", async () => {
      const ticket = chain.ether(3.18919182);
      const neumarks = chain.ether(1.189729111);
      await depositForController(ticket, investor);
      await controller.investFor(investor, ticket, neumarks, {
        from: investor
      });
      await migrationTarget.setMigrationSource(chain.lockedAccount.address, {
        from: admin
      });
      await controller.succ();
      expect(await chain.lockedAccount.lockState.call()).to.be.bignumber.eq(2);
      await chain.lockedAccount.enableMigration(migrationTarget.address, {
        from: admin
      });
      const tx = await chain.lockedAccount.migrate({ from: investor });
      expectInvestorMigratedEvent(tx, investor, ticket, neumarks);
    });

    it("should reject enabling migration from invalid account", async () => {
      const ticket = chain.ether(3.18919182);
      const neumarks = chain.ether(1.189729111);
      await depositForController(ticket, investor);
      await controller.investFor(investor, ticket, neumarks, {
        from: investor
      });
      await migrationTarget.setMigrationSource(chain.lockedAccount.address, {
        from: admin
      });
      await expect(
        chain.lockedAccount.enableMigration(migrationTarget.address, {
          from: otherMigrationSource
        })
      ).to.be.rejectedWith(EvmError);
    });

    it("should reject enabling migration for a second time", async () => {
      await migrationTarget.setMigrationSource(chain.lockedAccount.address, {
        from: admin
      });
      await chain.lockedAccount.enableMigration(migrationTarget.address, {
        from: admin
      });
      // must throw
      await expect(
        chain.lockedAccount.enableMigration(migrationTarget.address, {
          from: admin
        })
      ).to.be.rejectedWith(EvmError);
    });
  }
);
