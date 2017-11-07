pragma solidity 0.4.15;


import '../Standards/IERC20Token.sol';
import '../Standards/IERC677Token.sol';
import '../Standards/IERC677Callback.sol';
import './BasicToken.sol';


/**
 * @title Standard ERC20 token
 *
 * @dev Implementation of the standard token.
 * @dev https://github.com/ethereum/EIPs/issues/20
 * @dev Based on code by FirstBlood: https://github.com/Firstbloodio/token/blob/master/smart_contract/FirstBloodToken.sol
 */
contract StandardToken is
    IERC20Token,
    BasicToken,
    IERC677Token
{

    ////////////////////////
    // Mutable state
    ////////////////////////

    mapping (address => mapping (address => uint256)) private _allowed;

    ////////////////////////
    // Public functions
    ////////////////////////

    //
    // Implements ERC20
    //

    /**
    * @dev Transfer tokens from one address to another
    * @param from address The address which you want to send tokens from
    * @param to address The address which you want to transfer to
    * @param amount uint256 the amount of tokens to be transferred
    */
    function transferFrom(address from, address to, uint256 amount)
        public
        returns (bool)
    {
        // check and reset allowance
        var allowance = _allowed[from][msg.sender];
        _allowed[from][msg.sender] = sub(allowance, amount);
        // do the transfer
        transferInternal(from, to, amount);
        return true;
    }

    /**
    * @dev Aprove the passed address to spend the specified amount of tokens on behalf of msg.sender.
    * @param spender The address which will spend the funds.
    * @param amount The amount of tokens to be spent.
    */
    function approve(address spender, uint256 amount)
        public
        returns (bool)
    {

        // To change the approve amount you first have to reduce the addresses`
        //  allowance to zero by calling `approve(_spender, 0)` if it is not
        //  already 0 to mitigate the race condition described here:
        //  https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
        require((amount == 0) || (_allowed[msg.sender][spender] == 0));

        _allowed[msg.sender][spender] = amount;
        Approval(msg.sender, spender, amount);
        return true;
    }

    /**
    * @dev Function to check the amount of tokens that an owner allowed to a spender.
    * @param owner address The address which owns the funds.
    * @param spender address The address which will spend the funds.
    * @return A uint256 specifing the amount of tokens still avaible for the spender.
    */
    function allowance(address owner, address spender)
        public
        constant
        returns (uint256 remaining)
    {
        return _allowed[owner][spender];
    }

    //
    // Implements IERC677Token
    //

    function approveAndCall(
        address spender,
        uint256 amount,
        bytes extraData
    )
        public
        returns (bool)
    {
        require(approve(spender, amount));

        // in case of re-entry 1. approval is done 2. msg.sender is different
        bool success = IERC677Callback(spender).receiveApproval(
            msg.sender,
            amount,
            this,
            extraData
        );
        require(success);

        return true;
    }
}
