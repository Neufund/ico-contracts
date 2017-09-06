import invariant from "invariant";
import { MONTH, closeFutureDate } from "./latestTime";
import { etherToWei } from "./unitConverter";
import { TriState, EVERYONE } from "./triState";
import roles from "./roles";

const LockedAccount = artifacts.require("LockedAccount");
const EtherToken = artifacts.require("EtherToken");
const Neumark = artifacts.require("Neumark");
const WhitelistedCommitment = artifacts.require("WhitelistedCommitment");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");

export default async function deploy(
  lockAdminAccount,
  whitelistAdminAccount,
  { lockedAccountCfg = {}, commitmentCfg = {} } = {}
) {
  invariant(
    lockAdminAccount && whitelistAdminAccount,
    "Both lockAdminAccount and whitelistAdminAccount have to be provided"
  );
  const { unlockDateMonths = 18, unlockPenalty = 0.1 } = lockedAccountCfg;

  const {
    startTimestamp = await closeFutureDate(),
    duration = MONTH,
    minAbsCap = etherToWei(10),
    maxAbsCap = etherToWei(1000),
    minTicket = etherToWei(1),
    eurEthRate = etherToWei(218.1192809),
    operatorWallet = "0x55d7d863a155f75c5139e20dcbda8d0075ba2a1c",
    whitelistedInvestors,
    fixedInvestors,
    fixedTickets
  } = commitmentCfg;

  const accessControl = await RoleBasedAccessControl.new();
  const forkArbiter = await EthereumForkArbiter.new(accessControl.address);
  const etherToken = await EtherToken.new(accessControl.address);
  const neumark = await Neumark.new(
    accessControl.address,
    forkArbiter.address,
    "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT"
  );

  const lockedAccount = await LockedAccount.new(
    accessControl.address,
    forkArbiter.address,
    "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT",
    etherToken.address,
    neumark.address,
    unlockDateMonths * MONTH,
    etherToWei(1).mul(unlockPenalty).round()
  );
  await accessControl.setUserRole(
    lockAdminAccount,
    roles.lockedAccountAdmin,
    lockedAccount.address,
    TriState.Allow
  );
  await lockedAccount.setPenaltyDisbursal(operatorWallet, {
    from: lockAdminAccount
  });

  await accessControl.setUserRole(
    EVERYONE,
    roles.neumarkBurner,
    neumark.address,
    TriState.Allow
  );
  await accessControl.setUserRole(
    EVERYONE,
    roles.snapshotCreator,
    neumark.address,
    TriState.Allow
  );

  const commitment = await WhitelistedCommitment.new(
    accessControl.address,
    etherToken.address,
    lockedAccount.address,
    neumark.address
  );
  await commitment.setCommitmentTerms(
    startTimestamp,
    startTimestamp + duration,
    minAbsCap,
    maxAbsCap,
    minTicket,
    eurEthRate,
    operatorWallet
  );
  await accessControl.setUserRole(
    commitment.address,
    roles.neumarkIssuer,
    neumark.address,
    TriState.Allow
  );
  await accessControl.setUserRole(
    commitment.address,
    roles.transferAdmin,
    neumark.address,
    TriState.Allow
  );

  await accessControl.setUserRole(
    whitelistAdminAccount,
    roles.whitelistAdmin,
    commitment.address,
    TriState.Allow
  );

  if (fixedInvestors || fixedTickets) {
    invariant(
      fixedInvestors && fixedTickets,
      "Both fixedInvestors and fixedTickets has to be provided"
    );
    await commitment.setOrderedWhitelist(fixedInvestors, fixedTickets, {
      from: whitelistAdminAccount
    });
  }

  if (whitelistedInvestors) {
    await commitment.setWhitelist(whitelistedInvestors, {
      from: whitelistAdminAccount
    });
  }

  await lockedAccount.setController(commitment.address, {
    from: lockAdminAccount
  });

  return {
    etherToken,
    neumark,
    lockedAccount,
    commitment
  };
}
