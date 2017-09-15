import { expect } from "chai";
import EvmError from "./helpers/EVMThrow";
import { mineBlock, increaseTime } from "./helpers/evmCommands";
import { latestTimestamp } from "./helpers/latestTime";
import createAccessPolicy from "./helpers/createAccessPolicy";
import roles from "./helpers/roles";
import { prettyPrintGasCost } from "./helpers/gasUtils";

const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const Neumark = artifacts.require("./Neumark.sol");
const EtherToken = artifacts.require("./EtherToken.sol");
const EuroToken = artifacts.require("./EuroToken.sol");
const LockedAccount = artifacts.require("./LockedAccount.sol");
const Commitment = artifacts.require("./Commitment.sol");

const Token = { Ether: 1, Euro: 2 };
const BEFORE_DURATION = 5 * 24 * 60 * 60;
const WHITELIST_DURATION = 5 * 24 * 60 * 60;
const PUBLIC_DURATION = 30 * 24 * 60 * 60;
const PLATFORM_SHARE = web3.toBigNumber("2");

const WHITELIST_START = BEFORE_DURATION;
const PUBLIC_START = WHITELIST_START + WHITELIST_DURATION;
const FINISHED_START = PUBLIC_START + PUBLIC_DURATION;
const divRound = (v, d) => d.divToInt(2).plus(v).divToInt(d);

const Q18 = web3.toBigNumber("10").pow(18);
const AGREEMENT = "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT";
const LOCK_DURATION = 18 * 30 * 24 * 60 * 60;
const PENALTY_FRACTION = web3.toBigNumber("0.1").mul(Q18);
const CAP_EUR = web3.toBigNumber("200000000").mul(Q18);
const MIN_TICKET_EUR = web3.toBigNumber("300").mul(Q18);
const ETH_EUR_FRACTION = web3.toBigNumber("300").mul(Q18);
const ethToEur = eth => eth.mul(ETH_EUR_FRACTION).div(Q18);
const eurToEth = eur => eur.mul(Q18).divToInt(ETH_EUR_FRACTION);
const platformShare = nmk => nmk.divToInt(PLATFORM_SHARE);
const investorShare = nmk => nmk.sub(platformShare(nmk));
const MIN_TICKET_ETH = eurToEth(MIN_TICKET_EUR);

