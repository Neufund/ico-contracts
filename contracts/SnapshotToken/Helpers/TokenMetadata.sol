pragma solidity 0.4.15;

import '../../Standards/ITokenMetadata.sol';


contract TokenMetadata is ITokenMetadata {

    string private tokenName;                //The Token's name: e.g. DigixDAO Tokens
    uint8 private tokenDecimals;             //Number of decimals of the smallest unit
    string private tokenSymbol;              //An identifier: e.g. REP
    string private tokenVersion;             //An arbitrary versioning scheme

    /// @notice Constructor to create a MiniMeToken
    /// @param _tokenName Name of the new token
    /// @param _decimalUnits Number of decimals of the new token
    /// @param _tokenSymbol Token Symbol for the new token
    function TokenMetadata(
        string _tokenName,
        uint8 _decimalUnits,
        string _tokenSymbol,
        string _version
    ) {
        tokenName = _tokenName;                                 // Set the name
        tokenDecimals = _decimalUnits;                          // Set the decimals
        tokenSymbol = _tokenSymbol;                             // Set the symbol
        tokenVersion = _version;
    }

    function symbol()
        constant
        returns (string)
    {
        return tokenSymbol;
    }

    function name()
        constant
        returns (string)
    {
        return tokenName;
    }

    function decimals()
        constant
        returns (uint8)
    {
        return tokenDecimals;
    }

    function version()
        constant
        returns (string)
    {
        return tokenVersion;
    }
}
