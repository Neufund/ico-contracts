pragma solidity 0.4.15;

contract AccessRoles {

    // may setup LockedAccount, change disbursal mechanism and set migration
    bytes32 public constant ROLE_LOCKED_ACCOUNT_ADMIN = keccak256("LockedAccountAdmin");
    // may setup whitelists and abort whitelisting contract with curve rollback
    bytes32 public constant ROLE_WHITELIST_ADMIN = keccak256("WhitelistAdmin");
}
