import {expect} from "chai";
import moment from "moment";
import error, {Status} from "./helpers/error";
import {hasEvent, eventValue} from "./helpers/events";
import * as chain from "./helpers/spawnContracts";
import increaseTime, {setTimeTo} from "./helpers/increaseTime";
import {latestTimestamp} from "./helpers/latestTime";
import EvmError from "./helpers/EVMThrow";
import {TriState} from "./helpers/triState";
import forceEther from "./helpers/forceEther";
import ether from "./helpers/ether";
import roles from "./helpers/roles";
import {
  promisify,
  saveBlockchain,
  restoreBlockchain
} from "./helpers/evmCommands";

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

const LockState = {
  Uncontrolled: 0,
  AcceptingLocks: 1,
  AcceptingUnlocks: 2,
  ReleaseAll: 3
};

const gasPrice = new web3.BigNumber(0x01); // this low gas price is forced by code coverage
const operatorWallet = "0x55d7d863a155f75c5139e20dcbda8d0075ba2a1c";

contract("LockedAccount", ([_, admin, investor, investor2, otherMigrationSource]) => {
  let snapshot;
  let controller;
  let startTimestamp;
  let assetToken;
  let lockedAccount;
  let migrationTarget;

  beforeEach(async() => {
    await restoreBlockchain(snapshot);
    snapshot = await saveBlockchain();
  });

  describe("EtherToken", () => {

    async function deployEtherToken() {
      assetToken = await EtherToken.new(chain.accessControl.address);
    }

    async function makeDepositEth(from, to, amount) {
      await assetToken.deposit({from, value: amount});
      if (from != to) {
        await assetToken.transfer(to, amount, {from});
      }
    }

    async function makeWithdrawEth(investorAddress, amount) {
      const initalBalance = await promisify(web3.eth.getBalance)(investorAddress);
      const tx = await assetToken.withdraw(amount, {
        from: investorAddress,
        gasPrice
      });
      const afterBalance = await promisify(web3.eth.getBalance)(investorAddress);
      const gasCost = gasPrice.mul(tx.receipt.gasUsed);
      expect(afterBalance).to.be.bignumber.eq(
        initalBalance.add(amount).sub(gasCost)
      );
    }

    before(async() => {
      await chain.deployNeumark();
      await deployEtherToken();
      await deployLockedAccount(assetToken, 18, 0.1);
    });

    describe.only("core tests", () => {

      before(async() => {
        snapshot = await saveBlockchain();
      });

      lockedAccountTestCases(makeDepositEth, makeWithdrawEth);
    });

    describe("migration tests", () => {

      before(async() => {
        migrationTarget = await deployMigrationTarget(assetToken);
        snapshot = await saveBlockchain();
      });

      locketAccountMigrationTestCases(makeDepositEth, makeWithdrawEth);
    });

  });

  function locketAccountMigrationTestCases(makeDeposit, makeWithdraw) {

    function expectMigrationEnabledEvent(tx, target) {
      const event = eventValue(tx, "LogMigrationEnabled");
      expect(event).to.exist;
      expect(event.args.target).to.be.equal(target);
    }

    function expectInvestorMigratedEvent(tx,
                                         investorAddress,
                                         ticket,
                                         neumarks,
                                         unlockDate) {
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
      await controller.investFor(investorAddress, ticket, neumarks, {
        from: investorAddress
      });
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
      let tx = await lockedAccount.enableMigration(
        migrationTarget.address,
        {from: admin}
      );
      expectMigrationEnabledEvent(tx, migrationTarget.address);
      // migrate investor
      tx = await lockedAccount.migrate({from: investorAddress});
      expectInvestorMigratedEvent(
        tx,
        investorAddress,
        ticket,
        neumarks,
        investorBalanceBefore[2]
      );
      // check invariants
      expect(
        await lockedAccount.totalLockedAmount()
      ).to.be.bignumber.equal(0);
      expect(await migrationTarget.totalLockedAmount()).to.be.bignumber.equal(
        ticket
      );
      expect(await lockedAccount.totalInvestors()).to.be.bignumber.equal(
        0
      );
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
      await migrationTarget.setController(admin, {from: admin});
      await migrationTarget.controllerFailed({from: admin});
    }

    it("call migrate not from source should throw", async() => {
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
      // this should not, only otherMigrationSource can call migrate on target
      await expect(
        migrationTarget.migrateInvestor(investor, ticket, 1, startTimestamp, {
          from: admin
        })
      ).to.be.rejectedWith(EvmError);
    });

    it("target that returns false on migration should throw", async() => {
      const ticket = ether(1);
      const neumarks = ticket.mul(6.5);
      // lock investor
      await makeDeposit(investor, controller.address, ticket);
      await controller.investFor(investor, ticket, neumarks, {
        from: investor
      });
      await migrationTarget.setMigrationSource(lockedAccount.address, {
        from: admin
      });
      await lockedAccount.enableMigration(migrationTarget.address, {
        from: admin
      });

      await migrationTarget.setShouldMigrationFail(true, {from: admin});
      await expect(
        lockedAccount.migrate({from: investor})
      ).to.be.rejectedWith(EvmError);
    });

    it("rejects target with source address not matching contract enabling migration", async() => {
      // we set invalid source here
      await migrationTarget.setMigrationSource(otherMigrationSource, {
        from: admin
      });
      // accepts only lockedAccount as source
      await expect(
        lockedAccount.enableMigration(migrationTarget.address)
      ).to.be.rejectedWith(EvmError);
    });

    it("should migrate investor", async() => {
      await migrateOne(ether(1), investor);
    });

    it("should migrate investor then unlock and withdraw", async() => {
      const ticket = ether(1);
      await migrateOne(ticket, investor);
      await enableReleaseAll();
      // no need to burn neumarks
      await migrationTarget.unlock({from: investor});
      await makeWithdraw(investor, ticket);
    });

    it("migrate same investor twice should do nothing", async() => {
      await migrateOne(ether(1), investor);
      const tx = await lockedAccount.migrate({from: investor});
      expect(hasEvent(tx, "LogInvestorMigrated")).to.be.false;
    });

    it("migrate non existing investor should do nothing", async() => {
      await migrateOne(ether(1), investor);
      const tx = await lockedAccount.migrate({from: investor2});
      expect(hasEvent(tx, "LogInvestorMigrated")).to.be.false;
    });

    it("should reject investor migration before it is enabled", async() => {
      const ticket = ether(3.18919182);
      const neumarks = ether(1.189729111);
      await makeDeposit(investor, controller.address, ticket);
      await controller.investFor(investor, ticket, neumarks, {
        from: investor
      });
      await migrationTarget.setMigrationSource(lockedAccount.address, {
        from: admin
      });
      // uncomment below for this test to fail
      /* await lockedAccount.enableMigration(
       migrationTarget.address,
       {from: admin}
       ); */
      await expect(
        lockedAccount.migrate({from: investor})
      ).to.be.rejectedWith(EvmError);
    });

    it("should migrate investor in AcceptUnlocks", async() => {
      const ticket = ether(3.18919182);
      const neumarks = ether(1.189729111);
      await makeDeposit(investor, controller.address, ticket);
      await controller.investFor(investor, ticket, neumarks, {
        from: investor
      });
      await migrationTarget.setMigrationSource(lockedAccount.address, {
        from: admin
      });
      await controller.succ();
      expect(await lockedAccount.lockState.call()).to.be.bignumber.eq(LockState.AcceptingUnlocks);
      await lockedAccount.enableMigration(migrationTarget.address, {
        from: admin
      });
      const tx = await lockedAccount.migrate({from: investor});
      expectInvestorMigratedEvent(tx, investor, ticket, neumarks);
    });

    it("should reject enabling migration from invalid account", async() => {
      const ticket = ether(3.18919182);
      const neumarks = ether(1.189729111);
      await makeDeposit(investor, controller.address, ticket);
      await controller.investFor(investor, ticket, neumarks, {
        from: investor
      });
      await migrationTarget.setMigrationSource(lockedAccount.address, {
        from: admin
      });
      await expect(
        lockedAccount.enableMigration(migrationTarget.address, {
          from: otherMigrationSource
        })
      ).to.be.rejectedWith(EvmError);
    });

    it("should reject enabling migration for a second time", async() => {
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

    async function lock(investorAddress, ticket) {
      // initial state of the lock
      const initialLockedAmount = await lockedAccount.totalLockedAmount();
      const initialAssetSupply = await assetToken.totalSupply();
      const initialNumberOfInvestors = await lockedAccount.totalInvestors();
      const initialNeumarksBalance = await chain.neumark.balanceOf(
        investorAddress
      );
      const initialLockedBalance = await lockedAccount.balanceOf(
        investorAddress
      );
      // issue real neumarks and check against
      let tx = await chain.neumark.issueForEuro(ticket, {
        from: investorAddress
      });
      const neumarks = eventValue(tx, "LogNeumarksIssued", "neumarkUlp");
      expect(
        await chain.neumark.balanceOf(investorAddress)
      ).to.be.bignumber.equal(neumarks.add(initialNeumarksBalance));
      // only controller can lock
      await makeDeposit(investorAddress, controller.address, ticket);
      tx = await controller.investFor(investorAddress, ticket, neumarks, {
        from: investorAddress
      });
      expectLockEvent(tx, investorAddress, ticket, neumarks);
      // timestamp of block _investFor was mined
      const txBlock = await promisify(web3.eth.getBlock)(tx.receipt.blockNumber);
      const timebase = txBlock.timestamp;
      const investorBalance = await lockedAccount.balanceOf(
        investorAddress
      );
      expect(investorBalance[0]).to.be.bignumber.equal(ticket.add(initialLockedBalance[0]));
      expect(investorBalance[1]).to.be.bignumber.equal(neumarks.add(initialLockedBalance[1]));
      // verify longstop date independently
      let unlockDate = new web3.BigNumber(timebase + 18 * 30 * chain.days);
      if (initialLockedBalance[2] > 0) {
        // earliest date is preserved for repeated investor address
        unlockDate = initialLockedBalance[2];
      }
      expect(investorBalance[2], "18 months in future").to.be.bignumber.eq(
        unlockDate
      );
      expect(
        await lockedAccount.totalLockedAmount()
      ).to.be.bignumber.equal(initialLockedAmount.add(ticket));
      expect(
        await assetToken.totalSupply()
      ).to.be.bignumber.equal(initialAssetSupply.add(ticket));
      const hasNewInvestor = initialLockedBalance[2] > 0 ? 0 : 1;
      expect(
        await lockedAccount.totalInvestors()
      ).to.be.bignumber.equal(initialNumberOfInvestors.add(hasNewInvestor));

      return neumarks;
    }

    async function unlockWithApprove(investorAddress,
                                     neumarkToBurn) {
      // investor approves transfer to lock contract to burn neumarks
      // console.log(`investor has ${parseInt(await chain.neumark.balanceOf(investor))}`);
      let tx = await chain.neumark.approve(
        lockedAccount.address,
        neumarkToBurn,
        {
          from: investorAddress
        }
      );
      expect(eventValue(tx, "Approval", "amount")).to.be.bignumber.equal(
        neumarkToBurn
      );
      // only investor can unlock and must burn tokens
      return lockedAccount.unlock({from: investorAddress});
    }

    async function unlockWithCallback(investorAddress,
                                      neumarkToBurn) {
      // investor approves transfer to lock contract to burn neumarks
      // console.log(`investor has ${await chain.neumark.balanceOf(investor)} against ${neumarkToBurn}`);
      // console.log(`${chain.lockedAccount.address} should spend`);
      // await chain.lockedAccount.receiveApproval(investor, neumarkToBurn, chain.neumark.address, "");
      const tx = await chain.neumark.approveAndCall(
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

    async function unlockWithCallbackUnknownToken(investorAddress,
                                                  neumarkToBurn) {
      // asset token is not allowed to call unlock on LockedAccount
      await expect(
        assetToken.approveAndCall(
          lockedAccount.address,
          neumarkToBurn,
          "",
          {
            from: investorAddress
          }
        )
      ).to.be.rejectedWith(EvmError);
    }

    async function calculateUnlockPenalty(ticket) {
      return ticket
        .mul(await lockedAccount.penaltyFraction())
        .div(ether(1));
    }

    async function assertCorrectUnlock(tx, investorAddress, ticket, penalty) {
      const disbursalPool = await lockedAccount.penaltyDisbursalAddress();
      expect(error(tx)).to.eq(Status.SUCCESS);
      expect(
        await lockedAccount.totalLockedAmount()
      ).to.be.bignumber.equal(0);
      expect(
        await assetToken.totalSupply()
      ).to.be.bignumber.equal(ticket);
      // returns tuple as array
      const investorBalance = await lockedAccount.balanceOf(investorAddress);
      expect(investorBalance[2]).to.be.bignumber.eq(0); // checked by timestamp == 0
      expect(await lockedAccount.totalInvestors()).to.be.bignumber.eq(0);
      const balanceOfInvestorAndPool = (await assetToken.balanceOf(investorAddress)).add(
        await assetToken.balanceOf(disbursalPool));
      expect(balanceOfInvestorAndPool).to.be.bignumber.equal(ticket);
      // check penalty value
      expect(
        await assetToken.balanceOf(disbursalPool)
      ).to.be.bignumber.equal(penalty);
      // 0 neumarks at the end
      expect(
        await chain.neumark.balanceOf(investorAddress)
      ).to.be.bignumber.equal(0);
    }

    async function enableUnlocks() {
      // move time forward within longstop date
      await increaseTime(moment.duration(chain.days, "s"));
      // controller says yes
      await controller.succ();
      // must enable token transfers
      await chain.neumark.enableTransfer(true);
    }

    async function allowToReclaim(account) {
      await chain.accessControl.setUserRole(
        account,
        roles.reclaimer,
        lockedAccount.address,
        TriState.Allow
      );
    }

    it("should be able to read lock parameters", async() => {
      expect(await lockedAccount.totalLockedAmount.call()).to.be.bignumber.eq(0);
      expect(await lockedAccount.totalInvestors.call()).to.be.bignumber.eq(0);
      expect(await lockedAccount.assetToken.call()).to.eq(assetToken.address);
    });

    it("should lock", async() => {
      await lock(investor, ether(1));
    });

    it("should lock two different investors", async() => {
      await lock(investor, ether(1));
      await lock(investor2, ether(0.5));
    });

    it("should lock same investor", async() => {
      await lock(investor, ether(1));
      await lock(investor, ether(0.5));
    });

    it("should unlock with approval on contract disbursal", async() => {
      const ticket = ether(1);
      const neumarks = await lock(investor, ticket);
      await enableUnlocks();
      const testDisbursal = await TestFeeDistributionPool.new();
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

    it("should unlock two investors both with penalty", async() => {
      const ticket1 = ether(1);
      const ticket2 = ether(0.6210939884);
      const neumarks1 = await lock(investor, ticket1);
      const neumarks2 = await lock(investor2, ticket2);
      await enableUnlocks();
      let unlockTx = await unlockWithApprove(investor, neumarks1);
      const penalty1 = await calculateUnlockPenalty(ticket1);
      await expectPenaltyEvent(unlockTx, investor, penalty1);
      expectUnlockEvent(unlockTx, investor, ticket1.sub(penalty1));
      expect(await chain.neumark.balanceOf(investor2)).to.be.bignumber.eq(
        neumarks2
      );
      expect(await chain.neumark.totalSupply()).to.be.bignumber.eq(neumarks2);
      expect(
        await assetToken.balanceOf(lockedAccount.address)
      ).to.be.bignumber.eq(ticket2);
      expect(await assetToken.totalSupply()).to.be.bignumber.eq(
        ticket1.add(ticket2)
      );

      unlockTx = await unlockWithApprove(investor2, neumarks2);
      const penalty2 = await calculateUnlockPenalty(ticket2);
      await expectPenaltyEvent(unlockTx, investor2, penalty2);
      expectUnlockEvent(unlockTx, investor2, ticket2.sub(penalty2));
    });

    it("should reject unlock with approval on contract disbursal that has receiveApproval not implemented", async() => {
      const ticket = ether(1);
      const neumarks = await lock(investor, ticket);
      await enableUnlocks();
      // change disbursal pool to contract without receiveApproval
      const noCallbackContract = await TestNullContract.new();
      await lockedAccount.setPenaltyDisbursal(noCallbackContract.address, {
        from: admin
      });
      const tx = await chain.neumark.approve(
        lockedAccount.address,
        neumarks,
        {
          from: investor
        }
      );
      expect(eventValue(tx, "Approval", "amount")).to.be.bignumber.equal(
        neumarks
      );
      await expect(
        lockedAccount.unlock({from: investor})
      ).to.be.rejectedWith(EvmError);
    });

    it("should unlock with approval on simple address disbursal", async() => {
      const ticket = ether(1);
      const neumarks = await lock(investor, ticket);
      await enableUnlocks();
      const unlockTx = await unlockWithApprove(investor, neumarks);
      const penalty = await calculateUnlockPenalty(ticket);
      await assertCorrectUnlock(unlockTx, investor, ticket, penalty);
      await expectPenaltyEvent(unlockTx, investor, penalty);
      expectUnlockEvent(unlockTx, investor, ticket.sub(penalty));
      await makeWithdraw(investor, ticket.sub(penalty));
    });

    it("should unlock with approveAndCall on simple address disbursal", async() => {
      const ticket = ether(1);
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

    it("should throw on approveAndCall with unknown token", async() => {
      const ticket = ether(1);
      const neumarks = await lock(investor, ticket);
      await enableUnlocks();
      await unlockWithCallbackUnknownToken(investor, neumarks);
    });

    it("should allow unlock when neumark allowance and balance is too high", async() => {
      const ticket = ether(1);
      const neumarks = await lock(investor, ticket);
      const neumarks2 = await lock(investor2, ticket);
      await enableUnlocks();
      // simulate trade
      const tradedAmount = neumarks2.mul(0.71389012).round(0);
      await chain.neumark.transfer(investor, tradedAmount, {from: investor2});
      chain.neumark.approveAndCall(
        lockedAccount.address,
        neumarks.add(tradedAmount),
        "",
        {from: investor}
      );
      // should keep traded amount
      expect(await chain.neumark.balanceOf(investor)).to.be.bignumber.eq(
        tradedAmount
      );
    });

    it("should reject approveAndCall unlock when neumark allowance too low", async() => {
      const ticket = ether(1);
      const neumarks = await lock(investor, ticket);
      await enableUnlocks();
      // simulate trade
      const tradedAmount = neumarks.mul(0.71389012).round(0);
      await chain.neumark.transfer(investor2, tradedAmount, {from: investor});
      await expect(
        chain.neumark.approveAndCall(
          lockedAccount.address,
          neumarks.sub(tradedAmount),
          "",
          {from: investor}
        )
      ).to.be.rejectedWith(EvmError);
    });

    it("should reject unlock when neumark balance too low but allowance OK", async() => {
      const ticket = ether(1);
      const neumarks = await lock(investor, ticket);
      await enableUnlocks();
      // simulate trade
      const tradedAmount = neumarks.mul(0.71389012).round(0);
      await chain.neumark.transfer(investor2, tradedAmount, {from: investor});
      // allow full amount
      let tx = await chain.neumark.approve(
        lockedAccount.address,
        neumarks,
        {from: investor}
      );
      expect(eventValue(tx, "Approval", "amount")).to.be.bignumber.equal(
        neumarks
      );
      // then try to unlock
      tx = await lockedAccount.unlock({from: investor});
      expect(error(tx)).to.eq(Status.NOT_ENOUGH_NEUMARKS_TO_UNLOCK);
    });

    it("should unlock after unlock date without penalty", async() => {
      const ticket = ether(1);
      const neumarks = await lock(investor, ticket);
      await enableUnlocks();
      const investorBalance = await lockedAccount.balanceOf(investor);
      // forward time to unlock date
      await setTimeTo(investorBalance[2]);
      const unlockTx = await unlockWithApprove(investor, neumarks);
      await assertCorrectUnlock(unlockTx, investor, ticket, 0);
      expectUnlockEvent(unlockTx, investor, ticket);
      await makeWithdraw(investor, ticket);
    });

    it("should unlock two investors both without penalty", async() => {
      const ticket1 = ether(4.18781092183);
      const ticket2 = ether(0.46210939884);
      const neumarks1 = await lock(investor, ticket1);
      // day later
      await increaseTime(moment.duration(chain.days, "s"));
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
    });

    it("should unlock two investors one with penalty, second without penalty", async() => {
      const ticket1 = ether(9.18781092183);
      const ticket2 = ether(0.06210939884);
      const neumarks1 = await lock(investor, ticket1);
      // day later
      await increaseTime(moment.duration(chain.days, "s"));
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
      expectUnlockEvent(unlockTx, investor2, ticket2.sub(penalty2));
      await makeWithdraw(investor2, ticket2.sub(penalty2));
    });

    it("should unlock without burning neumarks on release all", async() => {
      const ticket1 = ether(9.18781092183);
      const ticket2 = ether(0.06210939884);
      const neumarks1 = await lock(investor, ticket1);
      // day later
      await increaseTime(moment.duration(chain.days, "s"));
      const neumarks2 = await lock(investor2, ticket2);
      await increaseTime(moment.duration(chain.days, "s"));
      // controller says no
      await controller.fail();
      // forward to investor1 unlock date
      let unlockTx = await lockedAccount.unlock({from: investor});
      expectUnlockEvent(unlockTx, investor, ticket1);
      // keeps neumarks
      expect(await chain.neumark.balanceOf(investor)).to.be.bignumber.eq(
        neumarks1
      );
      await makeWithdraw(investor, ticket1);

      unlockTx = await lockedAccount.unlock({from: investor2});
      expectUnlockEvent(unlockTx, investor2, ticket2);
      // keeps neumarks
      expect(await chain.neumark.balanceOf(investor2)).to.be.bignumber.eq(
        neumarks2
      );
      await makeWithdraw(investor2, ticket2);
    });

    it("should reject unlock if disbursal pool is not set");
    it("should return on unlock for investor with no balance");

    it("should reject to reclaim assetToken", async() => {
      const ticket1 = ether(9.18781092183);
      await lock(investor, ticket1);
      // send assetToken to locked account
      const shouldBeReclaimedDeposit = ether(0.028319821);
      makeDeposit(investor2, lockedAccount.address, shouldBeReclaimedDeposit);
      // should reclaim
      await allowToReclaim(admin);
      await expect(
        lockedAccount.reclaim(assetToken.address, {
          from: admin
        })
      ).to.be.rejectedWith(EvmError);
    });

    it("should reclaim neumarks", async() => {
      const ticket1 = ether(9.18781092183);
      const neumarks1 = await lock(investor, ticket1);
      await enableUnlocks();
      await chain.neumark.transfer(lockedAccount.address, neumarks1, {
        from: investor
      });
      await allowToReclaim(admin);
      await lockedAccount.reclaim(chain.neumark.address, {from: admin});
      expect(await chain.neumark.balanceOf(admin)).to.be.bignumber.eq(neumarks1);
    });

    it("should reclaim ether", async() => {
      const RECLAIM_ETHER = "0x0";
      const amount = ether(1);
      await forceEther(lockedAccount.address, amount, investor);
      await allowToReclaim(admin);
      const adminEthBalance = await promisify(web3.eth.getBalance)(admin);
      const tx = await lockedAccount.reclaim(RECLAIM_ETHER, {
        from: admin,
        gasPrice
      });
      const gasCost = gasPrice.mul(tx.receipt.gasUsed);
      const adminEthAfterBalance = await promisify(web3.eth.getBalance)(admin);
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
      chain.accessControl.address,
      token.address,
      chain.neumark.address,
      unlockDateMonths * chain.months,
      ether(1).mul(unlockPenalty).round()
    );
    await chain.accessControl.setUserRole(
      admin,
      roles.lockedAccountAdmin,
      lockedAccount.address,
      TriState.Allow
    );

    await lockedAccount.setPenaltyDisbursal(operatorWallet, {
      from: admin
    });
    controller = await TestLockedAccountController.new(
      lockedAccount.address
    );
    await lockedAccount.setController(controller.address, {
      from: admin
    });
    startTimestamp = await latestTimestamp();
  }

  async function deployMigrationTarget(token) {
    const target = await TestLockedAccountMigrationTarget.new(
      chain.accessControl.address,
      token.address,
      chain.neumark.address,
      18 * chain.months,
      ether(1).mul(0.1).round()
    );
    await chain.accessControl.setUserRole(
      admin,
      roles.lockedAccountAdmin,
      target.address,
      1
    );

    return target;
  }
});
