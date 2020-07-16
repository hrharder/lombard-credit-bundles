pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Math.sol";
import "./Loan.sol";

contract LoanBundle is ERC20, Math {
    string public name;
    string public symbol;
    uint8 public decimals;

    address payable[] public loanArray;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address payable[] memory _loanArray,
        uint256 _supply
    ) public {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        loanArray = _loanArray;
        _mint(msg.sender, _supply);
    }

    event ContractPaymentClaimed(address loanAddress, uint256 amountClaimed);
    event ContractPaymentClaimFailed(address loanAddress);
    event PaymentClaimed(address claimeeAddress, uint256 valueClaimed);

    function claimPaymentForContract() public {
        for (uint256 i = 0; i < loanArray.length; i++) {
            Loan loanToken = Loan(loanArray[i]);
            uint256 startBalance = address(this).balance;
            if (loanToken.auctionEnded() || loanToken.loanRepaid()) {
                loanToken.claimPayment();
                uint256 endBalance = address(this).balance;
                emit ContractPaymentClaimed(
                    loanArray[i],
                    sub(endBalance, startBalance)
                );
            } else {
                emit ContractPaymentClaimFailed(loanArray[i]);
            }
        }
    }

    function claimPayment() public {
        uint256 accountBalance = balanceOf(msg.sender);
        require(accountBalance > 0, "token balance must be greater than zero");
        uint256 accountClaim = mul(
            accountBalance / totalSupply(),
            address(this).balance
        );
        _burn(msg.sender, accountBalance);
        msg.sender.transfer(accountClaim);
        emit PaymentClaimed(msg.sender, accountClaim);
    }
}
