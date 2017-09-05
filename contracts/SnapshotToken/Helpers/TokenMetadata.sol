pragma solidity 0.4.15;

import '../../Standards/ITokenMetadata.sol';


contract TokenMetadata is ITokenMetadata {

    ////////////////////////
    // Immutable state
    ////////////////////////

    // The Token's name: e.g. DigixDAO Tokens
    string private NAME;

    // An identifier: e.g. REP
    string private SYMBOL;

    // Number of decimals of the smallest unit
    uint8 private DECIMALS;

    // An arbitrary versioning scheme
    string private VERSION;

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
        NAME = _tokenName;                                 // Set the name
        SYMBOL = _tokenSymbol;                             // Set the symbol
        DECIMALS = _decimalUnits;                          // Set the decimals
        VERSION = _version;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function name()
        public
        constant
        returns (string)
    {
        return NAME;
    }

    function symbol()
        public
        constant
        returns (string)
    {
        return SYMBOL;
    }

    function decimals()
        public
        constant
        returns (uint8)
    {
        return DECIMALS;
    }

    function version()
        public
        constant
        returns (string)
    {
        return VERSION;
    }
}
