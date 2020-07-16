pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Math.sol";

contract Loan is ERC20, Math {
    string public name;
    string public symbol;
    uint8 public decimals;

    uint256 public shares;
    address public collateralAsset;
    uint256 public collateralID;
    uint256 public loanEndTime;
    address payable public borrower;
    uint256 public loanAmount;
    uint256 public totalRequiredPayment;

    uint256 public auctionStartPrice;
    uint256 public auctionPerBlockPriceReduction;
    uint256 public auctionStartBlock = 0;

    bool public loanBorrowed = false;
    bool public auctionEnded = false;
    bool public loanRepayed = false;
    bool public loanFunded = false;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _shares,
        address _collateralAsset,
        uint256 _collateralID,
        uint256 _loanEndTime,
        address payable _borrower,
        uint256 _loanAmount,
        uint256 _totalRequiredPayment,
        uint256 _auctionStartPrice,
        uint256 _auctionPerBlockPriceReduction
    ) public {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        shares = _shares;
        collateralAsset = _collateralAsset;
        collateralID = _collateralID;
        loanEndTime = _loanEndTime;
        borrower = _borrower;
        loanAmount = _loanAmount;
        totalRequiredPayment = _totalRequiredPayment;
        auctionStartPrice = _auctionStartPrice;
        auctionPerBlockPriceReduction = _auctionPerBlockPriceReduction;
    }

    function fundLoan() public payable {
        require(!loanFunded, "loan already funded");
        require(msg.value == loanAmount, "must send loan value when constructing loan contract");
        loanFunded = true;
        _mint(msg.sender, shares);
    }

    function borrow() public returns (bool) {
        require(loanFunded, "loan unfunded");
        require(!loanBorrowed, "loan was already borrowed");
        IERC721 collateralToken = IERC721(collateralAsset);
        collateralToken.transferFrom(borrower, address(this), collateralID);
        borrower.transfer(loanAmount);
        loanBorrowed = true;
        return true;
    }

    function initiateCollateralAuction() public {
        require(loanEndTime >= now, "Loan: not ended");
        require(totalRequiredPayment < address(this).balance, "Loan: not underpaid");
        auctionStartBlock = block.number;
    }

    function getPrice() public view returns (uint256 price) {
        if (auctionStartBlock == 0) {
            price = 0;
        } else {
            uint256 blockDiff = sub(block.number, auctionStartBlock);
            uint256 priceDecay = mul(auctionPerBlockPriceReduction, blockDiff);
            price = sub(auctionStartPrice, priceDecay);
        }
    }

    function buyNftDuringAuction() public payable {
        require(getPrice() > 0, "auction not started or price is less than zero");
        require(msg.value >= getPrice(), "insufficient bid");
        require(auctionEnded == false, "auction already ended");
        IERC721 collateralToken = IERC721(collateralAsset);
        collateralToken.transferFrom(address(this), msg.sender, collateralID);
        auctionEnded = true;
        if (sub(msg.value, getPrice()) > 0) {
            msg.sender.transfer(sub(msg.value, getPrice()));
        }
    }

    function reclaimCollateral() external payable {
        require(auctionStartBlock == 0, "auction has started");
        uint256 currentBalance = address(this).balance;
        // todo: msg.value already included in address(this).balance (?)
        if (add(currentBalance, msg.value) >= totalRequiredPayment) {
            loanRepayed = true;
            IERC721 collateralToken = IERC721(collateralAsset);
            collateralToken.transferFrom(address(this), msg.sender, collateralID);
        }
    }

    function claimPayment() public {
        require(auctionEnded || loanRepayed, "either loan wasn't replayed or auction hasn't ended");
        uint256 accountBalance = balanceOf(msg.sender);
        uint256 accountClaim = mul(accountBalance / totalSupply(), address(this).balance);
        _burn(msg.sender, accountBalance);
        msg.sender.transfer(accountClaim);
    }

    function() external payable {
        uint256 currentBalance = address(this).balance;
        require(currentBalance < totalRequiredPayment, "Loan: fully paid");
        require(add(currentBalance, msg.value) <= totalRequiredPayment, "Loan: paying too much");
    }
}
