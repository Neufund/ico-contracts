import moment from "moment";
import { promisify, mineBlock } from "./evmCommands";

let firstTimeRequestedTime = true;

// Returns a moment.js instance representing the time of the last mined block
export default async function latestTime() {
  return moment.unix(await latestTimestamp());
}

export async function latestTimestamp() {
  // this is done as a workaround for a bug when first requested block get return wrong timestamp
  if (firstTimeRequestedTime) {
    await mineBlock();
    firstTimeRequestedTime = false;
  }

  return (await promisify(web3.eth.getBlock)("latest")).timestamp;
}

export const HOUR = 60 * 60;
export const DAY = 24 * 60 * 60;
export const MONTH = HOUR * 24 * 31;

// useful for spawning time sensitive contracts
export async function closeFutureDate() {
  return (await latestTimestamp()) + DAY;
}

// useful for spawning time sensitive contracts
export async function furtherFutureDate() {
  return (await latestTimestamp()) + MONTH;
}
