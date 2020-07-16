pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Loan.sol";

contract LoanFactory {
    mapping(address => mapping(uint256 => address)) public loansByCollateral;

    function deployLoanToken(
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
    ) public returns (address) {
        Loan newLoan = (
            new Loan(
                _name,
                _symbol,
                _decimals,
                _shares,
                _collateralAsset,
                _collateralID,
                _loanEndTime,
                _borrower,
                _loanAmount,
                _totalRequiredPayment,
                _auctionStartPrice,
                _auctionPerBlockPriceReduction
            )
        );
        loansByCollateral[_collateralAsset][_collateralID] = address(newLoan);
        return address(newLoan);
    }
}
