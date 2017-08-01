import web3 from 'web3';

export default function ether(n) {
  return new web3.BigNumber(web3.toWei(n, 'ether'));
}
