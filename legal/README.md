# Legal Agreements Bound To Smart Contract
As described in Agreement.sol, several smart contracts contain backing legal agreements. You should refer to this file for rationale and mechanism.
You can also read README of our ESOP project here https://github.com/Neufund/ESOP#esop-terms--conditions-document

Documents are available in Word (docx) and html (converted from Word, do not expect too much!).
Documents are templates within which several tags marked with curly braces needs to be replaced before document is stored in IPFS.

## Tag replacement and document lifecycle
Tags are replaced in three stages that correspond to document lifecycle.
1. Initial phase. Html version is taken and initial tags are replaced. **This version is stored in IPFS**
2. General phase. Happens in context of smart contract. Html is retrieved from IPFS and general tags are replaced. Such version may be shown as general terms, to be read before user makes the transaction. (you can think of nice replacements of personal tags, see below).
3. Personal phase. Personalized tags are replaced. This is binding version of the document that investor should print/download after transaction.

For details on attaching IPFS stored agreement to smart contract, see main README

### Formatting and conversions
Values must be converted and displayed properly.
* money values are in base currency (eth/neu) with 4 decimal places
* timestamps are in seconds from unit epoch and in UTC. Display as yyyy-mm-dd hh:mm UTC
* periods are in seconds, display nicely using `moments` (or some other library): days, hours etc.
* fractions are in wei precision. for example fraction of 1 is 10\*\*18, fraction 0.1 is 10\*\*17. Display as percentage with 2 decimal precision.

## Reservation Agreement tags
**Root finding**
Commitment contract, agreement IPFS link may be obtained by

`Commitment::currentAgreement[2] (string)`

One of dependencies for this Agreement is LockedAccount instance which may be created for Ether or Euro tokens. Technically each investor may enter into two agreements, depending on token used to commit.

`Commitment::etherLock` for Ether investments

`Commitment::euroLock` for Euro Token investments

For personal phase, block number at which user signed agreement may be obtained by

`Commitment:agreementSignedAtBlock({investor-address})`, for that block, original agreement may be recreated

**Initial phase**

|Tag|Description|Value|
|---|-----------|-----|
|{repo-url}|Link to ico-contracts repo where source code of backed smart contract is stored|git@github.com:Neufund/ico-contracts.git
|{commit-id}|Commit-id for which deployed byte code (referenced by this agreement) may be reproduced|
|{website}|Commitment website|https://commit.neufund.org|
|{acquisition-sc-address}|Commitment contract address|*input parameter*|
|{signed-by-company-date}|Timestamp (UTC) at which agreement was signed by company|Commitment::currentAgreement[1]|
|{company-address}|Ethereum address that signed agreement|Commitment::currentAgreement[0]|
|{neumark-sc-address}|Neumark contract address|Commitment::neumark|
|{icbm-start-date}|When public ICBM starts|Commitment::startOf(State.Public) (timestamp)|
|{icbm-end-date}|When public ICBM ends|Commitment::startOf(State.Finished) (timestamp)|
|{company-neumark-address}|Address where company Neumarks go|Commitment::platformWalletAddress|
|{fork-arbiter-sc-address}|Address of fork arbiter contract|Commitment::ethereumForkArbiter|

**General phase**

|Tag|Description|Value|
|---|-----------|-----|
|{lockin-sc-address}|Particular LockedAccount address|*input parameter*|
|{payment-token}|Token which investor uses to commit|LockedAccount::assetToken()::name|
|{max-cap}|Maximum cap in Euro, must be converted to Ether for etherLock|Commitment:maxCapEur|
|{min-ticket}|Minimum ticket size, must be converted to Ether for etherLock|Commitment:minTicketEur|
|{unlock-fee-percent}|Locked account unlock penalty|LockedAccount::penaltyFraction (fraction)|
|{fee-address}|Address where penalties go|LockedAccount::penaltyDisbursalAddress|
|{reservation-period}|Lock period in seconds|LockedAccount::lockPeriod|

**Personal phase**

|Tag|Description|Value|
|---|-----------|-----|
|{investor-address}|Address of investor for which Agreement is generated|*input parameter*|
|{current-block-hash}|Hash of the block from which all other values were taken. Please pay attention to take all values from that block really (not just use "latest" which will just take current block) to avoid inconsistency.|*input parameter*|
|{amount}|Total amount investor commited|LockedAccount::balanceOf({investor-address})[0]|
|{release-date}|Date at which lock expires|LockedAccount::balanceOf({investor-address})[2] (timestamp)|
|{reservation-date}|Date at which funds were reserved|{release-date} - {reservation-period}|
|{unlock-fee}|Actual unlock fee to be paid|LockedAccount::penaltyFraction*{amount}/10**18 (results in wei)|
|{neumark-amount}|Amount of Neumarks granted|LockedAccount::balanceOf({investor-address})[1]|
|{neumark-acquisition-ratio}|Average price per Neumark|{amount}/{neumark-amount}|

## Neumark Token Holder Agreement tags
**Root finding**
Neumark contract, agreement IPFS link may be obtained by

`Neumark::currentAgreement[2] (string)`

For personal phase, block number at which user signed agreement may be obtained by

`Neumark:agreementSignedAtBlock({investor-address})`, for that block, original agreement may be recreated

**Initial phase**

|Tag|Description|Value|
|---|-----------|-----|
|{repo-url}|Link to ico-contracts repo where source code of backed smart contract is stored|git@github.com:Neufund/ico-contracts.git
|{commit-id}|Commit-id for which deployed byte code (referenced by this agreement) may be reproduced|
|{neumark-sc-address}|Neumark contract address||
|{signed-by-company-date}|Timestamp (UTC) at which agreement was signed by company|Neumark::currentAgreement[1]|
|{company-address}|Ethereum address that signed agreement|Neumark::currentAgreement[0]|
|{neumark-cap}|Maximum amount of Neumarks to be created|Neumark::neumarkCap|
|{initial-reward}|Initial Neumark reward, governs curve steepness|Neumark::initialRewardFraction (fraction)|
|{fork-arbiter-sc-address}|Address of fork arbiter contract|Neumark::ethereumForkArbiter|

**General phase**

-

**Personal phase**

|Tag|Description|Value|
|---|-----------|-----|
|{token-holder-address}|Address of token holder for which Agreement is generated|*input parameter*|
|{current-block-hash}|Hash of the block from which all other values were taken. Please pay attention to take all values from that block really (not just use "latest" which will just take current block) to avoid inconsistency.|*input parameter*|
