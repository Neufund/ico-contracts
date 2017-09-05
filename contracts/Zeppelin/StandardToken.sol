pragma solidity 0.4.15;


import '../Standards/IERC20Token.sol';
import './BasicToken.sol';


/**
 * @title Standard ERC20 token
 *
 * @dev Implementation of the basic standard token.
 * @dev https://github.com/ethereum/EIPs/issues/20
 * @dev Based on code by FirstBlood: https://github.com/Firstbloodio/token/blob/master/smart_contract/FirstBloodToken.sol
 */
contract StandardToken is IERC20Token, BasicToken {

    ////////////////////////
    // Mutable state
    ////////////////////////

    mapping (address => mapping (address => uint256)) private _allowed;

    ////////////////////////
    // Public functions
    ////////////////////////

    /**
    * @dev Transfer tokens from one address to another
    * @param from address The address which you want to send tokens from
    * @param to address The address which you want to transfer to
    * @param value uint256 the amout of tokens to be transfered
    */
    function transferFrom(address from, address to, uint256 value)
        public
        returns (bool)
    {
        var allowance = _allowed[from][msg.sender];

        // Check is not needed because sub(_allowance, _value) will already throw if this condition is not met
        // require (_value <= _allowance);

        _balances[to] = add(_balances[to], value);
        _balances[from] = sub(_balances[from], value);
        _allowed[from][msg.sender] = sub(allowance, value);
        Transfer(from, to, value);
        return true;
    }

    /**
    * @dev Aprove the passed address to spend the specified amount of tokens on behalf of msg.sender.
    * @param spender The address which will spend the funds.
    * @param value The amount of tokens to be spent.
    */
    function approve(address spender, uint256 value)
        public
        returns (bool)
    {

        // To change the approve amount you first have to reduce the addresses`
        //  allowance to zero by calling `approve(_spender, 0)` if it is not
        //  already 0 to mitigate the race condition described here:
        //  https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
        require((value == 0) || (_allowed[msg.sender][spender] == 0));

        _allowed[msg.sender][spender] = value;
        Approval(msg.sender, spender, value);
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
}
