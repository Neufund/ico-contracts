export const weiPrice = 222e-18; // http://coincap.io/
export const gasPrice = 50e9 * weiPrice; // https://ethstats.net
export const gasLimit = 6712503; // https://ethstats.net

export const gasCost = gas =>
  `${gas} gas (€${Math.round(100 * gas * gasPrice) / 100}, ${Math.round(1000 * gas / gasLimit) /
    10}% of limit)`;

export const txGasCost = tx => gasCost(tx.receipt.gasUsed);

export const contractGasCost = contract =>
  gasCost(web3.eth.getTransactionReceipt(contract.transactionHash).gasUsed);

export default obj =>
  Number.isInteger(obj) ? gasCost(obj) : obj.receipt ? txGasCost(obj) : contractGasCost(obj);
