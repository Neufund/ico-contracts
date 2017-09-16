import { TriState, EVERYONE } from "./triState";
import roles from "./roles";

const Neumark = artifacts.require("Neumark");
const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");

const BigNumber = web3.BigNumber;

/* eslint-disable */
export let neumark;
export let accessControl;
export let forkArbiter;

/* eslint-enable */

export const days = 24 * 60 * 60;
export const months = 30 * 24 * 60 * 60;

export async function deployAccessControl() {
  accessControl = await RoleBasedAccessControl.new();
  forkArbiter = await EthereumForkArbiter.new(accessControl.address);
}

export async function deployNeumark() {
  await deployAccessControl();
  neumark = await Neumark.new(accessControl.address, forkArbiter.address);
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
}
