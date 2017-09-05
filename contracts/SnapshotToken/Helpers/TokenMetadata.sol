pragma solidity 0.4.15;

import '../../Standards/ITokenMetadata.sol';


contract TokenMetadata is ITokenMetadata {

    ////////////////////////
    // Immutable state
    ////////////////////////

    // The Token's name: e.g. DigixDAO Tokens
    string private tokenName;

    // Number of decimals of the smallest unit
    uint8 private tokenDecimals;

    // An identifier: e.g. REP
    string private tokenSymbol;

    // An arbitrary versioning scheme
    string private tokenVersion;

    ////////////////////////
    // Constructor
    ////////////////////////

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

    ////////////////////////
    // Public functions
    ////////////////////////

    function symbol()
        public
        constant
        returns (string)
    {
        return tokenSymbol;
    }

    function name()
        public
        constant
        returns (string)
    {
        return tokenName;
    }

    function decimals()
        public
        constant
        returns (uint8)
    {
        return tokenDecimals;
    }

    function version()
        public
        constant
        returns (string)
    {
        return tokenVersion;
    }
}
