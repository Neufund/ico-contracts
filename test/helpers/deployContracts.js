import { TriState, EVERYONE } from "./triState";
import roles from "./roles";

const Neumark = artifacts.require("Neumark");
const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const RoleBasedAccessPolicy = artifacts.require("RoleBasedAccessPolicy");

export const dayInSeconds = 24 * 60 * 60;
export const monthInSeconds = 30 * dayInSeconds;

export async function deployControlContracts() {
  const accessPolicy = await RoleBasedAccessPolicy.new();
  const forkArbiter = await EthereumForkArbiter.new(accessPolicy.address);
  return [accessPolicy, forkArbiter];
}

export async function deployNeumark(accessPolicy, forkArbiter) {
  const neumark = await Neumark.new(accessPolicy.address, forkArbiter.address);
  await accessPolicy.setUserRole(
    EVERYONE,
    roles.snapshotCreator,
    neumark.address,
    TriState.Allow
  );
  await accessPolicy.setUserRole(
    EVERYONE,
    roles.neumarkIssuer,
    neumark.address,
    TriState.Allow
  );
  await accessPolicy.setUserRole(
    EVERYONE,
    roles.neumarkBurner,
    neumark.address,
    TriState.Allow
  );
  await accessPolicy.setUserRole(
    EVERYONE,
    roles.transferAdmin,
    neumark.address,
    TriState.Allow
  );
  await accessPolicy.setUserRole(
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
