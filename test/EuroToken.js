import { expect } from "chai";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import createAccessPolicy from "./helpers/createAccessPolicy";
import {
  basicTokenTests,
  standardTokenTests,
  erc677TokenTests,
  deployTestErc677Callback,
  ZERO_ADDRESS,
  expectTransferEvent,
  testWithdrawal
} from "./helpers/tokenTestCases";
import { eventValue } from "./helpers/events";
import { etherToWei } from "./helpers/unitConverter";
import roles from "./helpers/roles";
import EvmError from "./helpers/EVMThrow";

const EuroToken = artifacts.require("EuroToken");
const TestEuroTokenMigrationTarget = artifacts.require(
  "TestEuroTokenMigrationTarget"
);

contract(
  "EuroToken",
  ([_, depositManager, other, broker, reclaimer, ...investors]) => {
    let rbap;
    let euroToken;

    beforeEach(async () => {
      rbap = await createAccessPolicy([
        { subject: depositManager, role: roles.eurtDepositManager },
        { subject: reclaimer, role: roles.reclaimer }
      ]);
      euroToken = await EuroToken.new(rbap.address);
    });

    describe("specific tests", () => {
      function expectDepositEvent(tx, owner, amount) {
        const event = eventValue(tx, "LogDeposit");
        expect(event).to.exist;
        expect(event.args.to).to.eq(owner);
        expect(event.args.amount).to.be.bignumber.eq(amount);
      }

      function expectAllowedToEvent(tx, to, allowed) {
        const event = eventValue(tx, "LogAllowedToAddress");
        expect(event).to.exist;
        expect(event.args.to).to.eq(to);
        expect(event.args.allowed).to.eq(allowed);
      }

      function expectAllowedFromEvent(tx, from, allowed) {
        const event = eventValue(tx, "LogAllowedFromAddress");
        expect(event).to.exist;
        expect(event.args.from).to.eq(from);
        expect(event.args.allowed).to.eq(allowed);
      }

      it("should deploy", async () => {
        await prettyPrintGasCost("EuroToken deploy", euroToken);
      });

      it("should deposit", async () => {
        const initialBalance = etherToWei(1.19827398791827);
        const tx = await euroToken.deposit(investors[0], initialBalance, {
          from: depositManager
        });
        expectDepositEvent(tx, investors[0], initialBalance);
        expectTransferEvent(tx, ZERO_ADDRESS, investors[0], initialBalance);
        const totalSupply = await euroToken.totalSupply.call();
        expect(totalSupply).to.be.bignumber.eq(initialBalance);
        const balance = await euroToken.balanceOf(investors[0]);
        expect(balance).to.be.bignumber.eq(initialBalance);
      });

      it("should overflow totalSupply on deposit", async () => {
        const initialBalance = new web3.BigNumber(2).pow(256).sub(1);
        await euroToken.deposit(investors[0], initialBalance, {
          from: depositManager
        });
        await expect(
          euroToken.deposit(investors[1], initialBalance, {
            from: depositManager
          })
        ).to.be.rejectedWith(EvmError);
      });

      it("should allow transfer to investor after deposit", async () => {
        const initialBalance = etherToWei(83781221);
        const tx = await euroToken.deposit(investors[0], initialBalance, {
          from: depositManager
        });
        expectAllowedToEvent(tx, investors[0], true);
        const isAllowed = await euroToken.allowedTransferTo.call(investors[0]);
        expect(isAllowed).to.be.true;
      });

      it("should reject deposit not from deposit manager", async () => {
        const initialBalance = etherToWei(820938);
        await expect(
          euroToken.deposit(investors[0], initialBalance, { from: other })
        ).to.be.rejectedWith(EvmError);
      });

      it("should reject deposit to address 0", async () => {
        const initialBalance = etherToWei(19821);
        await expect(
          euroToken.deposit(ZERO_ADDRESS, initialBalance, {
            from: depositManager
          })
        ).to.be.rejectedWith(EvmError);
      });

      it("should transfer between investors via broker with minimum permissions", async () => {
        const initialBalance = etherToWei(83781221);
        await euroToken.deposit(investors[0], initialBalance, {
          from: depositManager
        });
        await euroToken.deposit(investors[1], initialBalance, {
          from: depositManager
        });
        await euroToken.approve(broker, initialBalance, { from: investors[0] });
        // no special permissions for investors needed, just the broker
        await euroToken.setAllowedTransferFrom(broker, true, {
          from: depositManager
        });
        await euroToken.setAllowedTransferTo(broker, true, {
          from: depositManager
        });

        await euroToken.transferFrom(
          investors[0],
          investors[1],
          initialBalance,
          {
            from: broker
          }
        );
        const afterBalance = await euroToken.balanceOf.call(investors[1]);
        expect(afterBalance).to.be.bignumber.eq(initialBalance.mul(2));
      });

      it("should transfer between allowed investors", async () => {
        const initialBalance = etherToWei(183781221);
        await euroToken.deposit(investors[0], initialBalance, {
          from: depositManager
        });
        const tx1 = await euroToken.setAllowedTransferTo(investors[1], true, {
          from: depositManager
        });
        expectAllowedToEvent(tx1, investors[1], true);
        const tx2 = await euroToken.setAllowedTransferFrom(investors[0], true, {
          from: depositManager
        });
        expectAllowedFromEvent(tx2, investors[0], true);
        // drop uneccessary 'to' permission for first investor
        const tx3 = await euroToken.setAllowedTransferTo(investors[0], false, {
          from: depositManager
        });
        expectAllowedToEvent(tx3, investors[0], false);
        await euroToken.transfer(investors[1], initialBalance, {
          from: investors[0]
        });
        const afterBalance = await euroToken.balanceOf.call(investors[1]);
        expect(afterBalance).to.be.bignumber.eq(initialBalance);
      });

      it("should not transfer from not allowed", async () => {
        await expect(
          euroToken.transfer(investors[1], 0, { from: investors[0] })
        ).to.be.rejectedWith(EvmError);
      });

      it("should reclaim euro token", async () => {
        const initialBalance = etherToWei(1.19827398791827);
        // deposit EurT to token contract
        await euroToken.deposit(euroToken.address, initialBalance, {
          from: depositManager
        });
        // allow reclaimer to receive EurT
        await euroToken.setAllowedTransferTo(reclaimer, true, {
          from: depositManager
        });
        await euroToken.setAllowedTransferFrom(euroToken.address, true, {
          from: depositManager
        });
        await euroToken.reclaim(euroToken.address, { from: reclaimer });
      });
    });

    describe("IBasicToken tests", () => {
      const initialBalance = etherToWei(1.19827398791827);
      const getToken = () => euroToken;

      beforeEach(async () => {
        await euroToken.deposit(investors[1], initialBalance, {
          from: depositManager
        });
        await euroToken.setAllowedTransferFrom(investors[1], true, {
          from: depositManager
        });
        await euroToken.setAllowedTransferTo(investors[2], true, {
          from: depositManager
        });
        await euroToken.setAllowedTransferTo(0x0, true, {
          from: depositManager
        });
      });

      basicTokenTests(getToken, investors[1], investors[2], initialBalance);
    });

    describe("IERC20Allowance tests", () => {
      const initialBalance = etherToWei(1.19827398791827);
      const getToken = () => euroToken;

      beforeEach(async () => {
        await euroToken.deposit(investors[1], initialBalance, {
          from: depositManager
        });
        // receiving investor to receive
        await euroToken.setAllowedTransferTo(investors[2], true, {
          from: depositManager
        });
        // broker permission to send
        await euroToken.setAllowedTransferFrom(broker, true, {
          from: depositManager
        });
        await euroToken.setAllowedTransferTo(0x0, true, {
          from: depositManager
        });
      });

      standardTokenTests(
        getToken,
        investors[1],
        investors[2],
        broker,
        initialBalance
      );
    });

    describe("IERC677Token tests", () => {
      const initialBalance = etherToWei(1.19827398791827);
      const getToken = () => euroToken;
      let erc667cb;
      const getTestErc667cb = () => erc667cb;

      beforeEach(async () => {
        erc667cb = await deployTestErc677Callback();
        await euroToken.deposit(investors[1], initialBalance, {
          from: depositManager
        });
        // broker (which is receiver) permission to send
        await euroToken.setAllowedTransferFrom(erc667cb.address, true, {
          from: depositManager
        });
        // receiver permission to receive
        await euroToken.setAllowedTransferTo(erc667cb.address, true, {
          from: depositManager
        });
      });

      erc677TokenTests(getToken, getTestErc667cb, investors[1], initialBalance);
    });

    describe("withdrawal tests", () => {
      const initialBalance = etherToWei(1.19827398791827);
      const getToken = () => euroToken;

      beforeEach(async () => {
        await euroToken.deposit(investors[0], initialBalance, {
          from: depositManager
        });
      });

      testWithdrawal(getToken, investors[0], initialBalance);
    });

    describe("migration tests", () => {
      let testEuroTokenMigrationTarget;
      beforeEach(async () => {
        testEuroTokenMigrationTarget = await TestEuroTokenMigrationTarget.new(
          euroToken.address
        );
      });

      function expectMigrationEnabledEvent(tx, target) {
        const event = eventValue(tx, "LogMigrationEnabled");
        expect(event).to.exist;
        expect(event.args.target).to.be.equal(target);
      }

      function expectEuroTokenOwnerMigratedEvent(tx, owner, amount) {
        const event = eventValue(tx, "LogEuroTokenOwnerMigrated");
        expect(event).to.exist;
        expect(event.args.owner).to.be.equal(owner);
        expect(event.args.amount).to.be.bignumber.eq(amount);
      }

      it("should migrate", async () => {
        const initialBalance = etherToWei(98172.1899182);
        await euroToken.deposit(investors[1], initialBalance, {
          from: depositManager
        });
        // allow to transfer from to check if migration clears all rights
        await euroToken.setAllowedTransferFrom(investors[1], true, {
          from: depositManager
        });
        const tx = await euroToken.enableMigration(
          testEuroTokenMigrationTarget.address,
          { from: depositManager }
        );
        expectMigrationEnabledEvent(tx, testEuroTokenMigrationTarget.address);
        expect(await euroToken.currentMigrationTarget()).to.be.eq(
          testEuroTokenMigrationTarget.address
        );
        const migrateTx = await euroToken.migrate({ from: investors[1] });
        expectEuroTokenOwnerMigratedEvent(
          migrateTx,
          investors[1],
          initialBalance
        );
        // check if transfer permissions disabled
        expect(await euroToken.allowedTransferTo(investors[1])).to.be.false;
        expect(await euroToken.allowedTransferFrom(investors[1])).to.be.false;
        // check balances
        const euroTokenBalance = await euroToken.balanceOf(investors[1]);
        expect(euroTokenBalance).to.be.bignumber.eq(0);
        expect(await euroToken.totalSupply()).to.be.bignumber.eq(0);
        const migratedBalance = await testEuroTokenMigrationTarget.balanceOf(
          investors[1]
        );
        expect(migratedBalance).to.be.bignumber.eq(initialBalance);
        // check if EURT are at investor's disposal
        await testEuroTokenMigrationTarget.transfer(
          investors[2],
          initialBalance,
          { from: investors[1] }
        );
      });

      it("should reject migration without 'to' permission", async () => {
        const initialBalance = etherToWei(98172.1899182);
        await euroToken.deposit(investors[1], initialBalance, {
          from: depositManager
        });
        await euroToken.enableMigration(testEuroTokenMigrationTarget.address, {
          from: depositManager
        });
        // then admin decided to ban the owner
        await euroToken.setAllowedTransferTo(investors[1], false, {
          from: depositManager
        });
        await expect(
          euroToken.migrate({ from: investors[1] })
        ).to.be.rejectedWith(EvmError);
      });

      it("should migrate investor with 0 balance", async () => {
        const initialBalance = etherToWei(98172.1899182);
        await euroToken.deposit(investors[1], initialBalance, {
          from: depositManager
        });
        await euroToken.enableMigration(testEuroTokenMigrationTarget.address, {
          from: depositManager
        });
        // empty account
        await euroToken.withdraw(initialBalance, { from: investors[1] });
        const migrateTx = await euroToken.migrate({ from: investors[1] });
        expectEuroTokenOwnerMigratedEvent(migrateTx, investors[1], 0);
      });

      it("should reject migration for a second time due to permissions autodrop", async () => {
        const initialBalance = etherToWei(98172.1899182);
        await euroToken.deposit(investors[1], initialBalance, {
          from: depositManager
        });
        await euroToken.enableMigration(testEuroTokenMigrationTarget.address, {
          from: depositManager
        });
        const migrateTx = await euroToken.migrate({ from: investors[1] });
        expectEuroTokenOwnerMigratedEvent(
          migrateTx,
          investors[1],
          initialBalance
        );
        // 'to' permission was dropped, second migration will fail
        await expect(
          euroToken.migrate({ from: investors[1] })
        ).to.be.rejectedWith(EvmError);
      });

      it("should reject enableMigration not from depositManager", async () => {
        await expect(
          euroToken.enableMigration(testEuroTokenMigrationTarget.address, {
            from: investors[0]
          })
        ).to.be.rejectedWith(EvmError);
      });

      it("should reject enableMigration twice", async () => {
        await euroToken.enableMigration(testEuroTokenMigrationTarget.address, {
          from: depositManager
        });
        await expect(
          euroToken.enableMigration(testEuroTokenMigrationTarget.address, {
            from: depositManager
          })
        ).to.be.rejectedWith(EvmError);
      });
    });
  }
);
