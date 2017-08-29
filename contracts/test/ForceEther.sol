pragma solidity 0.4.15;


contract ForceEther {

    function ForceEther()
        payable
    {
    }

    function pay(address target) {
        // On selfdestruct ether is transfered without
        // involving the callback function.
        selfdestruct(target);
    }
}
