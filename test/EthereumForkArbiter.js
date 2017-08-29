import { expect } from "chai";
import { prettyPrintGasCost } from "./helpers/gasUtils";
import createAccessPolicy from "./helpers/createAccessPolicy";
import forceEther from "./helpers/forceEther";
import expectThrow from "./helpers/expectThrow";
import { eventValue } from "./helpers/events";

const EthereumForkArbiter = artifacts.require("EthereumForkArbiter");

contract("EthereumForkArbiter", ([deployer, arbiter, other]) => {
  let ethereumForkArbiter;

  beforeEach(async () => {
    const accessPolicy = await createAccessPolicy([
      { subject: arbiter, role: "ROLE_FORK_ARBITER" }
    ]);
    ethereumForkArbiter = await EthereumForkArbiter.new(accessPolicy);
  });
  it("should deploy", async () => {
    prettyPrintGasCost("Deploy", ethereumForkArbiter);
  });
  it("should announce forks", async () => {
    const name = "Spurious Dragon";
    const url =
      "https://blog.ethereum.org/2016/11/18/hard-fork-no-4-spurious-dragon/";
    const tx = await ethereumForkArbiter.announceFork(name, url, {
      from: arbiter
    });
    expect(eventValue(tx, "ForkAnnounced", "name")).to.equal(name);
    expect(eventValue(tx, "ForkAnnounced", "url")).to.equal(url);
    prettyPrintGasCost("Announce", tx);
  });
  it("should remember last announced fork", async () => {
    const name = "Spurious Dragon";
    const url =
      "https://blog.ethereum.org/2016/11/18/hard-fork-no-4-spurious-dragon/";
    const tx = await ethereumForkArbiter.announceFork(name, url, {
      from: arbiter
    });
    const rName = await ethereumForkArbiter.nextForkName.call();
    const rUrl = await ethereumForkArbiter.nextForkUrl.call();
    expect(rName).to.equal(name);
    expect(rUrl).to.equal(url);
  });
  it("should sign forks", async () => {
    const block = await web3.eth.getBlock("latest");
    const tx = await ethereumForkArbiter.signFork(block.number, block.hash, {
      from: arbiter
    });
    expect(eventValue(tx, "ForkSigned", "blockNumber")).to.be.bignumber.equal(
      block.number
    );
    expect(eventValue(tx, "ForkSigned", "blockHash")).to.be.equal(block.hash);
    prettyPrintGasCost("Sign", tx);
  });
  it("should check hash of signed fork", async () => {
    const block = await web3.eth.getBlock("latest");
    const hash =
      "0x8693c7c1ec855e1ef02fb45536ea545b0c3fc137d700dce21300a8254423d8a4";
    await expectThrow(
      ethereumForkArbiter.signFork(block.number, hash, {
        from: arbiter
      })
    );
    await ethereumForkArbiter.signFork(block.number, block.hash, {
      from: arbiter
    });
  });
  it("should remember last signed fork", async () => {
    const block = await web3.eth.getBlock("latest");
    const tx = await ethereumForkArbiter.signFork(block.number, block.hash, {
      from: arbiter
    });
    const rNumber = await ethereumForkArbiter.lastSignedBlockNumber.call();
    const rHash = await ethereumForkArbiter.lastSignedBlockHash.call();
    const rTime = await ethereumForkArbiter.lastSignedTimestamp.call();
    expect(rNumber).to.be.bignumber.equal(block.number);
    expect(rHash).to.equal(block.hash);
    const rBlock = await web3.eth.getBlock(tx.receipt.blockNumber);
    const time = rBlock.timestamp;
    expect(rNumber).to.be.bignumber.equal(block.number);
    expect(rHash).to.be.bignumber.equal(block.hash);
    expect(rTime).to.be.bignumber.equal(time);
  });
  it("should only allow ROLE_FORK_ARBITER to announce", async () => {
    const name = "Spurious Dragon";
    const url =
      "https://blog.ethereum.org/2016/11/18/hard-fork-no-4-spurious-dragon/";
    await expectThrow(
      ethereumForkArbiter.announceFork(name, url, {
        from: deployer
      })
    );
    await expectThrow(
      ethereumForkArbiter.announceFork(name, url, {
        from: other
      })
    );
    await ethereumForkArbiter.announceFork(name, url, {
      from: arbiter
    });
  });
  it("should only allow ROLE_FORK_ARBITER to sign", async () => {
    const block = await web3.eth.getBlock("latest");
    await expectThrow(
      ethereumForkArbiter.signFork(block.number, block.hash, {
        from: deployer
      })
    );
    await expectThrow(
      ethereumForkArbiter.signFork(block.number, block.hash, {
        from: other
      })
    );
    await ethereumForkArbiter.signFork(block.number, block.hash, {
      from: arbiter
    });
  });
});
