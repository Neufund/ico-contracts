export const promisify = func => async (...args) =>
  new Promise((accept, reject) =>
    func(...args, (error, result) => (error ? reject(error) : accept(result)))
  );

export const rpcCommand = method => async (...params) =>
  (await promisify(web3.currentProvider.sendAsync)({
    jsonrpc: "2.0",
    method,
    params,
    id: Date.now()
  })).result;

export const mineBlock = rpcCommand("evm_mine");
export const increaseTime = rpcCommand("evm_increaseTime");
export const saveBlockchain = rpcCommand("evm_snapshot");
export const restoreBlockchain = rpcCommand("evm_revert");
