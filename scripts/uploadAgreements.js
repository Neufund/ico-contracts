/* eslint-disable no-console */

// eslint-disable-next-line import/no-extraneous-dependencies
const ipfsAPI = require("ipfs-api");
const fs = require("fs");
const path = require("path");

const isFilePinned = async (ipfs, hash) => {
  const matchedHashes = (await ipfs.pin.ls()).filter(
    response => response.hash === hash
  );
  return matchedHashes.length > 0;
};

const addFiletoIpfs = async (ipfs, file, name) => {
  let fileHash = (await ipfs.files.add(file, { "only-hash": true }))[0].hash;
  if (await isFilePinned(ipfs, await fileHash)) {
    await console.log(`file:${name} -- hash:${fileHash} already on ipfs `);
    return false;
  }
  console.log("Adding new file to IPFS and pinning");
  fileHash = (await ipfs.files.add(file, { pin: true }))[0].hash;
  console.log(`checking if file was pinned..`);
  if (!await isFilePinned(ipfs, fileHash))
    throw new Error("File not succsseffully pinned");
  console.log("Done");
  return fileHash;
};

const loadFiles = filePaths =>
  filePaths.map(filePath => {
    try {
      return {
        name: path.parse(filePath).base,
        file: fs.readFileSync(filePath)
      };
    } catch (e) {
      throw new Error(`Can't read file "${filePath}"`);
    }
  });

const getAbsolutePaths = relativeFilePaths =>
  relativeFilePaths.map(relativePath => path.resolve(relativePath));

// TODO: handle diffrent ports for ipfs
const main = async ([ipfsNodeAddress, ...relativeFilePaths]) => {
  const defaultFilePaths = [
    path.join(".", "legal", "NEUMARK TOKEN HOLDER AGREEMENT.out.html"),
    path.join(".", "legal", "RESERVATION AGREEMENT.out.html")
  ];
  try {
    if (!ipfsNodeAddress) throw new Error("Please give ipfs node");
    const ipfs = await ipfsAPI(ipfsNodeAddress);
    const absoluteFilePaths =
      relativeFilePaths.length > 0
        ? getAbsolutePaths(relativeFilePaths)
        : getAbsolutePaths(defaultFilePaths);

    loadFiles(absoluteFilePaths).forEach(async loadedfile => {
      const addedFileHash = await addFiletoIpfs(
        ipfs,
        loadedfile.file,
        loadedfile.name
      );
      if (addedFileHash)
        console.log(`name:${loadedfile.name} -- hash:${await addedFileHash}`);
    });
  } catch (e) {
    console.log(e);
  }
};

main(process.argv.slice(2)).catch(err => console.log(err));
