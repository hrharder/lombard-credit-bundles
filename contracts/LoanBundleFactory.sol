pragma solidity ^0.5.0;

import "./LoanBundle.sol";

contract LoanBundleFactory {
    function deployLoanBundleToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address payable[] memory _loanArray,
        uint256 _supply
    ) public returns (address) {
        LoanBundle newLoanBundle = (
            new LoanBundle(_name, _symbol, _decimals, _loanArray, _supply)
        );
        newLoanBundle.transfer(msg.sender, _supply);
        return address(newLoanBundle);
    }
}
