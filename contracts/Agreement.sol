pragma solidity 0.4.15;


contract Agreement {

    string[] public agreementMimeTypes;
    mapping(string => string) public agreementByType;

    function Agreement(byte[255][] mimeTypes, byte[255][] uris) {
        require(mimeTypes.length == uris.length);
        for (uint256 i = 0; i < mimeTypes.length; i++) {
            agreementByType[mimeTypes[i]] = uris[i];
        }
        agreementMimeTypes = mimeTypes;
    }
}
