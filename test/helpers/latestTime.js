import moment from "moment";

let firstTimeRequestedTime = true;

// Returns a moment.js instance representing the time of the last mined block
export default function latestTime() {
  return moment.unix(latestTimestamp());
}

export function latestTimestamp() {
  // this is done as a workaround for a bug when first requested block get return wrong timestamp
  if (firstTimeRequestedTime) {
    web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_mine",
      id: 12345
    });
    firstTimeRequestedTime = false;
  }

  return web3.eth.getBlock("latest").timestamp;
}

export const HOUR = 60 * 60;
export const DAY = 24 * 60 * 60;
export const MONTH = HOUR * 24 * 31;

// useful for spawning time sensitive contracts
export function closeFutureDate() {
  return latestTimestamp() + DAY;
}

// useful for spawning time sensitive contracts
export function furtherFutureDate() {
  return latestTimestamp() + MONTH;
}
