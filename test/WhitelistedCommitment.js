import { expect } from "chai";
import EvmError from "./helpers/EVMThrow";
import { closeFutureDate, furterFutureDate } from "./helpers/latestTime";
import { setTimeTo } from "./helpers/increaseTime";
import { etherToWei } from "./helpers/unitConverter";
import { deployAllContracts } from "./helpers/deploy";
import { curveInEther } from "./helpers/verification";

contract("WhitelistedCommitment", ([_, owner, ...accounts]) => {
  describe("set fixed investors", () => {
    it("should work", async () => {
      const { commitment, curve } = await deployAllContracts();
      const investors = [accounts[0], accounts[1]];
      const tickets = [etherToWei(1), etherToWei(2)];
      const expectedTicketsSum = tickets[0].add(tickets[1]);
      const expectedTicketsSumInEur = await commitment.convertToEUR(expectedTicketsSum);
      const expectedNeumarkAmmount = await curve.curve(expectedTicketsSumInEur);

      await commitment.setFixed(investors, tickets);

      expect(await commitment.fixedCostInvestors(0)).to.be.eq(investors[0]);
      expect(await commitment.fixedCostInvestors(1)).to.be.eq(investors[1]);
      await expect(commitment.fixedCostInvestors).to.blockchainArrayOfSize(2);

      expect(await commitment.fixedCost(investors[0])).to.be.bignumber.eq(tickets[0]);
      expect(await commitment.fixedCost(investors[1])).to.be.bignumber.eq(tickets[1]);

      expect(await commitment.whitelisted(investors[0])).to.be.bignumber.eq(1);
      expect(await commitment.whitelisted(investors[1])).to.be.bignumber.eq(1);

      expect(await commitment.totalFixedCostAmount()).to.be.bignumber.eq(expectedTicketsSum);
      expect(await commitment.totalFixedCostNeumarks()).to.be.bignumber.eq(expectedNeumarkAmmount);
    });

    it("should not be possible to set it twice", async () => {
      const { commitment, curve } = await deployAllContracts();
      const investors = [accounts[0], accounts[1]];
      const tickets = [etherToWei(1), etherToWei(2)];

      await commitment.setFixed(investors, tickets);

      await expect(commitment.setFixed(investors, tickets)).to.be.rejectedWith(EvmError);
    });

    it("should not be possible to set it after commitment is started", async () => {
      const startingDate = closeFutureDate();
      const { commitment, curve } = await deployAllContracts({
        commitmentCfg: { startTimestamp: startingDate },
      });
      const investors = [accounts[0], accounts[1]];
      const tickets = [etherToWei(1), etherToWei(2)];

      setTimeTo(startingDate);

      await expect(commitment.setFixed(investors, tickets)).to.be.rejectedWith(EvmError);
    });

    it("should not be possible to set it with not matching input", async () => {
      const { commitment, curve } = await deployAllContracts();
      const investors = [accounts[0]];
      const tickets = [etherToWei(1), etherToWei(2)];

      await expect(commitment.setFixed(investors, tickets)).to.be.rejectedWith(EvmError);
    });
  });

  describe("set whitelisted investors", () => {
    it("should work", async () => {
      const { commitment } = await deployAllContracts();
      const investors = [accounts[0], accounts[1]];

      await commitment.setWhitelist(investors);

      expect(await commitment.whitelistedInvestors(0)).to.be.eq(investors[0]);
      expect(await commitment.whitelistedInvestors(1)).to.be.eq(investors[1]);
      await expect(commitment.whitelistedInvestors).to.blockchainArrayOfSize(2);

      expect(await commitment.whitelisted(investors[0])).to.be.bignumber.eq(1);
      expect(await commitment.whitelisted(investors[1])).to.be.bignumber.eq(1);

      expect(await commitment.totalFixedCostAmount()).to.be.bignumber.eq(0);
      expect(await commitment.totalFixedCostNeumarks()).to.be.bignumber.eq(0);
    });

    it("should not be possible to set it twice", async () => {
      const { commitment } = await deployAllContracts();
      const investors = [accounts[0], accounts[1]];

      await commitment.setWhitelist(investors);

      await expect(commitment.setWhitelist(investors)).to.be.rejectedWith(EvmError);
    });

    it("should not be possible to set it after commitment is started", async () => {
      const startingDate = closeFutureDate();
      const { commitment, curve } = await deployAllContracts({
        commitmentCfg: { startTimestamp: startingDate },
      });
      const investors = [accounts[0], accounts[1]];

      setTimeTo(startingDate);

      await expect(commitment.setWhitelist(investors)).to.be.rejectedWith(EvmError);
    });
  });

  describe("set whitelist investor with fixed investors", () => {
    it("should be possible to whitelist investors before fixed investors", async () => {
      const { commitment } = await deployAllContracts();
      const whitelistedInvestors = [accounts[0], accounts[1]];
      const fixedInvestors = [accounts[2]];
      const fixedTickets = [etherToWei(1)];

      await commitment.setWhitelist(whitelistedInvestors);
      await commitment.setFixed(fixedInvestors, fixedTickets);

      expect(await commitment.whitelistedInvestors(0)).to.be.eq(whitelistedInvestors[0]);
      expect(await commitment.whitelistedInvestors(1)).to.be.eq(whitelistedInvestors[1]);
      await expect(commitment.whitelistedInvestors).to.blockchainArrayOfSize(2);

      expect(await commitment.whitelisted(whitelistedInvestors[0])).to.be.bignumber.eq(1);
      expect(await commitment.whitelisted(whitelistedInvestors[1])).to.be.bignumber.eq(1);
      expect(await commitment.whitelisted(fixedInvestors[0])).to.be.bignumber.eq(1);

      expect(await commitment.fixedCostInvestors(0)).to.be.eq(fixedInvestors[0]);
      await expect(commitment.fixedCostInvestors).to.blockchainArrayOfSize(1);

      expect(await commitment.fixedCost(fixedInvestors[0])).to.be.bignumber.eq(fixedTickets[0]);
      expect(await commitment.fixedCost(whitelistedInvestors[0])).to.be.bignumber.eq(0);
      expect(await commitment.fixedCost(whitelistedInvestors[1])).to.be.bignumber.eq(0);
    });

    it("should be possible to whitelist investors after fixed investors", async () => {
      const { commitment } = await deployAllContracts();
      const whitelistedInvestors = [accounts[0], accounts[1]];
      const fixedInvestors = [accounts[2]];
      const fixedTickets = [etherToWei(1)];

      await commitment.setFixed(fixedInvestors, fixedTickets);
      await commitment.setWhitelist(whitelistedInvestors);

      expect(await commitment.whitelistedInvestors(0)).to.be.eq(whitelistedInvestors[0]);
      expect(await commitment.whitelistedInvestors(1)).to.be.eq(whitelistedInvestors[1]);
      await expect(commitment.whitelistedInvestors).to.blockchainArrayOfSize(2);

      expect(await commitment.whitelisted(whitelistedInvestors[0])).to.be.bignumber.eq(1);
      expect(await commitment.whitelisted(whitelistedInvestors[1])).to.be.bignumber.eq(1);
      expect(await commitment.whitelisted(fixedInvestors[0])).to.be.bignumber.eq(1);

      expect(await commitment.fixedCostInvestors(0)).to.be.eq(fixedInvestors[0]);
      await expect(commitment.fixedCostInvestors).to.blockchainArrayOfSize(1);

      expect(await commitment.fixedCost(fixedInvestors[0])).to.be.bignumber.eq(fixedTickets[0]);
      expect(await commitment.fixedCost(whitelistedInvestors[0])).to.be.bignumber.eq(0);
      expect(await commitment.fixedCost(whitelistedInvestors[1])).to.be.bignumber.eq(0);
    });
  });

  describe("fixed size commitment", () => {
    it("should work with ticket below declared", async () => {
      const startingDate = closeFutureDate();
      const investor1 = accounts[0];
      const fixedInvestors = [investor1, accounts[1]];
      const fixedDeclaredTickets = [etherToWei(2), etherToWei(3)];
      const actualInvestor1Commitment = etherToWei(1);
      const expectedTicketsSum = fixedDeclaredTickets[0].add(fixedDeclaredTickets[1]);
      const expectedNeumarkAmmount = await curveInEther(expectedTicketsSum);
      const expectedInvestor1NeumarkShare = expectedNeumarkAmmount
        .mul(actualInvestor1Commitment)
        .div(expectedTicketsSum)
        .div(2)
        .round(0, 4);

      const { commitment, lockedAccount } = await deployAllContracts({
        commitmentCfg: {
          fixedInvestors,
          fixedTickets: fixedDeclaredTickets,
          startTimestamp: startingDate,
        },
      });
      await setTimeTo(startingDate);
      await commitment.commit({ value: actualInvestor1Commitment, from: investor1 });

      expect(await lockedAccount.balanceOf(investor1)).to.be.balanceWith({
        ether: actualInvestor1Commitment,
        neumarks: expectedInvestor1NeumarkShare,
      });
    });

    it("should work with ticket exactly the same as declared", async () => {
      const startingDate = closeFutureDate();
      const investor1 = accounts[0];
      const fixedInvestors = [investor1, accounts[1]];
      const fixedDeclaredTickets = [etherToWei(1.21981798), etherToWei(3)];
      const actualInvestor1Commitment = etherToWei(1.21981798);
      const expectedTicketsSum = fixedDeclaredTickets[0].add(fixedDeclaredTickets[1]);
      const expectedNeumarkAmmount = await curveInEther(expectedTicketsSum);
      const expectedInvestor1NeumarkShare = expectedNeumarkAmmount
        .mul(actualInvestor1Commitment)
        .div(expectedTicketsSum)
        .div(2)
        .round(0, 4);

      const { commitment, lockedAccount } = await deployAllContracts({
        commitmentCfg: {
          fixedInvestors,
          fixedTickets: fixedDeclaredTickets,
          startTimestamp: startingDate,
        },
      });
      await setTimeTo(startingDate);
      await commitment.commit({ value: actualInvestor1Commitment, from: investor1 });

      expect(await lockedAccount.balanceOf(investor1)).to.be.balanceWith({
        ether: actualInvestor1Commitment,
        neumarks: expectedInvestor1NeumarkShare,
      });
    });

    it("should work with ticket bigger then declared", async () => {
      const startingDate = closeFutureDate();
      const investor1 = accounts[0];
      const fixedInvestors = [investor1, accounts[1]];
      const fixedDeclaredTickets = [etherToWei(1), etherToWei(3)];
      const actualInvestor1Commitment = etherToWei(1.21981798);
      const equalShareSize = fixedDeclaredTickets[0];
      const curveShareSize = etherToWei(1.21981798).sub(equalShareSize);
      const expectedTicketsSum = fixedDeclaredTickets[0].add(fixedDeclaredTickets[1]);
      const expectedNeumarkAmmountOnFixedRate = await curveInEther(expectedTicketsSum);
      const expectedNeumarkAmmountOnTheCurve = (await curveInEther(
        expectedTicketsSum.add(curveShareSize)
      )).sub(expectedNeumarkAmmountOnFixedRate);
      const expectedInvestor1NeumarkShare = expectedNeumarkAmmountOnFixedRate
        .mul(equalShareSize)
        .div(expectedTicketsSum)
        .add(expectedNeumarkAmmountOnTheCurve)
        .div(2)
        .round(0, 4);

      const { commitment, lockedAccount } = await deployAllContracts({
        commitmentCfg: {
          fixedInvestors,
          fixedTickets: fixedDeclaredTickets,
          startTimestamp: startingDate,
        },
      });
      await setTimeTo(startingDate);
      await commitment.commit({ value: actualInvestor1Commitment, from: investor1 });

      expect(await lockedAccount.balanceOf(investor1)).to.be.balanceWith({
        ether: actualInvestor1Commitment,
        neumarks: expectedInvestor1NeumarkShare,
      });
    });
  });
});
