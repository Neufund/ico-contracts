import { TriState, EVERYONE, GLOBAL } from "./triState";

const RoleBasedAccessControl = artifacts.require(
  "./AccessControl/RoleBasedAccessControl.sol"
);

export default async roles => {
  const rbac = await RoleBasedAccessControl.new();
  await Promise.all(
    roles.map(async policy => {
      const { subject, role, object, state } = Object.assign(
        {
          subject: EVERYONE,
          object: GLOBAL,
          state: TriState.Allow
        },
        policy
      );
      const roleHash = web3.sha3(role);
      await rbac.setUserRole(subject, roleHash, object, state);
    })
  );
  return rbac.address;
};
