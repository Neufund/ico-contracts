/* eslint-disable no-console */

// eslint-disable-next-line import/no-extraneous-dependencies
const ipfsAPI = require("ipfs-api");
const fs = require("fs");
const path = require("path");
const Promise = require("bluebird");

const isFilePinned = async (ipfs, hash) => {
  const matchedHashes = (await ipfs.pin.ls()).filter(response => {
    if (response.hash === hash) return true;
    return false;
  });
  return matchedHashes.length > 0;
};
const addFiletoIpfs = async (ipfs, file) => {
  try {
    let fileHash = (await ipfs.files.add(file, { "only-hash": true }))[0].hash;
    // await ipfs.pin.rm(fileHash);

    if (await isFilePinned(ipfs, await fileHash)) {
      await console.log(`file ${fileHash} already on ipfs `);
      return false;
    }
    console.log("Adding new file to IPFS and pinning");
    fileHash = (await ipfs.files.add(file, { pin: true }))[0].hash;
    console.log(`checking if file was pinned..`);
    if (!await isFilePinned(ipfs, fileHash))
      throw new Error("File not succsseffully pinned");
    console.log("Done");
    return fileHash;
  } catch (err) {
    console.log(err);
  }
  return false;
};
// TODO: handle diffrent ports for ipfs
// TODO: clean code
const main = async args => {
  const ipfsNodeAddress = args[0];
  const filePaths = [];
  const defaultDirpath = path.join(__dirname, "..", "legal");
  const readFileAsync = Promise.promisify(fs.readFile);
  if (!args) throw new Error("Please give ipfs node");
  if (args.length > 1) {
    args
      .slice(1)
      .forEach(relativePath => filePaths.push(path.resolve(relativePath)));
  } else {
    filePaths.push(
      path.join(defaultDirpath, "NEUMARK TOKEN HOLDER AGREEMENT.out.html")
    );
    filePaths.push(path.join(defaultDirpath, "RESERVATION AGREEMENT.out.html"));
  }

  const ipfs = await ipfsAPI(ipfsNodeAddress);
  for (let i = 0; i < filePaths.length; i += 1) {
    const file = await readFileAsync(filePaths[i]).catch(() => {
      throw new Error(`Can't read file form this path ${filePaths[i]}`);
    });
    const addedFileHash = await addFiletoIpfs(
      ipfs,
      await file,
      path.parse(filePaths[i]).base
    );
    if (addedFileHash) {
      console.log(`name:${path.parse(filePaths[i]).base}`);
      console.log(`hash:${await addedFileHash}`);
    }
  }
};

main(process.argv.slice(2)).catch(err => console.log(err));
