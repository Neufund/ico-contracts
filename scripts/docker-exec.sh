#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
cd ..


wait_for_testrpc() {
  ./scripts/wait-for-it.sh localhost:8545 -t 5
  yarn deploy:fast
}

wait_for_testrpc&
exec ./scripts/testrpc.sh
