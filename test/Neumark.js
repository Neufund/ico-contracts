import { expect } from "chai";
import EvmError from "./helpers/EVMThrow";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import { eventValue } from "./helpers/events";
import { EVERYONE } from "./helpers/triState";
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
import { snapshotTokenTests } from "./helpers/snapshotTokenTestCases";
import { parseNmkDataset } from "./helpers/dataset";
// import increaseTime  from "./helpers/increaseTime";

const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const Neumark = artifacts.require("TestNeumark");
const TestSnapshotToken = artifacts.require("TestSnapshotToken");

const BigNumber = web3.BigNumber;
const AGREEMENT = "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT";
const EUR_DECIMALS = new BigNumber(10).toPower(18);
const NMK_DECIMALS = new BigNumber(10).toPower(18);

contract(
  "Neumark",
  (
    [
      deployer,
      other,
      platformRepresentative,
      transferAdmin,
      issuer1,
      issuer2,
      ...accounts
    ]
  ) => {
    let rbap;
    let forkArbiter;
    let neumark;

    beforeEach(async () => {
      rbap = await createAccessPolicy([
        { subject: transferAdmin, role: roles.transferAdmin },
        { subject: deployer, role: roles.snapshotCreator },
        { subject: issuer1, role: roles.neumarkIssuer },
        { subject: issuer2, role: roles.neumarkIssuer },
        { subject: EVERYONE, role: roles.neumarkBurner },
        // { subject: issuer2, role: roles.neumarkBurner },
        {
          subject: platformRepresentative,
          role: roles.platformOperatorRepresentative
        }
      ]);
      forkArbiter = await EthereumForkArbiter.new(rbap.address, {
        from: deployer
      });
      neumark = await Neumark.new(rbap.address, forkArbiter.address, {
        from: deployer
      });
      await neumark.amendAgreement(AGREEMENT, { from: platformRepresentative });
    });

    async function expectAgreementAccepted(signer, signTx) {
      const signedAtBlock = await neumark.agreementSignedAtBlock.call(signer);
      if (signTx) {
        expect(signedAtBlock).to.be.bignumber.eq(signTx.receipt.blockNumber);
      } else {
        expect(signedAtBlock).to.be.bignumber.gt(0);
      }
    }

    function expectNeumarksBurnedEvent(tx, owner, euroUlps, neumarkUlps) {
      const event = eventValue(tx, "LogNeumarksBurned");
      expect(event).to.exist;
      expect(event.args.owner).to.equal(owner);
      expect(event.args.euroUlps).to.be.bignumber.equal(euroUlps);
      expect(event.args.neumarkUlps).to.be.bignumber.equal(neumarkUlps);
    }

    function expectNeumarksIssuedEvent(tx, owner, euroUlps, neumarkUlps) {
      const event = eventValue(tx, "LogNeumarksIssued");
      expect(event).to.exist;
      expect(event.args.owner).to.equal(owner);
      expect(event.args.euroUlps).to.be.bignumber.equal(euroUlps);
      expect(event.args.neumarkUlps).to.be.bignumber.equal(neumarkUlps);
    }

    async function initNeumarkBalance(initialBalanceNmk, distributeTo) {
      // crude way to get exact Nmk balance
      await neumark.issueForEuro(initialBalanceNmk.mul(6.5).round(), {
        from: issuer1
      });
      const balance = await neumark.balanceOf.call(issuer1);
      await neumark.burn.uint256(balance.sub(initialBalanceNmk), {
        from: issuer1
      });
      // every ulp counts
      const finalBalance = await neumark.balanceOf.call(issuer1);
      expect(finalBalance).to.be.bignumber.eq(initialBalanceNmk);
      await neumark.distribute(distributeTo, initialBalanceNmk, {
        from: issuer1
      });
    }

    describe("general tests", () => {
      it("should deploy", async () => {
        await prettyPrintGasCost("Neumark deploy", neumark);
      });

      it("should have agreement and fork arbiter", async () => {
        const actualAgreement = await neumark.currentAgreement.call();
        const actualForkArbiter = await neumark.ethereumForkArbiter.call();

        expect(actualAgreement[2]).to.equal(AGREEMENT);
        expect(actualForkArbiter).to.equal(forkArbiter.address);
      });

      it("should have name Neumark, symbol NEU and 18 decimals", async () => {
        assert.equal(await neumark.name.call(), "Neumark");
        assert.equal(await neumark.symbol.call(), "NEU");
        assert.equal(await neumark.decimals.call(), 18);
      });

      it("should have curve parameters", async () => {
        expect(await neumark.neumarkCap.call()).to.be.bignumber.eq(
          NMK_DECIMALS.mul(1500000000)
        );
        expect(await neumark.initialRewardFraction.call()).to.be.bignumber.eq(
          NMK_DECIMALS.mul(6.5)
        );
      });

      it("should have transfers disabled after deployment", async () => {
        assert.equal(await neumark.transferEnabled.call(), false);
      });

      it("should have transfers enabled for NEUMARK_ISSUER after deployment", async () => {
        assert.equal(
          await neumark.transferEnabled.call({ from: issuer1 }),
          false
        );
      });

      it("should reject to enable transfer without permission", async () => {
        await expect(
          neumark.enableTransfer(true, { from: other })
        ).to.be.rejectedWith(EvmError);
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
          from: issuer1
        });
        await prettyPrintGasCost("Issue", r1);
        const expectedr1NMK = new web3.BigNumber("649999859166687009257");
        const r1NMK = eventValue(r1, "LogNeumarksIssued", "neumarkUlps");
        expect(r1NMK.sub(expectedr1NMK).abs()).to.be.bignumber.lessThan(2);
        expectTransferEvent(r1, ZERO_ADDRESS, issuer1, r1NMK);
        expectNeumarksIssuedEvent(r1, issuer1, expectedr1EUR, r1NMK);
        expect(await neumark.totalEuroUlps.call()).to.be.bignumber.eq(
          expectedr1EUR
        );
        expect(await neumark.totalSupply.call()).to.be.bignumber.eq(r1NMK);
        expect(await neumark.balanceOf.call(issuer1)).to.be.bignumber.eq(r1NMK);

        const expectedr2EUR = EUR_DECIMALS.mul(900);
        const r2 = await neumark.issueForEuro(expectedr2EUR, {
          from: issuer2
        });
        const expectedr2NMK = new web3.BigNumber("5849986057520322227964");
        const expectedTotalNMK = new web3.BigNumber("6499985916687009237221");
        const r2NMK = eventValue(r2, "LogNeumarksIssued", "neumarkUlps");
        expect(r2NMK.sub(expectedr2NMK).abs()).to.be.bignumber.lessThan(2);
        expectTransferEvent(r2, ZERO_ADDRESS, issuer2, r2NMK);
        expectNeumarksIssuedEvent(r2, issuer2, expectedr2EUR, r2NMK);
        expect(await neumark.totalEuroUlps.call()).to.be.bignumber.eq(
          expectedr2EUR.add(expectedr1EUR)
        );
        expect(await neumark.totalSupply.call()).to.be.bignumber.eq(
          expectedTotalNMK
        );
        expect(await neumark.balanceOf.call(issuer2)).to.be.bignumber.eq(r2NMK);
      });

      it("should issue and then burn Neumarks", async () => {
        // Issue Neumarks for 1 mln Euros
        const euroUlps = EUR_DECIMALS.mul(1000000);
        const r = await neumark.issueForEuro(euroUlps, { from: issuer1 });
        await prettyPrintGasCost("Issue", r);
        const neumarkUlps = await neumark.balanceOf.call(issuer1);
        const neumarks = neumarkUlps.div(NMK_DECIMALS).floor();
        expectNeumarksIssuedEvent(r, issuer1, euroUlps, neumarkUlps);

        // Burn a third of the Neumarks
        const toBurn = neumarks.div(3).round();
        const toBurnUlps = NMK_DECIMALS.mul(toBurn);
        const burned = await neumark.burn.uint256(toBurnUlps, {
          from: issuer1
        });
        await prettyPrintGasCost("Burn", burned);
        expect(
          (await neumark.balanceOf.call(issuer1)).div(NMK_DECIMALS).floor()
        ).to.be.bignumber.eq(neumarks.sub(toBurn));
        const rollbackedEurUlps = eventValue(
          burned,
          "LogNeumarksBurned",
          "euroUlps"
        );
        expectTransferEvent(burned, issuer1, ZERO_ADDRESS, toBurnUlps);
        expectNeumarksBurnedEvent(
          burned,
          issuer1,
          rollbackedEurUlps,
          toBurnUlps
        );
      });

      it("should issue same amount in multiple issuances", async () => {
        // 1 ether + 100 wei in eur
        const eurRate = 218.1192809;
        const euroUlps = EUR_DECIMALS.mul(1)
          .add(100)
          .mul(eurRate);
        const totNMK = await neumark.cumulative(euroUlps);
        // issue for 1 ether
        const euro1EthUlps = EUR_DECIMALS.mul(1).mul(eurRate);
        let tx = await neumark.issueForEuro(euro1EthUlps, { from: issuer1 });
        const p1NMK = eventValue(tx, "LogNeumarksIssued", "neumarkUlps");
        // issue for 100 wei
        tx = await neumark.issueForEuro(new BigNumber(100).mul(eurRate), {
          from: issuer1
        });
        const p2NMK = eventValue(tx, "LogNeumarksIssued", "neumarkUlps");
        expect(totNMK).to.be.bignumber.equal(p1NMK.plus(p2NMK));
      });

      async function expectIncrementalInverseWalk(expectedPoints) {
        // eslint-disable-next-line no-console
        console.log(
          `will compute ${expectedPoints.length} inverses. stand by...`
        );

        const initialEurUlps = new BigNumber("100000000000").mul(EUR_DECIMALS);
        await neumark.issueForEuro(initialEurUlps, { from: issuer1 });
        expectedPoints.reverse();
        for (const [e, n] of expectedPoints) {
          const totalNmk = await neumark.totalSupply.call();
          const totalEuroUlps = await neumark.totalEuroUlps.call();
          const burnNmk = totalNmk.sub(NMK_DECIMALS.mul(n));
          if (burnNmk.gt(0)) {
            // if anything to burn
            const expectedEurDeltaUlps = totalEuroUlps.sub(EUR_DECIMALS.mul(e));
            const burnTx = await neumark.burn.uint256(burnNmk, {
              from: issuer1
            });
            const actualEurDeltaUlps = eventValue(
              burnTx,
              "LogNeumarksBurned",
              "euroUlps"
            );
            const expectedEurDelta = expectedEurDeltaUlps.div(EUR_DECIMALS);
            const actualEurDelta = actualEurDeltaUlps.div(EUR_DECIMALS);
            const roundingPrecision = e.gte("900000000") ? 4 : 10;

            // console.log(`should burn ${burnNmk.toNumber()} with expected Euro delta ${expectedEurDelta.toNumber()}, got ${actualEurDelta.toNumber()} diff ${expectedEurDelta.sub(actualEurDelta).toNumber()}`);
            expect(
              actualEurDelta.round(roundingPrecision, 4),
              `Invalid inverse at NEU ${n} burning NEU ${
                burnNmk
              } at ${e.toNumber()}`
            ).to.be.bignumber.eq(expectedEurDelta.round(roundingPrecision, 4));

            const newTotalEuroUlps = await neumark.totalEuroUlps.call();
            // const newTotalNmk = await neumark.totalSupply.call();
            const totalEuro = newTotalEuroUlps.div(EUR_DECIMALS);
            expect(totalEuro.round(roundingPrecision, 4)).to.be.bignumber.eq(
              e.round(roundingPrecision, 4)
            );

            // check inverse against curve
            /* const controlCurveNmk = await neumark.cumulative.call(newTotalEuroUlps);
            if (controlCurveNmk.sub(newTotalNmk).abs().gt(0)) {
              console.log(`control nmk do not equal totalNmk ${controlCurveNmk.sub(newTotalNmk).toNumber()}`)
            } */
          }
        }

        const totalNmk = await neumark.totalSupply.call();
        const totalEuroUlps = await neumark.totalEuroUlps.call();
        // console.log(totalEuroUlps);
        // must burn all Neumarks
        expect(totalNmk).to.be.bignumber.eq(0);
        // must burn all euro
        expect(totalEuroUlps).to.be.bignumber.eq(0);
      }

      it("should burn all neumarks incrementally integer range", async () => {
        const expectedCurvePointsAtIntegers = parseNmkDataset(
          `${__dirname}/data/expectedCurvePointsAtIntegers.csv`
        );
        await expectIncrementalInverseWalk(expectedCurvePointsAtIntegers);
      });

      it("should burn all neumarks incrementally random range", async () => {
        const expectedCurvePointsAtRandom = parseNmkDataset(
          `${__dirname}/data/expectedCurvePointsAtRandom.csv`
        );
        await expectIncrementalInverseWalk(expectedCurvePointsAtRandom);
      });

      it("should issue and burn without inverse", async () => {
        await neumark.issueForEuro(2, { from: issuer1 });
        await neumark.burn.uint256(1, { from: issuer1 });
        await neumark.burn.uint256(5, { from: issuer1 });
        await neumark.burn.uint256(1, { from: issuer1 });
        await neumark.burn.uint256(5, { from: issuer1 });
        const totalNmk = await neumark.totalSupply.call();
        const totalEuroUlps = await neumark.totalEuroUlps.call();
        // must burn all Neumarks
        expect(totalNmk).to.be.bignumber.eq(0);
        // must burn all euro
        expect(totalEuroUlps).to.be.bignumber.eq(0);
      });

      it("should burn 0 neumarks", async () => {
        const burnAt0Tx = await neumark.burn.uint256(0, { from: issuer1 });
        expectNeumarksBurnedEvent(burnAt0Tx, issuer1, 0, 0);
        await neumark.issueForEuro(2, { from: issuer1 });
        const burnAt2Tx = await neumark.burn.uint256(0, { from: issuer1 });
        expectNeumarksBurnedEvent(burnAt2Tx, issuer1, 0, 0);
      });

      it("should reject to burn if above balance", async () => {
        await expect(
          neumark.burn.uint256(1, { from: issuer1 })
        ).to.be.rejectedWith(EvmError);
        await neumark.issueForEuro(2, { from: issuer1 });
        await expect(
          neumark.burn.uint256(13, { from: issuer1 })
        ).to.be.rejectedWith(EvmError);
        await neumark.burn.uint256(12, { from: issuer1 });
      });

      it("should reject to burn with range if above balance", async () => {
        await expect(
          neumark.burn(1, 0, 2, { from: issuer1 })
        ).to.be.rejectedWith(EvmError);
        await neumark.issueForEuro(2, { from: issuer1 });
        await expect(
          neumark.burn(13, 0, 3, { from: issuer1 })
        ).to.be.rejectedWith(EvmError);
        await neumark.burn(12, 0, 3, { from: issuer1 });
      });

      it("should burn with range with low gas cost", async () => {
        // 4000000,2.57759629704150400556252848464617472e7
        // 5000000,3.21504457765812047556165399769811884e7
        const totalEuroUlps = EUR_DECIMALS.mul(5000000);
        const expectedInverseEurDeltaUlps = EUR_DECIMALS.mul(5000000 - 4000000);
        const afterBurnNmk = new BigNumber(
          "2.57759629704150400556252848464617472e7"
        );
        await neumark.issueForEuro(totalEuroUlps, { from: issuer1 });
        const expectedInverseEurUlps = await neumark.cumulativeInverse(
          afterBurnNmk.mul(NMK_DECIMALS),
          0,
          totalEuroUlps
        );
        // calculate incremental nmk burn
        const burnNmk = new BigNumber(
          "3.21504457765812047556165399769811884e7"
        ).sub(afterBurnNmk);
        const burnNmkUlps = NMK_DECIMALS.mul(burnNmk);
        const burnTx = await neumark.burn(
          burnNmkUlps,
          expectedInverseEurUlps.sub(1),
          expectedInverseEurUlps.add(1),
          { from: issuer1 }
        );
        const actualInverseEurDeltaUlps = totalEuroUlps.sub(
          await neumark.totalEuroUlps.call()
        );
        expect(
          actualInverseEurDeltaUlps.sub(expectedInverseEurDeltaUlps).abs()
        ).to.be.bignumber.lt(2);
        await prettyPrintGasCost("Burned gas", burnTx);
      });

      it("should reject to issue Neumark on non-monotonic expansion", async () => {
        const inverseEurUlps = new BigNumber(
          "1.999999999999999999999000000e+27"
        );
        await neumark.issueForEuro(inverseEurUlps, { from: issuer1 });
        const delta = 50;
        await expect(
          neumark.issueForEuro(delta, { from: issuer1 })
        ).to.be.rejectedWith(EvmError);
      });

      it("should reject to burn Neumark on non-monotonic inverse", async () => {
        const inverseEurUlps = new BigNumber(
          "1.999999999999999999999000000e+27"
        );
        await neumark.issueForEuro(inverseEurUlps, { from: issuer1 });
        const newEurUlps = new BigNumber("1.999999999999999999999000050e+27");
        const deltaNmk = 3;
        // here we point to non-monotonic point
        await expect(
          neumark.burn(deltaNmk, newEurUlps, newEurUlps, { from: issuer1 })
        ).to.be.rejectedWith(EvmError);
        // for wide binary search, it is much less probable to hit such point, below will pass
        await neumark.burn.uint256(deltaNmk, { from: issuer1 });
      });

      it("should reject to issue Neumark for not allowed address", async () => {
        const euroUlps = EUR_DECIMALS.mul(1000000);
        // replace 'other' with 'issuer1' for this test to fails
        await expect(
          neumark.issueForEuro(euroUlps, { from: other })
        ).to.be.rejectedWith(EvmError);
      });

      it("should reject to distribute Neumark when called without permission", async () => {
        const euroUlps = EUR_DECIMALS.mul(1000000);
        const totNMK = await neumark.cumulative(euroUlps);
        await neumark.issueForEuro(euroUlps, { from: issuer1 });
        // comment this line for this test to fail ....
        await neumark.distribute(other, totNMK, { from: issuer1 });
        // and replace 'other' with 'issuer1' for this test to fail
        await expect(
          neumark.distribute(accounts[0], totNMK, { from: other })
        ).to.be.rejectedWith(EvmError);
      });

      it("should transfer Neumarks", async () => {
        await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from: issuer1 });
        const amount = await neumark.balanceOf.call(issuer1);

        await neumark.distribute(accounts[0], amount, { from: issuer1 });
        // enable transfers as neumark is created without transfers enabled
        await neumark.enableTransfer(true, { from: transferAdmin });

        const tx = await neumark.transfer(accounts[1], amount, {
          from: accounts[0]
        });
        await prettyPrintGasCost("Transfer", tx);

        const balance0 = await neumark.balanceOf.call(accounts[0]);
        const balance1 = await neumark.balanceOf.call(accounts[1]);
        expect(amount).to.be.bignumber.not.equal(0);
        expect(balance0).to.be.bignumber.equal(0);
        expect(balance1).to.be.bignumber.equal(amount);
      });

      it("should accept agreement on issue Neumarks", async () => {
        const tx = await neumark.issueForEuro(EUR_DECIMALS.mul(100), {
          from: issuer1
        });

        const agreements = tx.logs
          .filter(e => e.event === "LogAgreementAccepted")
          .map(({ args: { accepter } }) => accepter);

        expect(agreements).to.have.length(1);
        expect(agreements).to.contain(issuer1);
        expectAgreementAccepted(issuer1, tx);
      });

      it("should accept agreement on transfer", async () => {
        const from = accounts[0];
        const to = accounts[1];
        await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from: issuer1 });
        const amount = await neumark.balanceOf.call(issuer1);
        await neumark.enableTransfer(true, { from: transferAdmin });
        // 'from' address will not be passively signed up here (as transfer was used, not distribute)
        await neumark.transfer(from, amount, { from: issuer1 });

        // 'from' is making first transaction over Neumark, this will sign it up
        const tx = await neumark.transfer(to, amount, { from });

        const agreements = tx.logs
          .filter(e => e.event === "LogAgreementAccepted")
          .map(({ args: { accepter } }) => accepter);

        expect(agreements).to.have.length(1);
        expect(agreements).to.contain(from);
        expectAgreementAccepted(from, tx);
        // 'to' should not be passively signed
        const toSignedAt = await neumark.agreementSignedAtBlock.call(to);
        expect(toSignedAt).to.be.bignumber.eq(0);
      });

      it("should accept agreement on distribute Neumarks", async () => {
        const from = accounts[0];
        await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from: issuer1 });
        const amount = await neumark.balanceOf.call(issuer1);

        // 'from' address should be signed up here, this is how distribute differs from transfer
        const tx = await neumark.distribute(from, amount, {
          from: issuer1
        });
        const agreements = tx.logs
          .filter(e => e.event === "LogAgreementAccepted")
          .map(({ args: { accepter } }) => accepter);

        expect(agreements).to.have.length(1);
        expect(agreements).to.contain(from);
        expectAgreementAccepted(from, tx);
      });

      it("should accept agreement on approve", async () => {
        const to = accounts[0];
        await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from: issuer1 });
        const amount = await neumark.balanceOf.call(issuer1);
        // 'to' address will not be passively signed up here (transfer used, not distribute)
        await neumark.transfer(to, amount, { from: issuer1 });

        // 'to' is making first transaction over Neumark, this will sign it up
        const tx = await neumark.approve(issuer1, amount, { from: to });

        const agreements = tx.logs
          .filter(e => e.event === "LogAgreementAccepted")
          .map(({ args: { accepter } }) => accepter);

        expect(agreements).to.have.length(1);
        expect(agreements).to.contain(to);
        expectAgreementAccepted(to, tx);
      });

      it("should reject to transfer Neumarks when transfers disabled", async () => {
        const investor = accounts[0];
        const investor2 = accounts[1];
        await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from: issuer1 });
        const amount = await neumark.balanceOf.call(issuer1);
        await neumark.distribute(investor, amount, { from: issuer1 });
        await neumark.enableTransfer(false, { from: transferAdmin });

        const tx = neumark.transfer(investor2, amount, { from: investor });
        await expect(tx).to.be.rejectedWith(EvmError);
      });

      it("should distribute Neumarks when transfers disabled", async () => {
        await neumark.issueForEuro(EUR_DECIMALS.mul(100), { from: issuer1 });
        const amount = await neumark.balanceOf.call(issuer1);
        await neumark.enableTransfer(false, { from: transferAdmin });

        await neumark.distribute(accounts[0], amount, { from: issuer1 });
        const account0Balance = await neumark.balanceOf.call(accounts[0]);
        expect(account0Balance).to.be.bignumber.eq(amount);
      });
    });

    describe("IBasicToken tests", () => {
      const initialBalanceNmk = NMK_DECIMALS.mul(1128192.2791827).round();
      const getToken = () => neumark;

      beforeEach(async () => {
        await initNeumarkBalance(initialBalanceNmk, accounts[0]);
        // enable transfers for token tests
        await neumark.enableTransfer(true, { from: transferAdmin });
      });

      basicTokenTests(getToken, accounts[0], accounts[1], initialBalanceNmk);
    });

    describe("IERC20Allowance tests", () => {
      const initialBalanceNmk = NMK_DECIMALS.mul(91279837.398827).round();
      const getToken = () => neumark;

      beforeEach(async () => {
        await initNeumarkBalance(initialBalanceNmk, accounts[0]);
        // enable transfers for token tests
        await neumark.enableTransfer(true, { from: transferAdmin });
      });

      standardTokenTests(
        getToken,
        accounts[0],
        accounts[1],
        accounts[2],
        initialBalanceNmk
      );
    });

    describe("IERC677Token tests", () => {
      const initialBalanceNmk = NMK_DECIMALS.mul(91279837.398827).round();
      const getToken = () => neumark;
      let erc667cb;
      const getTestErc667cb = () => erc667cb;

      beforeEach(async () => {
        await initNeumarkBalance(initialBalanceNmk, accounts[0]);
        erc667cb = await deployTestErc677Callback();
        // enable transfers for token tests
        await neumark.enableTransfer(true, { from: transferAdmin });
      });

      erc677TokenTests(
        getToken,
        getTestErc667cb,
        accounts[0],
        initialBalanceNmk
      );
    });

    describe("IERC223Token tests", () => {
      const initialBalanceNmk = NMK_DECIMALS.mul(91279837.398827).round();
      const getToken = () => neumark;

      beforeEach(async () => {
        await initNeumarkBalance(initialBalanceNmk, accounts[0]);
        // enable transfers for token tests
        await neumark.enableTransfer(true, { from: transferAdmin });
      });

      erc223TokenTests(getToken, accounts[0], accounts[1], initialBalanceNmk);
    });

    describe("ITokenSnapshots tests", () => {
      const getToken = () => neumark;

      const advanceSnapshotId = async snapshotable => {
        await snapshotable.createSnapshot({ from: deployer });
        // await increaseTime(24*60*60 + 1);
        return snapshotable.currentSnapshotId.call();
      };

      const createClone = async (parentToken, parentSnapshotId) =>
        TestSnapshotToken.new(parentToken.address, parentSnapshotId);

      beforeEach(async () => {
        await neumark.enableTransfer(true, { from: transferAdmin });
      });

      snapshotTokenTests(
        getToken,
        createClone,
        advanceSnapshotId,
        accounts[0],
        accounts[1],
        accounts[2]
      );
    });
  }
);