contract(
  "Commitment",
  (
    [
      deployer, // eslint-disable-line no-unused-vars
      platform,
      whitelistAdmin,
      lockedAccountAdmin,
      eurtDepositManager,
      other,
      ...investors
    ]
  ) => {
    let rbac;
    let forkArbiter;
    let neumark;
    let etherToken;
    let euroToken;
    let etherLock;
    let euroLock;
    let commitment;

    describe("Contract", async () => {
      beforeEach(async () => {
        const now = await latestTimestamp();
        const startDate = now + BEFORE_DURATION;
        rbac = await createAccessPolicy();
        forkArbiter = await EthereumForkArbiter.new(rbac.address);
        neumark = await Neumark.new(
          rbac.address,
          forkArbiter.address,
          AGREEMENT
        );
        etherToken = await EtherToken.new(rbac.address);
        euroToken = await EuroToken.new(rbac.address);
        etherLock = await LockedAccount.new(
          rbac.address,
          forkArbiter.address,
          AGREEMENT,
          etherToken.address,
          neumark.address,
          LOCK_DURATION,
          PENALTY_FRACTION
        );
        euroLock = await LockedAccount.new(
          rbac.address,
          forkArbiter.address,
          AGREEMENT,
          euroToken.address,
          neumark.address,
          LOCK_DURATION,
          PENALTY_FRACTION
        );
        commitment = await Commitment.new(
          rbac.address,
          startDate,
          platform,
          neumark.address,
          etherToken.address,
          euroToken.address,
          etherLock.address,
          euroLock.address,
          CAP_EUR,
          MIN_TICKET_EUR,
          ETH_EUR_FRACTION
        );
        await rbac.set([
          { subject: whitelistAdmin, role: roles.whitelistAdmin },
          { subject: lockedAccountAdmin, role: roles.lockedAccountAdmin },
          { subject: eurtDepositManager, role: roles.eurtDepositManager },
          { subject: commitment.address, role: roles.neumarkIssuer },
          { subject: commitment.address, role: roles.neumarkBurner },
          { subject: commitment.address, role: roles.transferAdmin },
          { subject: commitment.address, role: roles.transferer }
        ]);
        await etherLock.setController(commitment.address, {
          from: lockedAccountAdmin
        });
        await euroLock.setController(commitment.address, {
          from: lockedAccountAdmin
        });

        await euroToken.setAllowedTransferFrom(investors[0], true, {
          from: eurtDepositManager
        });
        await euroToken.setAllowedTransferFrom(other, true, {
          from: eurtDepositManager
        });
        await euroToken.setAllowedTransferFrom(commitment.address, true, {
          from: eurtDepositManager
        });
        await euroToken.setAllowedTransferTo(commitment.address, true, {
          from: eurtDepositManager
        });
        await euroToken.setAllowedTransferTo(euroLock.address, true, {
          from: eurtDepositManager
        });
      });

      it("should deploy", async () => {
        await prettyPrintGasCost("EuroToken deploy", commitment);
      });

      describe("Whitelist", async () => {
        it("should accept whitelist with zero investors", async () => {
          const tx = await commitment.addWhitelisted([], [], [], {
            from: whitelistAdmin
          });

          await prettyPrintGasCost("addWhitelisted", tx);
        });

        it("should accept whitelist with one investor", async () => {
          const N = 1;
          const whitelisted = Array(N).fill(0).map((_, i) => `0xFF${i}`);
          const tokens = Array(N)
            .fill(0)
            .map((_, i) => (i % 2 ? Token.Ether : Token.Euro));
          const amounts = Array(N)
            .fill(0)
            .map((_, i) =>
              web3.toBigNumber(i * i).mul(Q18).plus(MIN_TICKET_EUR)
            );
          const tx = await commitment.addWhitelisted(
            whitelisted,
            tokens,
            amounts,
            { from: whitelistAdmin }
          );

          await prettyPrintGasCost("addWhitelisted", tx);
        });

        it("should append whitelist twice", async () => {
          const N = 2;
          const whitelisted = Array(N).fill(0).map((_, i) => `0xFF${i}`);
          const tokens = Array(N)
            .fill(0)
            .map((_, i) => (i % 2 ? Token.Ether : Token.Euro));
          const amounts = Array(N)
            .fill(0)
            .map((_, i) =>
              web3.toBigNumber(i * i).mul(Q18).plus(MIN_TICKET_EUR)
            );

          await commitment.addWhitelisted(
            [whitelisted[0]],
            [tokens[0]],
            [amounts[0]],
            { from: whitelistAdmin }
          );
          await commitment.addWhitelisted(
            [whitelisted[1]],
            [tokens[1]],
            [amounts[1]],
            { from: whitelistAdmin }
          );
        });

        it("should accept whitelist with 100 investors", async () => {
          const N = 100;
          const whitelisted = Array(N).fill(0).map((_, i) => `0xFF${i}`);
          const tokens = Array(N)
            .fill(0)
            .map((_, i) => (i % 2 ? Token.Ether : Token.Euro));
          const amounts = Array(N)
            .fill(0)
            .map((_, i) =>
              web3.toBigNumber(i * i).mul(Q18).plus(MIN_TICKET_EUR)
            );

          for (let i = 0; i < N; i += 25) {
            await commitment.addWhitelisted(
              whitelisted.slice(i, i + 25),
              tokens.slice(i, i + 25),
              amounts.slice(i, i + 25),
              { from: whitelistAdmin }
            );
          }
        });

        it("should accept whitelist only from whitelist admin", async () => {
          const tx = commitment.addWhitelisted([], [], [], {
            from: other
          });

          expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should accept whitelist only during Before", async () => {
          await increaseTime(BEFORE_DURATION);

          const tx = commitment.addWhitelisted([], [], [], {
            from: whitelistAdmin
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should pre-allocate Nmk for whitelist with Ether and Euro", async () => {
          const whitelisted = [investors[0], investors[1]];
          const tokens = [Token.Ether, Token.Euro];
          const amounts = [MIN_TICKET_EUR.mul(3), MIN_TICKET_EUR.mul(5)];
          const expectedEur = amounts[0]
            .mul(ETH_EUR_FRACTION)
            .div(Q18)
            .plus(amounts[1]);
          const expectedNmk = await neumark.cumulative(expectedEur);
          await commitment.addWhitelisted(whitelisted, tokens, amounts, {
            from: whitelistAdmin
          });

          const totalEur = await neumark.totalEuroUlps();
          const totalNmk = await neumark.totalSupply();
          const whitelistNmk = await neumark.balanceOf(commitment.address);

          expect(totalEur).to.be.bignumber.eq(expectedEur);
          expect(totalNmk).to.be.bignumber.eq(expectedNmk);
          expect(whitelistNmk).to.be.bignumber.eq(expectedNmk);
        });

        it("should not accept the same investor twice", async () => {
          await commitment.addWhitelisted(
            [investors[0]],
            [Token.Euro],
            [MIN_TICKET_EUR.mul(2)],
            { from: whitelistAdmin }
          );

          const tx = commitment.addWhitelisted(
            [investors[0]],
            [Token.Euro],
            [MIN_TICKET_EUR.mul(2)],
            { from: whitelistAdmin }
          );

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should accept zero tickets", async () => {
          await commitment.addWhitelisted(
            [investors[0], investors[1]],
            [Token.Euro, Token.Ether],
            [0, 0],
            { from: whitelistAdmin }
          );
        });

        it("should not accept too small euro tickets", async () => {
          const tx = commitment.addWhitelisted(
            [investors[0]],
            [Token.Euro],
            [MIN_TICKET_EUR.sub(1)],
            { from: whitelistAdmin }
          );

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should not accept too small ether tickets", async () => {
          const tx = commitment.addWhitelisted(
            [investors[0]],
            [Token.Euro],
            [MIN_TICKET_EUR.sub(1).mul(Q18).div(ETH_EUR_FRACTION)],
            { from: whitelistAdmin }
          );

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should accept up to including cap", async () => {
          await commitment.addWhitelisted(
            [investors[0]],
            [Token.Euro],
            [CAP_EUR],
            { from: whitelistAdmin }
          );
        });

        it("Should not go over cap with one huge ticket", async () => {
          const tx = commitment.addWhitelisted(
            [investors[0]],
            [Token.Euro],
            [CAP_EUR.plus(1)],
            { from: whitelistAdmin }
          );

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("Should not go over cap with a small ticket", async () => {
          await commitment.addWhitelisted(
            [investors[0]],
            [Token.Euro],
            [CAP_EUR],
            { from: whitelistAdmin }
          );

          const tx = commitment.addWhitelisted(
            [investors[1]],
            [Token.Euro],
            [MIN_TICKET_EUR.plus(1)],
            { from: whitelistAdmin }
          );

          await expect(tx).to.be.rejectedWith(EvmError);
        });
      });

      describe("Abort", async () => {
        beforeEach(async () => {
          await commitment.addWhitelisted(
            [investors[0], investors[1]],
            [Token.Ether, Token.Euro],
            [MIN_TICKET_EUR.mul(10), MIN_TICKET_EUR.mul(10)],
            { from: whitelistAdmin }
          );
        });

        it("should abort", async () => {
          await commitment.abort({ from: whitelistAdmin });
        });

        it("should abort only by whitelist admin", async () => {
          const tx = commitment.abort({ from: other });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should abort only Before", async () => {
          await increaseTime(WHITELIST_START);

          const tx = commitment.abort({ from: whitelistAdmin });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should burn neumarks on abort", async () => {
          await commitment.abort({ from: whitelistAdmin });

          const nmks = await neumark.balanceOf(commitment.address);

          expect(nmks).to.be.bignumber.eq(0);
        });

        it("should selfdestruct on abort");
      });

      describe("Timed transtitions", async () => {
        const amountEth = MIN_TICKET_EUR.mul(10);
        const amountEur = MIN_TICKET_EUR.mul(10);
        let neumarksEth;
        let neumarksEur;

        beforeEach(async () => {
          const ethEur = amountEth.mul(ETH_EUR_FRACTION).div(Q18);
          neumarksEth = await neumark.cumulative(ethEur);
          const totalNmk = await neumark.cumulative(ethEur.plus(amountEur));
          neumarksEur = totalNmk.sub(neumarksEth);
          await commitment.addWhitelisted(
            [investors[0], investors[1]],
            [Token.Ether, Token.Euro],
            [amountEth, amountEur],
            { from: whitelistAdmin }
          );

          // TODO: Fullfill some
        });

        it("should roll back unfulfilled Ether tickets on Public", async () => {
          await increaseTime(PUBLIC_START);

          const tx = await commitment.handleTimedTransitions();
          const nmks = await neumark.balanceOf(commitment.address);

          await prettyPrintGasCost("handleTimedTransitions", tx);
          expect(nmks).to.be.bignumber.eq(neumarksEur);
        });

        it("should roll back unfulfilled Euro tickets on Finished", async () => {
          await increaseTime(FINISHED_START);

          const tx = await commitment.handleTimedTransitions();
          const nmks = await neumark.balanceOf(commitment.address);

          await prettyPrintGasCost("handleTimedTransitions", tx);
          expect(nmks).to.be.bignumber.eq(0);
        });

        it("should enable Neumark trading on Finished", async () => {
          await increaseTime(FINISHED_START);

          await commitment.handleTimedTransitions();
          const enabled = await neumark.transferEnabled();

          expect(enabled).to.be.true;
        });

        it("should enable escape hatches on Finished");
      });

      describe("Estimate neumark reward", async () => {
        it("should compute from current curve", async () => {
          await commitment.addWhitelisted(
            [investors[0]],
            [Token.Euro],
            [MIN_TICKET_EUR.mul(5)],
            { from: whitelistAdmin }
          );
          const amountEth = MIN_TICKET_EUR.mul(11);
          const amountEur = amountEth.mul(ETH_EUR_FRACTION).divToInt(Q18);
          const totalNmk = await neumark.incremental(amountEur);
          const platformNmk = totalNmk.divToInt(PLATFORM_SHARE);
          const investorNmk = totalNmk.sub(platformNmk);

          const estimate = await commitment.estimateNeumarkReward(amountEth);

          expect(estimate).to.be.bignumber.eq(investorNmk);
        });
      });

      describe("Commit ether not whitelisted", async () => {
        const investor = investors[0];
        const amountEth = Q18.mul(100);
        const amountEur = amountEth.mul(ETH_EUR_FRACTION).div(Q18);
        let expectedTotalNmk;
        let expectedInvestorNmk;
        let expectedPlatformNmk;

        beforeEach(async () => {
          expectedTotalNmk = await neumark.cumulative(amountEur);
          expectedPlatformNmk = divRound(expectedTotalNmk, PLATFORM_SHARE);
          expectedInvestorNmk = expectedTotalNmk.sub(expectedPlatformNmk);
        });

        it("should commit during Public", async () => {
          await increaseTime(PUBLIC_START);

          const tx = await commitment.commit({
            from: investor,
            value: amountEth
          });

          await prettyPrintGasCost("commit", tx);
        });

        it("should not commit during Whitelist", async () => {
          await increaseTime(WHITELIST_START);

          const tx = commitment.commit({ from: investor, value: amountEth });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should not commit during Before", async () => {
          const tx = commitment.commit({
            from: investor,
            value: amountEth
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should not commit during Finished", async () => {
          await increaseTime(FINISHED_START);

          const tx = commitment.commit({
            from: investor,
            value: amountEth
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should not commit less than min ticket", async () => {
          const small = MIN_TICKET_ETH.sub(1);
          await increaseTime(PUBLIC_START);

          const tx = commitment.commit({ from: investor, value: small });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should commit from curve", async () => {
          const otherAmount = MIN_TICKET_EUR.mul(10);
          await increaseTime(PUBLIC_START);
          await commitment.commit({ from: other, value: otherAmount });
          const curveNmk = investorShare(
            await neumark.incremental(ethToEur(amountEth))
          );

          await commitment.commit({ from: investor, value: amountEth });
          const investorNmk = await neumark.balanceOf(investor);

          expect(investorNmk).to.be.bignumber.eq(curveNmk);
        });

        it("should not commit over cap", async () => {
          const capEth = CAP_EUR.mul(Q18).divToInt(ETH_EUR_FRACTION);
          await increaseTime(PUBLIC_START);

          const tx = commitment.commit({ from: other, value: capEth.plus(1) });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should issue Neumark", async () => {
          await increaseTime(PUBLIC_START);

          await commitment.commit({ from: investor, value: amountEth });
          const investorNmk = await neumark.balanceOf(investor);

          expect(investorNmk).to.be.bignumber.eq(expectedInvestorNmk);
        });

        it("should lock EtherToken", async () => {
          await increaseTime(PUBLIC_START);
          await mineBlock();
          const now = await latestTimestamp();
          const expectUnlockDate = now + LOCK_DURATION;
          const epsilon = 3600;

          await commitment.commit({
            from: investor,
            value: amountEth
          });
          const lockEth = await etherToken.balanceOf(etherLock.address);
          const [balance, neumarksDue, unlockDate] = await etherLock.balanceOf(
            investor
          );

          expect(balance).to.be.bignumber.eq(amountEth);
          expect(neumarksDue).to.be.bignumber.eq(expectedInvestorNmk);
          expect(unlockDate.sub(expectUnlockDate).abs()).to.be.bignumber.lt(
            epsilon
          );
          expect(lockEth).to.be.bignumber.eq(amountEth);
        });

        it("should commit EtherToken", async () => {
          await increaseTime(PUBLIC_START);

          await etherToken.deposit({
            from: investor,
            value: amountEth
          });
          await etherToken.approve(commitment.address, amountEth, {
            from: investor
          });
          await commitment.commit({ from: investor });
          const investorNmk = await neumark.balanceOf(investor);
          const platformNmk = await neumark.balanceOf(platform);

          expect(investorNmk).to.be.bignumber.eq(expectedInvestorNmk);
          expect(platformNmk).to.be.bignumber.eq(expectedPlatformNmk);
        });

        it("should commit Ether and EtherToken", async () => {
          const lessAmount = amountEth.divToInt(3);
          const remainder = amountEth.sub(lessAmount);
          await increaseTime(PUBLIC_START);

          await etherToken.deposit({
            from: investor,
            value: lessAmount
          });
          await etherToken.approve(commitment.address, lessAmount, {
            from: investor
          });
          await commitment.commit({ from: investor, value: remainder });
          const investorNmk = await neumark.balanceOf(investor);
          const platformNmk = await neumark.balanceOf(platform);

          expect(investorNmk).to.be.bignumber.eq(expectedInvestorNmk);
          expect(platformNmk).to.be.bignumber.eq(expectedPlatformNmk);
        });
      });

      describe("Commit ether whitelisted", async () => {
        const investor = investors[0];
        const amountEth = Q18.mul(100);
        const amountEur = amountEth.mul(ETH_EUR_FRACTION).div(Q18);
        let expectedTotalNmk;
        let expectedPlatformNmk;
        let expectedInvestorNmk;

        beforeEach(async () => {
          expectedTotalNmk = await neumark.cumulative(amountEur);
          expectedPlatformNmk = divRound(expectedTotalNmk, PLATFORM_SHARE);
          expectedInvestorNmk = expectedTotalNmk.sub(expectedPlatformNmk);
          await commitment.addWhitelisted(
            [investor],
            [Token.Ether],
            [amountEth],
            { from: whitelistAdmin }
          );
        });

        it("should commit during Whitelist", async () => {
          await increaseTime(WHITELIST_START);

          const tx = await commitment.commit({
            from: investor,
            value: amountEth
          });

          await prettyPrintGasCost("commit", tx);
        });

        it("should commit during Public", async () => {
          await increaseTime(PUBLIC_START);

          await commitment.commit({
            from: investor,
            value: amountEth
          });
        });

        it("should not commit during Before", async () => {
          const tx = commitment.commit({
            from: investor,
            value: amountEth
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should not commit during Finished", async () => {
          await increaseTime(FINISHED_START);

          const tx = commitment.commit({
            from: investor,
            value: amountEth
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should receive neumarks from ticket", async () => {
          await increaseTime(WHITELIST_START);

          await commitment.commit({
            from: investor,
            value: amountEth
          });
          const investorNmk = await neumark.balanceOf(investor);
          const platformNmk = await neumark.balanceOf(platform);

          expect(investorNmk).to.be.bignumber.eq(expectedInvestorNmk);
          expect(platformNmk).to.be.bignumber.eq(expectedPlatformNmk);
        });

        it("should commit less than ticket proportionally", async () => {
          const lessAmount = amountEth.divToInt(3);
          const lessInv = expectedInvestorNmk.divToInt(3);
          const lessPlt = expectedPlatformNmk.divToInt(3);
          const epsilon = web3.toBigNumber("1000");
          await increaseTime(WHITELIST_START);

          await commitment.commit({
            from: investor,
            value: lessAmount
          });
          const investorNmk = await neumark.balanceOf(investor);
          const platformNmk = await neumark.balanceOf(platform);

          // Inexact due to complex rounding. We should be within epsilon of
          // the expected result
          expect(investorNmk.sub(lessInv).abs()).to.be.bignumber.lt(epsilon);
          expect(platformNmk.sub(lessPlt).abs()).to.be.bignumber.lt(epsilon);
        });

        it("should commit in tranches exactly", async () => {
          const lessAmount = amountEth.divToInt(3);
          const remainder = amountEth.sub(lessAmount);
          await increaseTime(WHITELIST_START);

          await commitment.commit({
            from: investor,
            value: lessAmount
          });
          await commitment.commit({
            from: investor,
            value: remainder
          });
          const investorNmk = await neumark.balanceOf(investor);
          const platformNmk = await neumark.balanceOf(platform);

          // Total result should be exact.
          expect(investorNmk).to.be.bignumber.eq(expectedInvestorNmk);
          expect(platformNmk).to.be.bignumber.eq(expectedPlatformNmk);
        });

        it("should commit more than ticket", async () => {
          const addedEth = Q18.mul(50);
          const moreEth = amountEth.plus(addedEth);
          const addedNmk = investorShare(
            await neumark.incremental(ethToEur(addedEth))
          );
          const expectedNmk = expectedInvestorNmk.plus(addedNmk);
          const epsilon = web3.toBigNumber("10");
          await increaseTime(WHITELIST_START);

          await commitment.commit({
            from: investor,
            value: moreEth
          });
          const investorNmk = await neumark.balanceOf(investor);

          expect(investorNmk.sub(expectedNmk)).to.be.bignumber.lt(epsilon);
        });

        it("should commit only from curve during Public", async () => {
          const otherEth = MIN_TICKET_EUR.mul(10);
          await increaseTime(PUBLIC_START);
          await commitment.commit({ value: otherEth, from: other });
          const curveNmk = investorShare(
            await neumark.incremental(ethToEur(amountEth))
          );

          await commitment.commit({
            from: investor,
            value: amountEth
          });
          const investorNmk = await neumark.balanceOf(investor);

          // Total result should be exact.
          expect(investorNmk).to.be.bignumber.eq(curveNmk);
        });

        it("should not commit over cap during Whitelist", async () => {
          const capEth = CAP_EUR.mul(Q18).divToInt(ETH_EUR_FRACTION);
          await increaseTime(WHITELIST_START);

          const tx = commitment.commit({
            from: investor,
            value: capEth.plus(1)
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should not commit over cap during Public", async () => {
          const capEth = CAP_EUR.mul(Q18).divToInt(ETH_EUR_FRACTION);
          await increaseTime(PUBLIC_START);

          const tx = commitment.commit({
            from: investor,
            value: capEth.plus(1)
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });
      });

      describe("Commit euro not whitelisted", async () => {
        const investor = investors[0];
        const amountEur = MIN_TICKET_EUR.mul(10);
        let expectedTotalNmk;
        let expectedInvestorNmk;
        let expectedPlatformNmk;

        beforeEach(async () => {
          expectedTotalNmk = await neumark.cumulative(amountEur);
          expectedPlatformNmk = divRound(expectedTotalNmk, PLATFORM_SHARE);
          expectedInvestorNmk = expectedTotalNmk.sub(expectedPlatformNmk);

          await euroToken.deposit(investor, CAP_EUR.mul(2), {
            from: eurtDepositManager
          });
          await euroToken.approve(commitment.address, amountEur, {
            from: investor
          });
        });

        it("should commit during Public", async () => {
          await increaseTime(PUBLIC_START);

          const tx = await commitment.commitEuro({
            from: investor
          });

          await prettyPrintGasCost("commit", tx);
        });

        it("should not commit during Before", async () => {
          const tx = commitment.commitEuro({
            from: investor
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should not commit during Whitelist", async () => {
          await increaseTime(WHITELIST_START);

          const tx = commitment.commitEuro({
            from: investor
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should not commit during Finished", async () => {
          await increaseTime(FINISHED_START);

          const tx = commitment.commitEuro({
            from: investor
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should not commit less than min ticket", async () => {
          await euroToken.approve(commitment.address, 0, {
            from: investor
          });
          await euroToken.approve(commitment.address, MIN_TICKET_EUR.sub(1), {
            from: investor
          });
          await increaseTime(PUBLIC_START);

          const tx = commitment.commitEuro({
            from: investor
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should not commit over cap", async () => {
          await euroToken.approve(commitment.address, 0, {
            from: investor
          });
          await euroToken.approve(commitment.address, CAP_EUR.add(1), {
            from: investor
          });
          await increaseTime(PUBLIC_START);

          const tx = commitment.commitEuro({
            from: investor
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should issue neumark", async () => {
          await increaseTime(PUBLIC_START);

          await commitment.commitEuro({ from: investor });
          const investorNmk = await neumark.balanceOf(investor);

          expect(investorNmk).to.be.bignumber.eq(expectedInvestorNmk);
        });

        it("should issue neumark from curve", async () => {
          await euroToken.deposit(other, CAP_EUR.mul(2), {
            from: eurtDepositManager
          });
          await euroToken.approve(commitment.address, amountEur, {
            from: other
          });
          await increaseTime(PUBLIC_START);
          await commitment.commitEuro({ from: other });
          const curveNmk = investorShare(await neumark.incremental(amountEur));
          const epsilon = web3.toBigNumber("10");

          await commitment.commitEuro({ from: investor });
          const investorNmk = await neumark.balanceOf(investor);

          expect(investorNmk.sub(curveNmk).abs()).to.be.bignumber.lt(epsilon);
        });

        it("should lock EuroToken", async () => {
          await increaseTime(PUBLIC_START);
          await mineBlock();
          const now = await latestTimestamp();
          const expectUnlockDate = now + LOCK_DURATION;
          const epsilon = 3600;

          await commitment.commitEuro({
            from: investor
          });
          const lockEur = await euroToken.balanceOf(euroLock.address);
          const [balance, neumarksDue, unlockDate] = await euroLock.balanceOf(
            investor
          );

          expect(balance).to.be.bignumber.eq(amountEur);
          expect(neumarksDue).to.be.bignumber.eq(expectedInvestorNmk);
          expect(unlockDate.sub(expectUnlockDate).abs()).to.be.bignumber.lt(
            epsilon
          );
          expect(lockEur).to.be.bignumber.eq(amountEur);
        });
      });

      describe("Commit euro whitelisted", async () => {
        const investor = investors[0];
        const amountEur = MIN_TICKET_EUR.mul(10);
        let expectedTotalNmk;
        let expectedInvestorNmk;
        let expectedPlatformNmk;

        beforeEach(async () => {
          expectedTotalNmk = await neumark.cumulative(amountEur);
          expectedPlatformNmk = divRound(expectedTotalNmk, PLATFORM_SHARE);
          expectedInvestorNmk = expectedTotalNmk.sub(expectedPlatformNmk);

          await euroToken.deposit(investor, CAP_EUR.mul(2), {
            from: eurtDepositManager
          });
          await euroToken.approve(commitment.address, amountEur, {
            from: investor
          });
          await commitment.addWhitelisted(
            [investor],
            [Token.Euro],
            [amountEur],
            { from: whitelistAdmin }
          );
        });

        it("should commit during Whitelist", async () => {
          await increaseTime(WHITELIST_START);

          const tx = await commitment.commitEuro({
            from: investor
          });

          await prettyPrintGasCost("commit", tx);
        });

        it("should commit during Public", async () => {
          await increaseTime(PUBLIC_START);

          await commitment.commitEuro({
            from: investor
          });
        });

        it("should not commit during Before", async () => {
          const tx = commitment.commitEuro({
            from: investor
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should not commit during Finished", async () => {
          await increaseTime(FINISHED_START);

          const tx = commitment.commitEuro({
            from: investor
          });

          await expect(tx).to.be.rejectedWith(EvmError);
        });

        it("should receive neumarks from ticket", async () => {
          await increaseTime(PUBLIC_START);
          await commitment.commit({
            from: other,
            value: MIN_TICKET_ETH.mul(10)
          });

          await commitment.commitEuro({ from: investor });
          const nmk = await neumark.balanceOf(investor);

          expect(nmk).to.be.bignumber.eq(expectedInvestorNmk);
        });

        it("should commit less than ticket proportionally", async () => {
          const lessAmount = amountEur.divToInt(3);
          const lessInv = expectedInvestorNmk.divToInt(3);
          const lessPlt = expectedPlatformNmk.divToInt(3);
          const epsilon = web3.toBigNumber("1000");
          await euroToken.approve(commitment.address, 0, { from: investor });
          await euroToken.approve(commitment.address, lessAmount, {
            from: investor
          });
          await increaseTime(WHITELIST_START);

          await commitment.commitEuro({ from: investor });
          const investorNmk = await neumark.balanceOf(investor);
          const platformNmk = await neumark.balanceOf(platform);

          // Inexact due to complex rounding. We should be within epsilon of
          // the expected result
          expect(investorNmk.sub(lessInv).abs()).to.be.bignumber.lt(epsilon);
          expect(platformNmk.sub(lessPlt).abs()).to.be.bignumber.lt(epsilon);
        });

        it("should commit in tranches exactly", async () => {
          const lessAmount = amountEur.divToInt(3);
          const remainder = amountEur.sub(lessAmount);
          await euroToken.approve(commitment.address, 0, { from: investor });
          await euroToken.approve(commitment.address, lessAmount, {
            from: investor
          });
          await increaseTime(WHITELIST_START);

          await commitment.commitEuro({ from: investor });
          await euroToken.approve(commitment.address, remainder, {
            from: investor
          });
          await commitment.commitEuro({ from: investor });
          const investorNmk = await neumark.balanceOf(investor);
          const platformNmk = await neumark.balanceOf(platform);

          // Total result should be exact.
          expect(investorNmk).to.be.bignumber.eq(expectedInvestorNmk);
          expect(platformNmk).to.be.bignumber.eq(expectedPlatformNmk);
        });

        it("should commit more than ticket", async () => {
          const addedEur = Q18.mul(50);
          const moreEur = amountEur.plus(addedEur);
          const addedNmk = investorShare(await neumark.incremental(addedEur));
          const expectedNmk = expectedInvestorNmk.plus(addedNmk);
          const epsilon = web3.toBigNumber("10");
          await euroToken.approve(commitment.address, 0, { from: investor });
          await euroToken.approve(commitment.address, moreEur, {
            from: investor
          });
          await increaseTime(WHITELIST_START);

          await commitment.commitEuro({ from: investor });
          const investorNmk = await neumark.balanceOf(investor);

          expect(investorNmk.sub(expectedNmk)).to.be.bignumber.lt(epsilon);
        });

        it("should not commit over cap", async () => {
          await euroToken.approve(commitment.address, 0, { from: investor });
          await euroToken.approve(commitment.address, CAP_EUR.add(1), {
            from: investor
          });
          await increaseTime(WHITELIST_START);

          const tx = commitment.commit({ from: investor });

          await expect(tx).to.be.rejectedWith(EvmError);
        });
      });
    });

    describe("Mixed commitments", async () => {});
  }
);
