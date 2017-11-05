/* eslint-disable no-console */

// eslint-disable-next-line import/no-extraneous-dependencies
const ipfsAPI = require("ipfs-api");
const fs = require("fs");
const path = require("path");

const isFilePinned = async (ipfs, hash) => {
  const matchedHashes = (await ipfs.pin.ls()).filter(response => {
    if (response.hash === hash) return true;
    return false;
  });
  return matchedHashes.length > 0;
};

const addFiletoIpfs = async (ipfs, file, name) => {
  try {
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
  } catch (err) {
    console.log(err);
  }
  return false;
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

// TODO: handle diffrent ports for ipfs
const main = async ([ipfsNodeAddress, ...paths]) => {
  const defaultDirpath = path.join(__dirname, "..", "legal");
  const filePaths = [];
  const defaultfilePaths = [
    "NEUMARK TOKEN HOLDER AGREEMENT.out.html",
    "RESERVATION AGREEMENT.out.html"
  ];
  try {
    if (!paths) throw new Error("Please give ipfs node");

    const ipfs = await ipfsAPI(ipfsNodeAddress);

    if (paths.length > 0) {
      paths.forEach(relativePath => filePaths.push(path.resolve(relativePath)));
    } else {
      defaultfilePaths.forEach(filePath =>
        filePaths.push(path.join(defaultDirpath, filePath))
      );
    }
    loadFiles(filePaths).forEach(async loadedfile => {
      const addedFileHash = await addFiletoIpfs(
        ipfs,
        loadedfile.file,
        loadedfile.name
      );
      if (addedFileHash) {
        console.log(`name:${loadedfile.name}`);
        console.log(`hash:${await addedFileHash}`);
      }
    });
  } catch (e) {
    console.log(e);
  }
};

main(process.argv.slice(2)).catch(err => console.log(err));
