import invariant from "invariant";
import { MONTH, closeFutureDate, furtherFutureDate } from "./latestTime";
import { etherToWei } from "./unitConverter";

const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const NeumarkController = artifacts.require("NeumarkController");
const Neumark = artifacts.require("Neumark");
const Curve = artifacts.require("Curve");
const TestCommitment = artifacts.require("TestCommitment");
const WhitelistedCommitment = artifacts.require("WhitelistedCommitment");
const FeeDistributionPool = artifacts.require("FeeDistributionPool");

export async function deployAllContracts(
  { lockedAccountCfg = {}, commitmentCfg = {} } = {}
) {
  const { unlockDateMonths = 18, unlockPenalty = 0.1 } = lockedAccountCfg;

  const {
    startTimestamp = closeFutureDate(),
    duration = MONTH,
    minCommitment = etherToWei(10),
    maxCommitment = etherToWei(1000),
    minTicket = etherToWei(1),
    eurEthRate = etherToWei(218.1192809),
    whitelistedInvestors,
    fixedInvestors,
    fixedTickets
  } = commitmentCfg;

  const etherToken = await EtherToken.new();
  const neumark = await Neumark.new();
  const neumarkController = await NeumarkController.new(neumark.address);
  await neumark.changeController(neumarkController.address);
  const curve = await Curve.new(neumarkController.address);

  const lockedAccount = await LockedAccount.new(
    etherToken.address,
    curve.address,
    unlockDateMonths * MONTH,
    etherToWei(1).mul(unlockPenalty).round()
  );
  const feePool = await FeeDistributionPool.new(
    etherToken.address,
    neumark.address
  );

  const commitment = await WhitelistedCommitment.new(
    startTimestamp,
    startTimestamp + duration,
    minCommitment,
    maxCommitment,
    minTicket,
    eurEthRate,
    etherToken.address,
    lockedAccount.address,
    curve.address
  );

  if (fixedInvestors || fixedTickets) {
    invariant(
      fixedInvestors && fixedTickets,
      "Both fixedInvestors and fixedTickets has to be provided"
    );
    await commitment.setFixed(fixedInvestors, fixedTickets);
  }

  if (whitelistedInvestors) {
    await commitment.setWhitelist(whitelistedInvestors);
  }

  await lockedAccount.setController(commitment.address);

  return {
    etherToken,
    neumark,
    neumarkController,
    curve,
    lockedAccount,
    commitment
  };
}
