pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Math.sol";
import "./Loan.sol";

contract LoanBundle is ERC20, Math {
    address payable[] public loanArray;

    constructor(address payable[] memory _loanArray, uint256 _supply) public {
        loanArray = _loanArray;
        _mint(msg.sender, _supply);
    }

    event ContractPaymentClaimed(address loanAddress, uint256 amountClaimed);
    event ContractPaymentClaimFailed(address loanAddress);

    function claimPaymentForContract() public {
        for (uint256 i = 0; i < loanArray.length; i++) {
            Loan loanToken = Loan(loanArray[i]);
            uint256 startBalance = address(this).balance;
            if (loanToken.auctionEnded() || loanToken.loanRepayed()) {
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
        uint256 accountClaim = mul(
            accountBalance / totalSupply(),
            address(this).balance
        );
        _burn(msg.sender, accountBalance);
        msg.sender.transfer(accountClaim);
    }
}
