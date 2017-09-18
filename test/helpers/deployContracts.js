import { TriState, EVERYONE } from "./triState";
import roles from "./roles";

const Neumark = artifacts.require("Neumark");
const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");

export const dayInSeconds = 24 * 60 * 60;
export const monthInSeconds = 30 * dayInSeconds;

export async function deployControlContracts() {
  const accessControl = await RoleBasedAccessControl.new();
  const forkArbiter = await EthereumForkArbiter.new(accessControl.address);
  return [accessControl, forkArbiter];
}

export async function deployNeumark(accessControl, forkArbiter) {
  const neumark = await Neumark.new(accessControl.address, forkArbiter.address);
  await accessControl.setUserRole(
    EVERYONE,
    roles.snapshotCreator,
    neumark.address,
    TriState.Allow
  );
  await accessControl.setUserRole(
    EVERYONE,
    roles.neumarkIssuer,
    neumark.address,
    TriState.Allow
  );
  await accessControl.setUserRole(
    EVERYONE,
    roles.neumarkBurner,
    neumark.address,
    TriState.Allow
  );
  await accessControl.setUserRole(
    EVERYONE,
    roles.transferAdmin,
    neumark.address,
    TriState.Allow
  );
  await accessControl.setUserRole(
    EVERYONE,
    roles.platformOperatorRepresentative,
    neumark.address,
    TriState.Allow
  );
  await neumark.amendAgreement(
    "ipfs:QmPXME1oRtoT627YKaDPDQ3PwA8tdP9rWuAAweLzqSwAWT"
  );

  return neumark;
}
