const BigNumber = web3.BigNumber;

export const DIGITS = etherToWei(1);

export function etherToWei(number) {
  return new BigNumber(web3.toWei(number, "ether"));
}

export function shanToWei(number) {
  return new BigNumber(web3.toWei(number, "shannon"));
}
