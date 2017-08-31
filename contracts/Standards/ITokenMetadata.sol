pragma solidity 0.4.15;


contract ITokenMetadata {

    function symbol()
        constant
        returns (string);

    function name()
        constant
        returns (string);

    function decimals()
        constant
        returns (uint8);
}
