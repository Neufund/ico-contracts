#!/usr/bin/env bash
# to be run via yarn test inprocess

code=0
for f in ./test/*.js
do
  if [[ "$f" != *setup.js ]]
  then
    echo $f
    yarn truffle test $f ./test/setup.js --network $1
    code=$(($code + $?))
  fi
done
exit $code
