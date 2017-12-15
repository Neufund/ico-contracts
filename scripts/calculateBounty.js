const path = require('path');
const d3 = require('d3-dsv');
const fs = require('fs');
const web3utils = require('./node_modules/web3/lib/utils/utils');

const parseStrToNumStrict = (source) => {
  if (source === null) {
    return NaN;
  }
  if (source === undefined) {
    return NaN;
  }
  let transform = source.replace(/\s/g, '');
  transform = transform.replace(/,/g, '.');
  // we allow only digits dots and minus
  if (/[^.\-\d]/.test(transform)) {
    return NaN;
  }
  // we allow only one dot
  if ((transform.match(/\./g) || []).length > 1) {
    return NaN;
  }
  return parseFloat(transform);
};
const fullInfo = [];

const distributeShare = (list, totalStake, totalTokens, participants) => {
  const bountyUsers = {};
  for (const key of Object.keys(list)) {
    const user = list[key];
    user.neumark = (user.stake / totalStake) * totalTokens;
    bountyUsers[key] = user;
    bountyUsers[key].name = key;
    bountyUsers[key].ethAddress = participants[key] ? participants[key].ethAddress : null;
    if (!bountyUsers[key].ethAddress) throw new Error(`There was no eth address for user ${key} in ${list[key].bounty}`);
    if (!web3utils.isAddress(bountyUsers[key].ethAddress)) throw new Error(`Address ${bountyUsers[key].ethAddress} is not an address for user ${key} in ${list[key].bounty}`);
    fullInfo.push(bountyUsers[key]);
  }
  return bountyUsers;
};

const formatStakeCsv = (parsedCsv, totalNeumark) => {
  const bounty = {};

  bounty.Signature = { totalTokens: totalNeumark * 0.20, totalStake: 0, participants: {} };
  bounty.Blogpost = { totalTokens: totalNeumark * 0.30, totalStake: 0, participants: {} };
  bounty.Video = { totalTokens: totalNeumark * 0.30, totalStake: 0, participants: {} };
  bounty.Translation = { totalTokens: totalNeumark * 0.20, totalStake: 0, participants: {} };

  parsedCsv
    .forEach((row) => {
      let userName = (row['User Slack']).toLowerCase();
      let bountyCat = row['Bounty Category'];
      const stake = parseStrToNumStrict(row.Stakes);
      if (Number.isNaN(stake)) throw new Error(`NaN was returned during parsing:${userName} bounty program:${bountyCat}`);
      if (stake > 0) {
        userName = userName.replace(/ /g, '');
        if ((bountyCat.toLowerCase()).includes('translation')) { bountyCat = 'Translation'; }
        bounty[bountyCat].totalStake += stake;
        if (!bounty[bountyCat].participants[userName]) {
          bounty[bountyCat].participants[userName] = { stake: 0, bounty: bountyCat };
        }
        bounty[bountyCat].participants[userName].stake += stake;
      }
    });
  return bounty;
};

const formatResponceCsv = (responceCsv) => {
  const formattedResponce = {};
  formattedResponce.Signature = {};
  formattedResponce.Blogpost = {};
  formattedResponce.Video = {};
  formattedResponce.Translation = {};

  responceCsv.forEach((row) => {
    let slackName = ((row['Your user name on the Neufund Slack']).replace(/ /g, '')).toLowerCase();
    const ethAddress = (row['ETH Address to receive your bounty NEU tokens'].replace(/ /g, '')).toLowerCase();
    const email = row['Email address'];
    if (slackName) {
      if (slackName[0] !== '@') slackName = `@${slackName}`;
      // console.log(slackName);
      try {
        formattedResponce[row.Bounty][slackName] = { ethAddress, email };
      } catch (e) {
        throw new Error('Unknown Bounty catagory');
      }
    }
  });
  return formattedResponce;
};
const ethNeumarkMap = {};
const arrayNeumark = [];
const extractUploadInfo = (participants) => {
  for (const key of Object.keys(participants)) {
    if (!ethNeumarkMap[participants[key].ethAddress]) ethNeumarkMap[participants[key].ethAddress] = { neumark: 0, name: key };
    ethNeumarkMap[participants[key].ethAddress].neumark += participants[key].neumark;
  }
  return arrayNeumark;
};
const calculateBounty = () => {
  const [stakeCsvFile, responsesCsv, totalNeumark, ...other] = process.argv.slice(2);
  const outputDirePath = path.resolve('./calculated-bounty');
  if (other.length) {
    throw new Error('To many arguments');
  }
  if (!fs.existsSync(outputDirePath)) {
    fs.mkdirSync(outputDirePath);
  }
  console.log('Loading CSV files and parsing');
  const parsedCsv = d3.csvParse(fs.readFileSync(path.resolve(stakeCsvFile), 'UTF-8'));
  const responceCsv = d3.csvParse(fs.readFileSync(path.resolve(responsesCsv), 'UTF-8'));

  const bounty = formatStakeCsv(parsedCsv, totalNeumark);
  const participantsInfo = formatResponceCsv(responceCsv);
  const calc = {};
  for (const key in bounty) {
    const participantNo = Object.keys(bounty[key].participants).length;
    calc[key] = participantNo > 10 ?
      distributeShare(bounty[key].participants, bounty[key].totalStake, bounty[key].totalTokens, participantsInfo[key]) :
      distributeShare(bounty[key].participants, bounty[key].totalStake, bounty[key].totalTokens * (0.1 * participantNo), participantsInfo[key]);
    extractUploadInfo(calc[key]);
  }
  for (const key of Object.keys(ethNeumarkMap)) {
    arrayNeumark.push({ address: key, neumark: ethNeumarkMap[key].neumark, name: ethNeumarkMap[key].name });
  }

  fs.writeFileSync(`${outputDirePath}/bounty-eth-list.csv`, d3.csvFormat(arrayNeumark));
  fs.writeFileSync(`${outputDirePath}/bounty-full-info.csv`, d3.csvFormat(fullInfo));
  console.log('done');
};

calculateBounty();
