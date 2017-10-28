import { expect } from "chai";
import moment from "moment";
import { hasEvent, eventValue } from "./helpers/events";
import {
  deployControlContracts,
  deployNeumark,
  dayInSeconds,
  monthInSeconds
} from "./helpers/deployContracts";
import increaseTime, { setTimeTo } from "./helpers/increaseTime";
import { latestTimestamp } from "./helpers/latestTime";
import EvmError from "./helpers/EVMThrow";
import { TriState } from "./helpers/triState";
import { LockState } from "./helpers/lockState";
import forceEther from "./helpers/forceEther";
import { etherToWei } from "./helpers/unitConverter";
import roles from "./helpers/roles";
import { promisify } from "./helpers/evmCommands";

const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const EuroToken = artifacts.require("EuroToken");
const TestFeeDistributionPool = artifacts.require("TestFeeDistributionPool");
const TestNullContract = artifacts.require("TestNullContract");
const TestLockedAccountController = artifacts.require(
  "TestLockedAccountController"
);
const TestLockedAccountMigrationTarget = artifacts.require(
  "TestLockedAccountMigrationTarget"
);

const gasPrice = new web3.BigNumber(0x01); // this low gas price is forced by code coverage

contract(
  "LockedAccount",
  ([_, admin, investor, investor2, otherMigrationSource, operatorWallet]) => {
    let controller;
    let startTimestamp;
    let assetToken;
    let lockedAccount;
    let migrationTarget;
    let testDisbursal;
    let noCallbackContract;
    let neumark;
    let accessControl;
    let forkArbiter;

    beforeEach(async () => {
      [accessControl, forkArbiter] = await deployControlContracts();
      neumark = await deployNeumark(accessControl, forkArbiter);
    });

    describe("EtherToken", () => {
      async function deployEtherToken() {
        assetToken = await EtherToken.new(accessControl.address);
      }

      async function makeDepositEth(from, to, amount) {
        await assetToken.deposit({ from, value: amount });
        if (from !== to) {
          await assetToken.approve(to, amount, { from });
        }
      }

      async function makeWithdrawEth(investorAddress, amount) {
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

      beforeEach(async () => {
        await deployEtherToken();
        await deployLockedAccount(assetToken, 18, 0.1);
      });

      describe("core tests", () => {
        lockedAccountTestCases(makeDepositEth, makeWithdrawEth);
      });

      describe("migration tests", () => {
        beforeEach(async () => {
          migrationTarget = await deployMigrationTarget(assetToken);
        });

        locketAccountMigrationTestCases(makeDepositEth, makeWithdrawEth);
      });
    });

    describe("EuroToken", () => {
      async function applyTransferPermissions(permissions) {
        for (const p of permissions) {
          switch (p.side) {
            case "from":
              await assetToken.setAllowedTransferFrom(p.address, true, {
                from: admin
              });
              break;
            default:
              await assetToken.setAllowedTransferTo(p.address, true, {
                from: admin
              });
              break;
          }
        }
      }

      async function deployEuroToken() {
        assetToken = await EuroToken.new(accessControl.address);
        await accessControl.setUserRole(
          admin,
          roles.eurtDepositManager,
          assetToken.address,
          TriState.Allow
        );
      }

      async function makeDepositEuro(from, to, amount) {
        // 'admin' has all the money in the bank, 'from' receives transfer permission to receive funds
        await assetToken.deposit(from, amount, { from: admin });
        if (from !== to) {
          await assetToken.approve(to, amount, { from });
        }
      }

      async function makeWithdrawEuro(from, amount) {
        const initalBalance = await assetToken.balanceOf.call(from);
        // notifies bank to pay out EUR, burns EURT
        await assetToken.withdraw(amount, { from });
        const afterBalance = await assetToken.balanceOf.call(from);
        expect(afterBalance).to.be.bignumber.eq(initalBalance.sub(amount));
      }

      beforeEach(async () => {
        await deployEuroToken();
        await deployLockedAccount(assetToken, 18, 0.1);
        await applyTransferPermissions([
          { side: "from", address: lockedAccount.address },
          { side: "to", address: lockedAccount.address },
          { side: "from", address: controller.address },
          { side: "to", address: controller.address },
          { side: "from", address: testDisbursal.address },
          { side: "to", address: testDisbursal.address },
          { side: "from", address: noCallbackContract.address },
          { side: "to", address: noCallbackContract.address },
          { side: "to", address: operatorWallet }
        ]);
      });

      describe("core tests", () => {
        lockedAccountTestCases(makeDepositEuro, makeWithdrawEuro);
      });

      describe("migration tests", () => {
        beforeEach(async () => {
          migrationTarget = await deployMigrationTarget(assetToken);
          await applyTransferPermissions([
            { side: "from", address: migrationTarget.address },
            { side: "to", address: migrationTarget.address }
          ]);
        });

        locketAccountMigrationTestCases(makeDepositEuro, makeWithdrawEuro);
      });
    });

    function locketAccountMigrationTestCases(makeDeposit, makeWithdraw) {
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
        await makeDeposit(investorAddress, controller.address, ticket);
        await controller.investToken(neumarks, { from: investorAddress });
        const investorBalanceBefore = await lockedAccount.balanceOf.call(
          investorAddress
        );
        const assetBalanceSourceBefore = await assetToken.balanceOf.call(
          lockedAccount.address
        );
        await migrationTarget.setMigrationSource(lockedAccount.address, {
          from: admin
        });
        expect(await migrationTarget.currentMigrationSource()).to.eq(
          lockedAccount.address
        );
        let tx = await lockedAccount.enableMigration(migrationTarget.address, {
          from: admin
        });
        expectMigrationEnabledEvent(tx, migrationTarget.address);
        // migrate investor
        tx = await lockedAccount.migrate({ from: investorAddress });
        expectInvestorMigratedEvent(
          tx,
          investorAddress,
          ticket,
          neumarks,
          investorBalanceBefore[2]
        );
        // check invariants
        expect(await lockedAccount.totalLockedAmount()).to.be.bignumber.equal(
          0
        );
        expect(await migrationTarget.totalLockedAmount()).to.be.bignumber.equal(
          ticket
        );
        expect(await lockedAccount.totalInvestors()).to.be.bignumber.equal(0);
        expect(await migrationTarget.totalInvestors()).to.be.bignumber.equal(1);
        // check balance on old - no investor
        const investorBalanceAfter = await lockedAccount.balanceOf.call(
          investorAddress
        );
        // unlockDate == 0: does not exit
        expect(investorBalanceAfter[2]).to.be.bignumber.equal(0);
        // check asset balance
        const assetBalanceSourceAfter = await assetToken.balanceOf.call(
          lockedAccount.address
        );
        const assetBalanceTargetAfter = await assetToken.balanceOf.call(
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

      it("call migrate not from source should throw", async () => {
        const ticket = 1; // 1 wei ticket
        // test migration accepts any address
        await migrationTarget.setMigrationSource(otherMigrationSource, {
          from: admin
        });
        await makeDeposit(otherMigrationSource, otherMigrationSource, ticket);
        // set allowance in asset token
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
        await makeDeposit(otherMigrationSource, otherMigrationSource, ticket);
        await assetToken.approve(migrationTarget.address, ticket, {
          from: otherMigrationSource
        });
        // change below to 'from: otherMigrationSource' from this test to fail
        await expect(
          migrationTarget.migrateInvestor(investor, ticket, 1, startTimestamp, {
            from: admin
          })
        ).to.be.rejectedWith(EvmError);
      });

      it("target that returns false on migration should throw", async () => {
        const ticket = etherToWei(1);
        const neumarks = ticket.mul(6.5);
        // lock investor
        await makeDeposit(investor, controller.address, ticket);
        await controller.investToken(neumarks, { from: investor });
        await migrationTarget.setMigrationSource(lockedAccount.address, {
          from: admin
        });
        await lockedAccount.enableMigration(migrationTarget.address, {
          from: admin
        });
        // comment line below for this test to fail
        await migrationTarget.setShouldMigrationFail(true, { from: admin });
        await expect(
          lockedAccount.migrate({ from: investor })
        ).to.be.rejectedWith(EvmError);
      });

      it("rejects target with source address not matching contract enabling migration", async () => {
        // we set invalid source here, change to lockedAccount.address for this test to fail
        await migrationTarget.setMigrationSource(otherMigrationSource, {
          from: admin
        });
        // accepts only lockedAccount as source, otherMigrationSource points to different contract
        await expect(
          lockedAccount.enableMigration(migrationTarget.address, {
            from: admin
          })
        ).to.be.rejectedWith(EvmError);
      });

      it("should migrate investor", async () => {
        await migrateOne(etherToWei(1), investor);
      });

      it("should migrate investor then unlock and withdraw", async () => {
        const ticket = etherToWei(1);
        await migrateOne(ticket, investor);
        await enableReleaseAll();
        // no need to burn neumarks
        await migrationTarget.unlock({ from: investor });
        await makeWithdraw(investor, ticket);
      });

      it("migrate same investor twice should do nothing", async () => {
        await migrateOne(etherToWei(1), investor);
        const tx = await lockedAccount.migrate({ from: investor });
        expect(hasEvent(tx, "LogInvestorMigrated")).to.be.false;
      });

      it("migrate non existing investor should do nothing", async () => {
        await migrateOne(etherToWei(1), investor);
        const tx = await lockedAccount.migrate({ from: investor2 });
        expect(hasEvent(tx, "LogInvestorMigrated")).to.be.false;
      });

      it("should reject investor migration before it is enabled", async () => {
        const ticket = etherToWei(3.18919182);
        const neumarks = etherToWei(1.189729111);
        await makeDeposit(investor, controller.address, ticket);
        await controller.investToken(neumarks, { from: investor });
        await migrationTarget.setMigrationSource(lockedAccount.address, {
          from: admin
        });
        // uncomment below for this test to fail
        // await lockedAccount.enableMigration( migrationTarget.address, {from: admin} );
        await expect(
          lockedAccount.migrate({ from: investor })
        ).to.be.rejectedWith(EvmError);
      });

      it("should migrate investor in AcceptUnlocks", async () => {
        const ticket = etherToWei(3.18919182);
        const neumarks = etherToWei(1.189729111);
        await makeDeposit(investor, controller.address, ticket);
        await controller.investToken(neumarks, { from: investor });
        await migrationTarget.setMigrationSource(lockedAccount.address, {
          from: admin
        });
        await controller.succ();
        expect(await lockedAccount.lockState.call()).to.be.bignumber.eq(
          LockState.AcceptingUnlocks
        );
        await lockedAccount.enableMigration(migrationTarget.address, {
          from: admin
        });
        const tx = await lockedAccount.migrate({ from: investor });
        expectInvestorMigratedEvent(tx, investor, ticket, neumarks);
      });

      it("should reject enabling migration from invalid account", async () => {
        const ticket = etherToWei(3.18919182);
        const neumarks = etherToWei(1.189729111);
        await makeDeposit(investor, controller.address, ticket);
        await controller.investToken(neumarks, { from: investor });
        await migrationTarget.setMigrationSource(lockedAccount.address, {
          from: admin
        });
        await expect(
          lockedAccount.enableMigration(migrationTarget.address, {
            from: otherMigrationSource
          })
        ).to.be.rejectedWith(EvmError);
      });

      it("should reject enabling migration for a second time", async () => {
        await migrationTarget.setMigrationSource(lockedAccount.address, {
          from: admin
        });
        await lockedAccount.enableMigration(migrationTarget.address, {
          from: admin
        });
        // must throw
        await expect(
          lockedAccount.enableMigration(migrationTarget.address, {
            from: admin
          })
        ).to.be.rejectedWith(EvmError);
      });
    }

    function lockedAccountTestCases(makeDeposit, makeWithdraw) {
      function expectLockEvent(tx, investorAddress, ticket, neumarks) {
        const event = eventValue(tx, "LogFundsLocked");
        expect(event).to.exist;
        expect(event.args.investor).to.equal(investorAddress);
        expect(event.args.amount).to.be.bignumber.equal(ticket);
        expect(event.args.neumarks).to.be.bignumber.equal(neumarks);
      }

      function expectNeumarksBurnedEvent(tx, owner, euroUlp, neumarkUlp) {
        const event = eventValue(tx, "LogNeumarksBurned");
        expect(event).to.exist;
        expect(event.args.owner).to.equal(owner);
        expect(event.args.euroUlp).to.be.bignumber.equal(euroUlp);
        expect(event.args.neumarkUlp).to.be.bignumber.equal(neumarkUlp);
      }

      function expectUnlockEvent(tx, investorAddress, amount) {
        const event = eventValue(tx, "LogFundsUnlocked");
        expect(event).to.exist;
        expect(event.args.investor).to.equal(investorAddress);
        expect(event.args.amount).to.be.bignumber.equal(amount);
      }

      async function expectPenaltyEvent(tx, investorAddress, penalty) {
        const disbursalPool = await lockedAccount.penaltyDisbursalAddress();
        const event = eventValue(tx, "LogPenaltyDisbursed");
        expect(event).to.exist;
        expect(event.args.investor).to.equal(investorAddress);
        expect(event.args.amount).to.be.bignumber.equal(penalty);
        expect(event.args.toPool).to.equal(disbursalPool);
      }

      async function expectPenaltyBalance(penalty) {
        const disbursalPool = await lockedAccount.penaltyDisbursalAddress();
        const poolBalance = await assetToken.balanceOf.call(disbursalPool);
        expect(poolBalance).to.be.bignumber.eq(penalty);
      }

      async function lock(investorAddress, ticket) {
        // initial state of the lock
        const initialLockedAmount = await lockedAccount.totalLockedAmount();
        const initialAssetSupply = await assetToken.totalSupply();
        const initialNumberOfInvestors = await lockedAccount.totalInvestors();
        const initialNeumarksBalance = await neumark.balanceOf(investorAddress);
        const initialLockedBalance = await lockedAccount.balanceOf(
          investorAddress
        );
        // issue real neumarks and check against
        let tx = await neumark.issueForEuro(ticket, {
          from: investorAddress
        });
        const neumarks = eventValue(tx, "LogNeumarksIssued", "neumarkUlp");
        expect(await neumark.balanceOf(investorAddress)).to.be.bignumber.equal(
          neumarks.add(initialNeumarksBalance)
        );
        // only controller can lock
        await makeDeposit(investorAddress, controller.address, ticket);
        tx = await controller.investToken(neumarks, { from: investorAddress });
        expectLockEvent(tx, investorAddress, ticket, neumarks);
        // timestamp of block _investFor was mined
        const txBlock = await promisify(web3.eth.getBlock)(
          tx.receipt.blockNumber
        );
        const timebase = txBlock.timestamp;
        const investorBalance = await lockedAccount.balanceOf(investorAddress);
        expect(investorBalance[0]).to.be.bignumber.equal(
          ticket.add(initialLockedBalance[0])
        );
        expect(investorBalance[1]).to.be.bignumber.equal(
          neumarks.add(initialLockedBalance[1])
        );
        // verify longstop date independently
        let unlockDate = new web3.BigNumber(timebase + 18 * 30 * dayInSeconds);
        if (initialLockedBalance[2] > 0) {
          // earliest date is preserved for repeated investor address
          unlockDate = initialLockedBalance[2];
        }
        expect(investorBalance[2], "18 months in future").to.be.bignumber.eq(
          unlockDate
        );
        expect(await lockedAccount.totalLockedAmount()).to.be.bignumber.equal(
          initialLockedAmount.add(ticket)
        );
        expect(await assetToken.totalSupply()).to.be.bignumber.equal(
          initialAssetSupply.add(ticket)
        );
        const hasNewInvestor = initialLockedBalance[2] > 0 ? 0 : 1;
        expect(await lockedAccount.totalInvestors()).to.be.bignumber.equal(
          initialNumberOfInvestors.add(hasNewInvestor)
        );

        return neumarks;
      }

      async function unlockWithApprove(investorAddress, neumarkToBurn) {
        // investor approves transfer to lock contract to burn neumarks
        // console.log(`investor has ${parseInt(await neumark.balanceOf(investor))}`);
        const tx = await neumark.approve(lockedAccount.address, neumarkToBurn, {
          from: investorAddress
        });
        expect(eventValue(tx, "Approval", "amount")).to.be.bignumber.equal(
          neumarkToBurn
        );
        // only investor can unlock and must burn tokens
        return lockedAccount.unlock({ from: investorAddress });
      }

      async function unlockWithCallback(investorAddress, neumarkToBurn) {
        // investor approves transfer to lock contract to burn neumarks
        // console.log(`investor has ${await neumark.balanceOf(investor)} against ${neumarkToBurn}`);
        // console.log(`${lockedAccount.address} should spend`);
        // await lockedAccount.receiveApproval(investor, neumarkToBurn, neumark.address, "");
        const tx = await neumark.approveAndCall(
          lockedAccount.address,
          neumarkToBurn,
          "",
          {
            from: investorAddress
          }
        );
        expect(eventValue(tx, "Approval", "amount")).to.be.bignumber.equal(
          neumarkToBurn
        );

        return tx;
      }

      async function unlockWithCallbackUnknownToken(
        investorAddress,
        neumarkToBurn
      ) {
        // asset token is not allowed to call unlock on LockedAccount, change to neumark for test to fail
        await expect(
          assetToken.approveAndCall(lockedAccount.address, neumarkToBurn, "", {
            from: investorAddress
          })
        ).to.be.rejectedWith(EvmError);
      }

      async function calculateUnlockPenalty(ticket) {
        return ticket
          .mul(await lockedAccount.penaltyFraction())
          .div(etherToWei(1));
      }

      async function assertCorrectUnlock(tx, investorAddress, ticket, penalty) {
        const disbursalPool = await lockedAccount.penaltyDisbursalAddress();
        expect(await lockedAccount.totalLockedAmount()).to.be.bignumber.equal(
          0
        );
        expect(await assetToken.totalSupply()).to.be.bignumber.equal(ticket);
        // returns tuple as array
        const investorBalance = await lockedAccount.balanceOf(investorAddress);
        expect(investorBalance[2]).to.be.bignumber.eq(0); // checked by timestamp == 0
        expect(await lockedAccount.totalInvestors()).to.be.bignumber.eq(0);
        const balanceOfInvestorAndPool = (await assetToken.balanceOf(
          investorAddress
        )).add(await assetToken.balanceOf(disbursalPool));
        expect(balanceOfInvestorAndPool).to.be.bignumber.equal(ticket);
        // check penalty value
        await expectPenaltyBalance(penalty);
        // 0 neumarks at the end
        expect(await neumark.balanceOf(investorAddress)).to.be.bignumber.equal(
          0
        );
      }

      async function enableUnlocks() {
        // move time forward within longstop date
        await increaseTime(moment.duration(dayInSeconds, "s"));
        // controller says yes
        await controller.succ();
      }

      async function allowToReclaim(account) {
        await accessControl.setUserRole(
          account,
          roles.reclaimer,
          lockedAccount.address,
          TriState.Allow
        );
      }

      it("should be able to read lock parameters", async () => {
        expect(await lockedAccount.totalLockedAmount.call()).to.be.bignumber.eq(
          0
        );
        expect(await lockedAccount.totalInvestors.call()).to.be.bignumber.eq(0);
        expect(await lockedAccount.assetToken.call()).to.eq(assetToken.address);
      });

      it("should lock", async () => {
        await lock(investor, etherToWei(1));
      });

      it("should lock two different investors", async () => {
        await lock(investor, etherToWei(1));
        await lock(investor2, etherToWei(0.5));
      });

      it("should lock same investor", async () => {
        await lock(investor, etherToWei(1));
        await lock(investor, etherToWei(0.5));
      });

      it("should unlock with approval on contract disbursal", async () => {
        const ticket = etherToWei(1);
        const neumarks = await lock(investor, ticket);
        await enableUnlocks();
        // change disbursal pool
        await lockedAccount.setPenaltyDisbursal(testDisbursal.address, {
          from: admin
        });
        const unlockTx = await unlockWithApprove(investor, neumarks);
        // check if disbursal pool logged transfer
        const penalty = await calculateUnlockPenalty(ticket);
        await assertCorrectUnlock(unlockTx, investor, ticket, penalty);
        await expectPenaltyEvent(unlockTx, investor, penalty);
        expectUnlockEvent(unlockTx, investor, ticket.sub(penalty));
        await makeWithdraw(investor, ticket.sub(penalty));
      });

      it("should unlock two investors both with penalty", async () => {
        const ticket1 = etherToWei(1);
        const ticket2 = etherToWei(0.6210939884);
        const neumarks1 = await lock(investor, ticket1);
        const neumarks2 = await lock(investor2, ticket2);
        await enableUnlocks();
        let unlockTx = await unlockWithApprove(investor, neumarks1);
        const penalty1 = await calculateUnlockPenalty(ticket1);
        await expectPenaltyEvent(unlockTx, investor, penalty1);
        await expectPenaltyBalance(penalty1);
        expectUnlockEvent(unlockTx, investor, ticket1.sub(penalty1));
        expect(await neumark.balanceOf(investor2)).to.be.bignumber.eq(
          neumarks2
        );
        expect(await neumark.totalSupply()).to.be.bignumber.eq(neumarks2);
        expect(
          await assetToken.balanceOf(lockedAccount.address)
        ).to.be.bignumber.eq(ticket2);
        expect(await assetToken.totalSupply()).to.be.bignumber.eq(
          ticket1.add(ticket2)
        );

        unlockTx = await unlockWithApprove(investor2, neumarks2);
        const penalty2 = await calculateUnlockPenalty(ticket2);
        await expectPenaltyEvent(unlockTx, investor2, penalty2);
        await expectPenaltyBalance(penalty1.add(penalty2));
        expectUnlockEvent(unlockTx, investor2, ticket2.sub(penalty2));
      });

      it("should reject unlock with approval on contract disbursal that has receiveApproval not implemented", async () => {
        const ticket = etherToWei(1);
        const neumarks = await lock(investor, ticket);
        await enableUnlocks();
        // change disbursal pool to contract without receiveApproval, comment line below for test to fail
        await lockedAccount.setPenaltyDisbursal(noCallbackContract.address, {
          from: admin
        });
        const tx = await neumark.approve(lockedAccount.address, neumarks, {
          from: investor
        });
        expect(eventValue(tx, "Approval", "amount")).to.be.bignumber.equal(
          neumarks
        );
        await expect(
          lockedAccount.unlock({ from: investor })
        ).to.be.rejectedWith(EvmError);
      });

      it("should unlock with approval on simple address disbursal", async () => {
        const ticket = etherToWei(1);
        const neumarks = await lock(investor, ticket);
        await enableUnlocks();
        const unlockTx = await unlockWithApprove(investor, neumarks);
        const penalty = await calculateUnlockPenalty(ticket);
        await assertCorrectUnlock(unlockTx, investor, ticket, penalty);
        await expectPenaltyEvent(unlockTx, investor, penalty);
        expectUnlockEvent(unlockTx, investor, ticket.sub(penalty));
        await makeWithdraw(investor, ticket.sub(penalty));
      });

      it("should unlock with approveAndCall on simple address disbursal", async () => {
        const ticket = etherToWei(1);
        const neumarks = await lock(investor, ticket);
        await enableUnlocks();
        const unlockTx = await unlockWithCallback(investor, neumarks);
        const penalty = await calculateUnlockPenalty(ticket);
        await assertCorrectUnlock(unlockTx, investor, ticket, penalty);
        // truffle will not return events that are not in ABI of called contract so line below uncommented
        // await expectPenaltyEvent(unlockTx, investor, penalty, disbursalPool);
        // look for correct amount of burned neumarks
        expectNeumarksBurnedEvent(
          unlockTx,
          lockedAccount.address,
          ticket,
          neumarks
        );
        await makeWithdraw(investor, ticket.sub(penalty));
      });

      it("should reject unlock with approveAndCall with unknown token", async () => {
        const ticket = etherToWei(1);
        const neumarks = await lock(investor, ticket);
        await enableUnlocks();
        await unlockWithCallbackUnknownToken(investor, neumarks);
      });

      it("should allow unlock when neumark allowance and balance is too high", async () => {
        const ticket = etherToWei(1);
        const neumarks = await lock(investor, ticket);
        const neumarks2 = await lock(investor2, ticket);
        await enableUnlocks();
        // simulate trade
        const tradedAmount = neumarks2.mul(0.71389012).round(0);
        await neumark.transfer(investor, tradedAmount, {
          from: investor2
        });
        neumark.approveAndCall(
          lockedAccount.address,
          neumarks.add(tradedAmount),
          "",
          { from: investor }
        );
        // should keep traded amount
        expect(await neumark.balanceOf(investor)).to.be.bignumber.eq(
          tradedAmount
        );
      });

      it("should reject approveAndCall unlock when neumark allowance too low", async () => {
        const ticket = etherToWei(1);
        const neumarks = await lock(investor, ticket);
        await enableUnlocks();
        // change to mul(0) for test to fail
        const tradedAmount = neumarks.mul(0.71389012).round(0);
        await neumark.transfer(investor2, tradedAmount, {
          from: investor
        });
        await expect(
          neumark.approveAndCall(
            lockedAccount.address,
            neumarks.sub(tradedAmount),
            "",
            { from: investor }
          )
        ).to.be.rejectedWith(EvmError);
      });

      it("should reject unlock when neumark allowance too low", async () => {
        const ticket = etherToWei(1);
        const neumarks = await lock(investor, ticket);
        await enableUnlocks();
        // allow 1/3 amount
        let tx = await neumark.approve(
          lockedAccount.address,
          neumarks.mul(0.3),
          {
            from: investor
          }
        );
        await expect(lockedAccount.unlock({ from: investor })).to.be.rejectedWith(EvmError);
      });

      it("should reject unlock when neumark balance too low but allowance OK", async () => {
        const ticket = etherToWei(1);
        const neumarks = await lock(investor, ticket);
        await enableUnlocks();
        // simulate trade
        const tradedAmount = neumarks.mul(0.71389012).round(0);
        await neumark.transfer(investor2, tradedAmount, {
          from: investor
        });
        // allow full amount
        await neumark.approve(lockedAccount.address, neumarks, {
          from: investor
        });
        await expect(lockedAccount.unlock({ from: investor })).to.be.rejectedWith(EvmError);
      });

      it("should unlock after unlock date without penalty", async () => {
        const ticket = etherToWei(1);
        const neumarks = await lock(investor, ticket);
        await enableUnlocks();
        const investorBalance = await lockedAccount.balanceOf(investor);
        // forward time to unlock date
        await setTimeTo(investorBalance[2]);
        const unlockTx = await unlockWithApprove(investor, neumarks);
        await assertCorrectUnlock(unlockTx, investor, ticket, 0);
        expectUnlockEvent(unlockTx, investor, ticket);
        await makeWithdraw(investor, ticket);
        await expectPenaltyBalance(0);
      });

      it("should unlock two investors both without penalty", async () => {
        const ticket1 = etherToWei(4.18781092183);
        const ticket2 = etherToWei(0.46210939884);
        const neumarks1 = await lock(investor, ticket1);
        // day later
        await increaseTime(moment.duration(dayInSeconds, "s"));
        const neumarks2 = await lock(investor2, ticket2);
        await enableUnlocks();
        // forward to investor1 unlock date
        const investorBalance = await lockedAccount.balanceOf(investor);
        await setTimeTo(investorBalance[2]);
        let unlockTx = await unlockWithApprove(investor, neumarks1);
        expectUnlockEvent(unlockTx, investor, ticket1);
        await makeWithdraw(investor, ticket1);

        const investor2Balance = await lockedAccount.balanceOf(investor2);
        await setTimeTo(investor2Balance[2]);
        unlockTx = await unlockWithApprove(investor2, neumarks2);
        expectUnlockEvent(unlockTx, investor2, ticket2);
        await makeWithdraw(investor2, ticket2);
        await expectPenaltyBalance(0);
      });

      it("should unlock two investors one with penalty, second without penalty", async () => {
        const ticket1 = etherToWei(9.18781092183);
        const ticket2 = etherToWei(0.06210939884);
        const neumarks1 = await lock(investor, ticket1);
        // day later
        await increaseTime(moment.duration(dayInSeconds, "s"));
        const neumarks2 = await lock(investor2, ticket2);
        await enableUnlocks();
        // forward to investor1 unlock date
        const investorBalance = await lockedAccount.balanceOf(investor);
        await setTimeTo(investorBalance[2]);
        let unlockTx = await unlockWithApprove(investor, neumarks1);
        expectUnlockEvent(unlockTx, investor, ticket1);
        await makeWithdraw(investor, ticket1);

        const investor2Balance = await lockedAccount.balanceOf(investor2);
        // 10 seconds before unlock date should produce penalty
        await setTimeTo(investor2Balance[2] - 10);
        unlockTx = await unlockWithApprove(investor2, neumarks2);
        const penalty2 = await calculateUnlockPenalty(ticket2);
        await expectPenaltyEvent(unlockTx, investor2, penalty2);
        await expectPenaltyBalance(penalty2);
        expectUnlockEvent(unlockTx, investor2, ticket2.sub(penalty2));
        await makeWithdraw(investor2, ticket2.sub(penalty2));
      });

      it("should unlock without burning neumarks on release all", async () => {
        const ticket1 = etherToWei(9.18781092183);
        const ticket2 = etherToWei(0.06210939884);
        const neumarks1 = await lock(investor, ticket1);
        // day later
        await increaseTime(moment.duration(dayInSeconds, "s"));
        const neumarks2 = await lock(investor2, ticket2);
        await increaseTime(moment.duration(dayInSeconds, "s"));
        // controller says no
        await controller.fail();
        // forward to investor1 unlock date
        let unlockTx = await lockedAccount.unlock({ from: investor });
        expectUnlockEvent(unlockTx, investor, ticket1);
        // keeps neumarks
        expect(await neumark.balanceOf(investor)).to.be.bignumber.eq(neumarks1);
        await makeWithdraw(investor, ticket1);

        unlockTx = await lockedAccount.unlock({ from: investor2 });
        expectUnlockEvent(unlockTx, investor2, ticket2);
        // keeps neumarks
        expect(await neumark.balanceOf(investor2)).to.be.bignumber.eq(
          neumarks2
        );
        await makeWithdraw(investor2, ticket2);
      });

      it("should reject unlock if disbursal pool is not set");
      it("should return on unlock for investor with no balance");

      it("should reject to reclaim assetToken", async () => {
        const ticket1 = etherToWei(9.18781092183);
        await lock(investor, ticket1);
        // send assetToken to locked account
        const shouldBeReclaimedDeposit = etherToWei(0.028319821);
        await makeDeposit(
          investor2,
          lockedAccount.address,
          shouldBeReclaimedDeposit
        );
        // should reclaim
        await allowToReclaim(admin);
        // replace assetToken with neumark for this test to fail
        await expect(
          lockedAccount.reclaim(assetToken.address, {
            from: admin
          })
        ).to.be.rejectedWith(EvmError);
      });

      it("should reclaim neumarks", async () => {
        const ticket1 = etherToWei(9.18781092183);
        const neumarks1 = await lock(investor, ticket1);
        await enableUnlocks();
        await neumark.transfer(lockedAccount.address, neumarks1, {
          from: investor
        });
        await allowToReclaim(admin);
        await lockedAccount.reclaim(neumark.address, { from: admin });
        expect(await neumark.balanceOf(admin)).to.be.bignumber.eq(neumarks1);
      });

      it("should reclaim ether", async () => {
        const RECLAIM_ETHER = "0x0";
        const amount = etherToWei(1);
        await forceEther(lockedAccount.address, amount, investor);
        await allowToReclaim(admin);
        const adminEthBalance = await promisify(web3.eth.getBalance)(admin);
        const tx = await lockedAccount.reclaim(RECLAIM_ETHER, {
          from: admin,
          gasPrice
        });
        const gasCost = gasPrice.mul(tx.receipt.gasUsed);
        const adminEthAfterBalance = await promisify(web3.eth.getBalance)(
          admin
        );
        expect(adminEthAfterBalance).to.be.bignumber.eq(
          adminEthBalance.add(amount).sub(gasCost)
        );
      });

      function getKeyByValue(object, value) {
        return Object.keys(object).find(key => object[key] === value);
      }

      describe("should reject on invalid state", () => {
        const PublicFunctionsRejectInState = {
          lock: [
            LockState.Uncontrolled,
            LockState.AcceptingUnlocks,
            LockState.ReleaseAll
          ],
          unlock: [LockState.Uncontrolled, LockState.AcceptingLocks],
          receiveApproval: [LockState.Uncontrolled, LockState.AcceptingLocks],
          controllerFailed: [
            LockState.Uncontrolled,
            LockState.AcceptingUnlocks,
            LockState.ReleaseAll
          ],
          controllerSucceeded: [
            LockState.Uncontrolled,
            LockState.AcceptingUnlocks,
            LockState.ReleaseAll
          ],
          enableMigration: [LockState.Uncontrolled],
          setController: [
            LockState.Uncontrolled,
            LockState.AcceptingUnlocks,
            LockState.ReleaseAll
          ],
          setPenaltyDisbursal: [],
          reclaim: []
        };

        Object.keys(PublicFunctionsRejectInState).forEach(name => {
          PublicFunctionsRejectInState[name].forEach(state => {
            it(`when ${name} in ${getKeyByValue(LockState, state)}`);
          });
        });
      });

      describe("should reject on non admin access to", () => {
        const PublicFunctionsAdminOnly = [
          "enableMigration",
          "setController",
          "setPenaltyDisbursal"
        ];
        PublicFunctionsAdminOnly.forEach(name => {
          it(`${name}`);
        });
      });

      describe("should reject access from not a controller to", () => {
        const PublicFunctionsControllerOnly = [
          "lock",
          "controllerFailed",
          "controllerSucceeded"
        ];
        PublicFunctionsControllerOnly.forEach(name => {
          it(`${name}`);
        });
      });
    }

    async function deployLockedAccount(token, unlockDateMonths, unlockPenalty) {
      lockedAccount = await LockedAccount.new(
        accessControl.address,
        token.address,
        neumark.address,
        unlockDateMonths * monthInSeconds,
        etherToWei(1).mul(unlockPenalty).round()
      );
      await accessControl.setUserRole(
        admin,
        roles.lockedAccountAdmin,
        lockedAccount.address,
        TriState.Allow
      );
      await lockedAccount.setPenaltyDisbursal(operatorWallet, {
        from: admin
      });
      noCallbackContract = await TestNullContract.new();
      testDisbursal = await TestFeeDistributionPool.new();
      controller = await TestLockedAccountController.new(lockedAccount.address);
      await lockedAccount.setController(controller.address, {
        from: admin
      });
      startTimestamp = await latestTimestamp();
    }

    async function deployMigrationTarget(token) {
      const target = await TestLockedAccountMigrationTarget.new(
        accessControl.address,
        token.address,
        neumark.address,
        18 * monthInSeconds,
        etherToWei(1).mul(0.1).round()
      );
      await accessControl.setUserRole(
        admin,
        roles.lockedAccountAdmin,
        target.address,
        1
      );

      return target;
    }
  }
);
