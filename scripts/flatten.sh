#!/usr/bin/env bash
# flatten all deployed contracts

#Smart contract paths
path[0]=../contracts/AccessControl/RoleBasedAccessPolicy.sol
path[1]=../contracts/EthereumForkArbiter.sol
path[2]=../contracts/Neumark.sol
path[3]=../contracts/EtherToken.sol
path[4]=../contracts/EuroToken.sol
path[5]=../contracts/LockedAccount.sol
path[6]=../contracts/Commitment/Commitment.sol

#Output directory
output=./build/flatten

for i in {0..6}
do
  echo Flattening ${path[i]} to $output
  yarn truffle-flattener ${path[i]} $output
done
