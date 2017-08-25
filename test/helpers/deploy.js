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
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const AccessRoles = artifacts.require("AccessRoles");

export async function deployAllContracts(
  lockAdminAccount,
  whitelistAdminAccount,
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

  const operatorWallet = "0x55d7d863a155f75c5139e20dcbda8d0075ba2a1c";

  const accessControl = await RoleBasedAccessControl.new();
  const accessRoles = await AccessRoles.new();
  const etherToken = await EtherToken.new();
  const neumark = await Neumark.new();
  const neumarkController = await NeumarkController.new(neumark.address);
  await neumark.changeController(neumarkController.address);
  const curve = await Curve.new(neumarkController.address);

  const lockedAccount = await LockedAccount.new(
    accessControl.address,
    etherToken.address,
    curve.address,
    unlockDateMonths * MONTH,
    etherToWei(1).mul(unlockPenalty).round()
  );
  const lockedAccountAdminRole = await accessRoles.ROLE_LOCKED_ACCOUNT_ADMIN();
  await accessControl.setUserRole(
    lockAdminAccount,
    lockedAccountAdminRole,
    lockedAccount.address,
    1
  );
  await lockedAccount.setPenaltyDisbursal(operatorWallet, {
    from: lockAdminAccount
  });

  const commitment = await WhitelistedCommitment.new(
    startTimestamp,
    startTimestamp + duration,
    minCommitment,
    maxCommitment,
    minTicket,
    eurEthRate,
    etherToken.address,
    lockedAccount.address,
    curve.address,
    accessControl.address
  );
  const whitelistAdminRole = await accessRoles.ROLE_WHITELIST_ADMIN();
  await accessControl.setUserRole(
    whitelistAdminAccount,
    whitelistAdminRole,
    commitment.address,
    1
  );

  if (fixedInvestors || fixedTickets) {
    invariant(
      fixedInvestors && fixedTickets,
      "Both fixedInvestors and fixedTickets has to be provided"
    );
    await commitment.setFixed(fixedInvestors, fixedTickets, {
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
    neumarkController,
    curve,
    lockedAccount,
    commitment
  };
}
