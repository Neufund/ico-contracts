const BigNumber = web3.BigNumber;

export function etherToWei(number) {
  return new BigNumber(web3.toWei(number, "ether"))
}
