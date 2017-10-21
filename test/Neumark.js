import { expect } from "chai";
import EvmError from "./helpers/EVMThrow";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import { eventValue } from "./helpers/events";
import createAccessPolicy from "./helpers/createAccessPolicy";
import roles from "./helpers/roles";
import {
  basicTokenTests,
  standardTokenTests,
  erc677TokenTests,
  deployTestErc677Callback,
  erc223TokenTests,
  expectTransferEvent,
  ZERO_ADDRESS
} from "./helpers/tokenTestCases";

const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const Neumark = artifacts.require("./Neumark.sol");

const BigNumber = web3.BigNumber;
const AGREEMENT = "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT";
const EUR_DECIMALS = new BigNumber(10).toPower(18);
const NMK_DECIMALS = new BigNumber(10).toPower(18);

contract(
  "Neumark",
  ([deployer, other, platformRepresentative, transferAdmin, ...accounts]) => {
    let rbac;
    let forkArbiter;
    let neumark;

    beforeEach(async () => {
      rbac = await createAccessPolicy([
        { subject: transferAdmin, role: roles.transferAdmin },
        { subject: accounts[1], role: roles.neumarkIssuer },
        { subject: accounts[2], role: roles.neumarkIssuer },
        { subject: accounts[0], role: roles.neumarkBurner },
        { subject: accounts[1], role: roles.neumarkBurner },
        {
          subject: platformRepresentative,
          role: roles.platformOperatorRepresentative
        }
      ]);
      forkArbiter = await EthereumForkArbiter.new(rbac.address, {
        from: deployer
      });
      neumark = await Neumark.new(rbac.address, forkArbiter.address, {
        from: deployer
      });
      await neumark.amendAgreement(AGREEMENT, { from: platformRepresentative });
    });

    it("should deploy", async () => {
      await prettyPrintGasCost("Neumark deploy", neumark);
    });

    it("should have agreement and fork arbiter", async () => {
      const actualAgreement = await neumark.currentAgreement.call();
      const actualForkArbiter = await neumark.ethereumForkArbiter.call();

      expect(actualAgreement[2]).to.equal(AGREEMENT);
      expect(actualForkArbiter).to.equal(forkArbiter.address);
    });

    it("should have name Neumark, symbol NMK and 18 decimals", async () => {
      assert.equal(await neumark.name.call(), "Neumark");
      assert.equal(await neumark.symbol.call(), "NMK");
      assert.equal(await neumark.decimals.call(), 18);
    });

    it("should have transfers enabled after deployment", async () => {
      assert.equal(await neumark.transferEnabled.call(), true);
    });

    it("should start at zero", async () => {
      assert.equal(await neumark.totalSupply.call(), 0);
      assert.equal(await neumark.balanceOf.call(accounts[0]), 0);
    });

    it("should issue Neumarks", async () => {
      assert.equal((await neumark.totalEuroUlps.call()).valueOf(), 0);
      assert.equal((await neumark.totalSupply.call()).valueOf(), 0);

      const expectedr1EUR = EUR_DECIMALS.mul(100);
      const r1 = await neumark.issueForEuro(expectedr1EUR, {
        from: accounts[1]
      });
      await prettyPrintGasCost("Issue", r1);
      const expectedr1NMK = new web3.BigNumber("649999859166687009257");
      const r1NMK = eventValue(r1, "LogNeumarksIssued", "neumarkUlp");
      expect(r1NMK.sub(expectedr1NMK).abs()).to.be.bignumber.lessThan(2);
      expectTransferEvent(r1, ZERO_ADDRESS, accounts[1], r1NMK);
      expect(await neumark.totalEuroUlps.call()).to.be.bignumber.eq(
        expectedr1EUR
      );
      expect(await neumark.totalSupply.call()).to.be.bignumber.eq(r1NMK);
      expect(await neumark.balanceOf.call(accounts[1])).to.be.bignumber.eq(
        r1NMK
      );

      const expectedr2EUR = EUR_DECIMALS.mul(900);
      const r2 = await neumark.issueForEuro(expectedr2EUR, {
        from: accounts[2]
      });
      const expectedr2NMK = new web3.BigNumber("5849986057520322227964");
      const expectedTotalNMK = new web3.BigNumber("6499985916687009237221");
      const r2NMK = eventValue(r2, "LogNeumarksIssued", "neumarkUlp");
      expect(r2NMK.sub(expectedr2NMK).abs()).to.be.bignumber.lessThan(2);
      expectTransferEvent(r2, ZERO_ADDRESS, accounts[2], r2NMK);
      expect(await neumark.totalEuroUlps.call()).to.be.bignumber.eq(
        expectedr2EUR.add(expectedr1EUR)
      );
      expect(await neumark.totalSupply.call()).to.be.bignumber.eq(
        expectedTotalNMK
      );
      expect(await neumark.balanceOf.call(accounts[2])).to.be.bignumber.eq(
        r2NMK
      );
    });

    it("should issue and then burn Neumarks", async () => {
      // Issue Neumarks for 1 mln Euros
      const euroUlps = EUR_DECIMALS.mul(1000000);
      const r = await neumark.issueForEuro(euroUlps, { from: accounts[1] });
      await prettyPrintGasCost("Issue", r);
      const neumarkUlps = await neumark.balanceOf.call(accounts[1]);
      const neumarks = neumarkUlps.div(NMK_DECIMALS).floor();

      // Burn a third the Neumarks
      const toBurn = neumarks.div(3).round();
      const toBurnUlps = NMK_DECIMALS.mul(toBurn);
      const burned = await neumark.burn(toBurnUlps, {
        from: accounts[1]
      });
      await prettyPrintGasCost("Burn", burned);
      expect(
        (await neumark.balanceOf.call(accounts[1])).div(NMK_DECIMALS).floor()
      ).to.be.bignumber.eq(neumarks.sub(toBurn));
      const burnedNMK = eventValue(burned, "LogNeumarksBurned", "neumarkUlp");
      expectTransferEvent(burned, accounts[1], ZERO_ADDRESS, burnedNMK);
    });

    it("should issue same amount in multiple issuances", async () => {
      // 1 ether + 100 wei in eur
      const eurRate = 218.1192809;
      const euroUlps = EUR_DECIMALS.mul(1).add(100).mul(eurRate);
      const totNMK = await neumark.cumulative(euroUlps);
      // issue for 1 ether
      const euro1EthUlps = EUR_DECIMALS.mul(1).mul(eurRate);
      let tx = await neumark.issueForEuro(euro1EthUlps, { from: accounts[1] });
      const p1NMK = eventValue(tx, "LogNeumarksIssued", "neumarkUlp");
      // issue for 100 wei
      tx = await neumark.issueForEuro(new BigNumber(100).mul(eurRate), {
        from: accounts[1]
      });
      const p2NMK = eventValue(tx, "LogNeumarksIssued", "neumarkUlp");
      expect(totNMK).to.be.bignumber.equal(p1NMK.plus(p2NMK));
    });

    it("should reject to issue Neumark for not allowed address", async () => {
      const euroUlps = EUR_DECIMALS.mul(1000000);
      // replace 'other' with 'accounts[1]' for this test to fails
      await expect(
        neumark.issueForEuro(euroUlps, { from: other })
      ).to.be.rejectedWith(EvmError);
    });

    it("should reject to distribute Neumark for not allowed address", async () => {
      const euroUlps = EUR_DECIMALS.mul(1000000);
      const totNMK = await neumark.cumulative(euroUlps);
      await neumark.issueForEuro(euroUlps, { from: accounts[1] });
      // comment this line for this test to fail ....
      await neumark.transfer(other, totNMK, { from: accounts[1] });
      // and replace 'other' with 'accounts[1]' for this test to fail
      await expect(
        neumark.distributeNeumark(accounts[2], totNMK, { from: other })
      ).to.be.rejectedWith(EvmError);
    });

    it("should transfer Neumarks", async () => {
      const from = accounts[1];
      await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from });
      const amount = await neumark.balanceOf.call(accounts[1]);

      const tx = await neumark.transfer(accounts[3], amount, { from });
      const balance1 = await neumark.balanceOf.call(accounts[1]);
      const balance3 = await neumark.balanceOf.call(accounts[3]);

      await prettyPrintGasCost("Transfer", tx);
      expect(amount).to.be.bignumber.not.equal(0);
      expect(balance1).to.be.bignumber.equal(0);
      expect(balance3).to.be.bignumber.equal(amount);
    });

    it("should accept agreement on issue Neumarks", async () => {
      const from = accounts[1];
      const tx = await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from });

      const agreements = tx.logs
        .filter(e => e.event === "LogAgreementAccepted")
        .map(({ args: { accepter } }) => accepter);
      expect(agreements).to.have.length(1);
      expect(agreements).to.contain(from);
      const isSigned = await neumark.isAgreementSignedBy.call(from);
      expect(isSigned).to.be.true;
    });

    it("should accept agreement on transfer", async () => {
      const issuer = accounts[1];
      const from = accounts[2];
      const to = accounts[3];
      await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from: issuer });
      const amount = await neumark.balanceOf.call(issuer);
      // 'from' address will not be passively signed up here
      await neumark.transfer(from, amount, { from: issuer });

      // 'from' is making first transaction over Neumark, this will sign it up
      const tx = await neumark.transfer(to, amount, { from });
      const agreements = tx.logs
        .filter(e => e.event === "LogAgreementAccepted")
        .map(({ args: { accepter } }) => accepter);
      expect(agreements).to.have.length(1);
      expect(agreements).to.contain(from);
      const isFromSigned = await neumark.isAgreementSignedBy.call(from);
      expect(isFromSigned).to.be.true;
      // 'to' should not be passively signed
      const isToSigned = await neumark.isAgreementSignedBy.call(to);
      expect(isToSigned).to.be.false;
    });

    it("should accept agreement on distribute Neumarks", async () => {
      const issuer = accounts[1];
      const from = accounts[2];
      await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from: issuer });
      const amount = await neumark.balanceOf.call(issuer);

      // 'from' address should be signed up here, this is how distribute differs from transfer
      const tx = await neumark.distributeNeumark(from, amount, {
        from: issuer
      });
      const agreements = tx.logs
        .filter(e => e.event === "LogAgreementAccepted")
        .map(({ args: { accepter } }) => accepter);
      expect(agreements).to.have.length(1);
      expect(agreements).to.contain(from);
      const isFromSigned = await neumark.isAgreementSignedBy.call(from);
      expect(isFromSigned).to.be.true;
    });

    it("should accept agreement on approve", async () => {
      const issuer = accounts[1];
      const to = accounts[3];
      await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from: issuer });
      const amount = await neumark.balanceOf.call(issuer);
      // 'to' address will not be passively signed up here
      await neumark.transfer(to, amount, { from: issuer });

      // 'from' is making first transaction over Neumark, this will sign it up
      const tx = await neumark.approve(accounts[1], amount, { from: to });
      const agreements = tx.logs
        .filter(e => e.event === "LogAgreementAccepted")
        .map(({ args: { accepter } }) => accepter);
      expect(agreements).to.have.length(1);
      expect(agreements).to.contain(to);
      const isToSigned = await neumark.isAgreementSignedBy.call(to);
      expect(isToSigned).to.be.true;
    });

    it("should transfer Neumarks only when enabled", async () => {
      const from = accounts[1];
      await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from });
      const amount = await neumark.balanceOf.call(accounts[1]);
      await neumark.enableTransfer(false, { from: transferAdmin });

      const tx = neumark.transfer(accounts[3], amount, { from });
      await expect(tx).to.be.rejectedWith(EvmError);
    });

    it("should distribute Neumarks only when enabled", async () => {
      const from = accounts[1];
      await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from });
      const amount = await neumark.balanceOf.call(accounts[1]);
      // comment line below for this test to fail
      await neumark.enableTransfer(false, { from: transferAdmin });

      const tx = neumark.distributeNeumark(accounts[3], amount, { from });
      await expect(tx).to.be.rejectedWith(EvmError);
    });

    async function initNeumarkBalance(initialBalanceNmk) {
      // crude way to get exact Nmk balance
      await neumark.issueForEuro(initialBalanceNmk.mul(6.5).round(), {
        from: accounts[1]
      });
      const balance = await neumark.balanceOf.call(accounts[1]);
      await neumark.burn(balance.sub(initialBalanceNmk), {
        from: accounts[1]
      });
      // every ulp counts
      const finalBalance = await neumark.balanceOf.call(accounts[1]);
      expect(finalBalance).to.be.bignumber.eq(initialBalanceNmk);
    }

    describe("IBasicToken tests", () => {
      const initialBalanceNmk = NMK_DECIMALS.mul(1128192.2791827).round();
      const getToken = () => neumark;

      beforeEach(async () => {
        await initNeumarkBalance(initialBalanceNmk);
      });

      basicTokenTests(getToken, accounts[1], accounts[2], initialBalanceNmk);
    });

    describe("IERC20Allowance tests", () => {
      const initialBalanceNmk = NMK_DECIMALS.mul(91279837.398827).round();
      const getToken = () => neumark;

      beforeEach(async () => {
        await initNeumarkBalance(initialBalanceNmk);
      });

      standardTokenTests(
        getToken,
        accounts[1],
        accounts[2],
        accounts[3],
        initialBalanceNmk
      );
    });

    describe("IERC677Token tests", () => {
      const initialBalanceNmk = NMK_DECIMALS.mul(91279837.398827).round();
      const getToken = () => neumark;
      let erc667cb;
      const getTestErc667cb = () => erc667cb;

      beforeEach(async () => {
        await initNeumarkBalance(initialBalanceNmk);
        erc667cb = await deployTestErc677Callback();
      });

      erc677TokenTests(
        getToken,
        getTestErc667cb,
        accounts[1],
        initialBalanceNmk
      );
    });

    describe("IERC223Token tests", () => {
      const initialBalanceNmk = NMK_DECIMALS.mul(91279837.398827).round();
      const getToken = () => neumark;

      beforeEach(async () => {
        await initNeumarkBalance(initialBalanceNmk);
      });

      erc223TokenTests(getToken, accounts[1], accounts[2], initialBalanceNmk);
    });
  }
);
