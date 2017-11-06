/* eslint-disable no-console */
// eslint-disable-next-line no-unused-vars
module.exports = function(callback) {
  const AccessControl = artifacts.require(
    "./AccessControl/RoleBasedAccessPolicy.sol"
  );
  const accessControl = AccessControl.at(
    "0xb6154e451d174b0fc3083e2283706220e7444024"
  );
  accessControl
    .accessPolicy()
    .then(data => console.log(data))
    .catch(err => console.log(err));
};
