import { expect } from "chai";
import EvmError from "./helpers/EVMThrow";
import { closeFutureDate, furterFutureDate } from "./helpers/latestTime";
import { setTimeTo } from "./helpers/increaseTime";
import { etherToWei } from "./helpers/unitConverter";
import { deployAllContracts } from "./helpers/deploy";

contract("WhitelistedCommitment", ([_, owner, ...accounts]) => {
  describe.only("set fixed investors", () => {
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

  describe.only("set whitelisted investors", () => {
    it("should work", () => {

    });

    it("should not be possible to set it twice", () => {});

    it("should work work with fixed investors", () => {});

    it("should not be possible to set it after commitment is started", async () => {});
  });
});
