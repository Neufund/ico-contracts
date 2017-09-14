import { TriState, EVERYONE, GLOBAL } from "./triState";

const RoleBasedAccessControl = artifacts.require(
  "./AccessControl/RoleBasedAccessControl.sol"
);

export default async rules => {
  const rbac = await RoleBasedAccessControl.new();
  rbac.set = async rules => {
    if (!rules || rules.length == 0) {
      return;
    }
    rules = rules.map(rule =>
      Object.assign(
        { subject: EVERYONE, object: GLOBAL, state: TriState.Allow },
        rule
      )
    );
    await rbac.setUserRoles(
      rules.map(({ subject }) => subject),
      rules.map(({ role }) => role),
      rules.map(({ object }) => object),
      rules.map(({ state }) => state)
    );
  };
  await rbac.set(rules);
  return rbac;
};
