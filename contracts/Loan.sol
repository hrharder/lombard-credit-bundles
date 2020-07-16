pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Math.sol";

contract Loan is ERC20, Math {

    // ERC-20
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public shares; // total supply

    address payable public borrower;
    address public collateralAsset;
    uint256 public collateralID;
    uint256 public loanEndTime;
    uint256 public loanAmount;
    uint256 public totalRequiredPayment;

    uint256 public auctionStartBlock = 0;
    uint256 public auctionStartPrice;
    uint256 public auctionPerBlockPriceReduction;

    bool public loanInitiated = false;
    bool public auctionEnded = false;
    bool public loanRepaid = false;
    bool public loanFunded = false;

    IERC721 private _collateralToken;

    event LoanFunded(address funder);
    event LoanInitiated(address initiator);
    event LoanRepaid(address repayer);
    event LoanShareRedeemed(address redeemer, uint256 sharesRedeemed, uint256 payout);
    event CollateralAuctionInitiated(address initiator, uint256 endingBlock);
    event ColalteralPurchased(address buyer, uint256 winningBid);

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

        _collateralToken = IERC721(_collateralAsset);
    }

    // Any user can fund the loan by sending exactly the loan amount in ether along with the method call.
    function fundLoan() public payable {
        require(!loanFunded, "loan already funded");
        require(msg.value == loanAmount, "must send loan value when constructing loan contract");

        loanFunded = true;
        _mint(msg.sender, shares);
        emit LoanFunded(msg.sender);
    }

    // Initiate the loan by transfering the collateral from the borrower to the loan contract, and dispersing the loan
    // amount (in ether) to the borrower.
    //
    // As long as the borrower has agreed to the loan terms by approving the loan contract to transfer the agreed upon
    // collateral asset, any user can initiate the loan (liquidity will always go the borrower).
    //
    // The loan must be funded before being initiated.
    function initiateLoan() public {
        require(loanFunded, "loan unfunded");
        require(!loanInitiated, "loan was already borrowed");

        _collateralToken.transferFrom(borrower, address(this), collateralID);
        borrower.transfer(loanAmount);
        loanInitiated = true;
        emit LoanInitiated(msg.sender);
    }

    // If the loan has not been paid and the expiration date has passed, a dutch auction for the colalteral can be
    // initiated by any user, after which bids can be submitted with buyCollateralDuringAuction().
    function initiateCollateralAuction() public {
        require(loanInitiated, "loan never initiated");
        require(loanEndTime <= now, "loan not ended");
        require(totalRequiredPayment < address(this).balance || !loanRepaid, "loan is paid");
        require(!auctionEnded, "auction already ended");

        auctionStartBlock = block.number;
        uint256 auctionEndingBlock = add(block.number, auctionStartPrice / auctionPerBlockPriceReduction);
        emit CollateralAuctionInitiated(msg.sender, auctionEndingBlock);
    }

    // Fetches the current auction price if it has started, defined as the starting price minus the per-block price
    // reduction times the number of blocks that have transpired since the auction starting block.
    //
    // If called in the same block as initiateCollateralAuction(), the price will be the starting price.
    function getPrice() public view returns (uint256) {
        require(auctionStartBlock > 0, "auction not started");

        uint256 blockDiff = sub(block.number, auctionStartBlock);
        uint256 priceDecay = mul(auctionPerBlockPriceReduction, blockDiff);
        return sub(auctionStartPrice, priceDecay);
    }

    // Allow users to bid at or above the current auction price for the collateral, if an auction has been initiated.
    //
    // If the bidder sends in a higher bid than the current price, the extra ether IS returned to the bidder.
    function buyCollateralDuringAuction() public payable {
        require(!auctionEnded, "auction already ended");
        require(getPrice() >= 0, "price is less than 0");
        require(msg.value >= getPrice(), "insufficient bid");

        auctionEnded = true;
        _collateralToken.transferFrom(address(this), msg.sender, collateralID);
        emit ColalteralPurchased(msg.sender, getPrice());

        // pay-back bidder what they over-paid
        uint256 overpay = sub(msg.value, getPrice());
        if (overpay > 0) {
            msg.sender.transfer(overpay);
        }
    }

    // Allows any user (including the borrower) to pay-back the loan, after which the collateral asset is transfered
    // back to the borrower.
    //
    // Extra ETH is NOT returned to the sender of this function, and will be available to claim by holders of the token.
    function reclaimCollateral() external payable {
        require(auctionStartBlock == 0, "auction has started");
        require(!loanRepaid, "loan already repaid");
        require(loanInitiated, "loan never initiated");
        require(address(this).balance >= totalRequiredPayment, "loan underpaid");

        loanRepaid = true;
        _collateralToken.transferFrom(address(this), borrower, collateralID);
        emit LoanRepaid(msg.sender);
    }

    // Allows users who hold "shares" in the loan to claim payment (any ETH in the contract) after the collateral has
    // been auctioned or after the loan has been re-paid.
    //
    // Callers of this function must hold shares in the loan, and all shares held will be burned (no partial claims).
    function claimPayment() public {
        require(auctionEnded || loanRepaid, "either loan wasn't replayed or auction hasn't ended");
        require(balanceOf(msg.sender) > 0, "sender holds no claim to payment");
        require(address(this).balance > 0, "no payment to claim");

        uint256 accountBalance = balanceOf(msg.sender);
        uint256 accountClaim = mul(accountBalance / totalSupply(), address(this).balance);
        _burn(msg.sender, accountBalance);
        msg.sender.transfer(accountClaim);
        emit LoanShareRedeemed(msg.sender, accountBalance, accountClaim);
    }

    // Discourage direct payment ouside of bidding or re-payment of loans.
    function() external payable {
        revert("use correct functions for bidding and re-paying loans");
    }
}
