import moment from "moment";
import { latestTimestamp } from "./latestTime";
// Increases testrpc time by the passed duration (a moment.js instance)
async function increaseTime(duration) {
  const id = Date.now();

  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [
          typeof duration === "object" ? duration.asSeconds() : duration
        ],
        id
      },
      (err1, result) => {
        if (err1) {
          reject(err1);
          return;
        }
        if (result.error) {
          reject(`increaseTime not supported, test will fail ${result.error}`);
        }
        web3.currentProvider.sendAsync(
          {
            jsonrpc: "2.0",
            method: "evm_mine",
            id: id + 1
          },
          (err2, res) => (err2 ? reject(err2) : resolve(res))
        );
      }
    );
  });
}
// need to be split into separate statements https://github.com/babel/babel/issues/3786
export default increaseTime;

// sets time to given timestamp based on current block time
export async function setTimeTo(timestamp) {
  const ct = await latestTimestamp();
  if (ct > timestamp) {
    throw new Error(`cannot decrease time to ${timestamp} from ${ct}`);
  }
  return increaseTime(moment.duration(timestamp - ct, "s"));
}
