pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Math.sol";
import "./Loan.sol";

contract LoanBundle is ERC20, Math {
    mapping(address => bool) public loanOnePayoutClaimed;
    mapping(address => bool) public loanTwoPayoutClaimed;

    uint256 loanOnePayout = 0;
    uint256 loanTwoPayout = 0;

    address loanOne;
    address loanTwo;

    constructor(
        address _loanOne,
        address _loanTwo,
        uint256 _supply
    ) public {
        loanOne = _loanOne;
        loanTwo = _loanTwo;
        _mint(msg.sender, _supply);
    }

    function claimPaymentForContract(address payable loanAddress) public {
        Loan loanToken = Loan(loanAddress);
        uint256 startBalance = address(this).balance;
        loanToken.claimPayment();
        uint256 endBalance = address(this).balance;
        require(endBalance > startBalance, "didn't claim any payment");
        if (loanAddress == loanOne) {
            loanOnePayout = sub(endBalance, startBalance);
        } else if (loanAddress == loanTwo) {
            loanTwoPayout = sub(endBalance, startBalance);
        }
    }

    function claimPayment() public {
        require(!loanOnePayoutClaimed[msg.sender] || !loanTwoPayoutClaimed[msg.sender], "payments already claimed");
        require(loanOnePayout > 0 || loanTwoPayout > 0, "no payment to claim");
        uint256 accountBalance = balanceOf(msg.sender);
        uint256 paymentAmount = 0;
        if (loanOnePayout > 0 && !loanOnePayoutClaimed[msg.sender]) {
            uint256 payoutOneClaim = mul(accountBalance / totalSupply(), loanOnePayout);
            paymentAmount += payoutOneClaim;
            loanOnePayoutClaimed[msg.sender] = true;
        }
        if (loanTwoPayout > 0 && !loanTwoPayoutClaimed[msg.sender]) {
            uint256 payoutTwoClaim = mul(accountBalance / totalSupply(), loanTwoPayout);
            paymentAmount += payoutTwoClaim;
            loanTwoPayoutClaimed[msg.sender] = true;
        }
        msg.sender.transfer(paymentAmount);
    }
}
