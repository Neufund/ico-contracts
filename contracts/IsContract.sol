pragma solidity 0.4.15;


contract IsContract {

    function isContract(address addr)
        internal
        constant
        returns (bool)
    {
        uint size;
        // takes 700 gas
        assembly { size := extcodesize(addr) }
        return size > 0;
    }
}
