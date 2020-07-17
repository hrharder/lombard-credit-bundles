# Lombard Credit Bundles

## Overview

Lombard Credit Bundles (LCBs) are ERC-20 tokens redeemable for bundled loan payments secured by valuable NFTs. LCBs provide borrowers a way to leverage asset value for liquidity and provides investors a unique yield opportunity.

## Details

The core primitive of LCBs are ERC20-based loans which represent an agreement between a lender (or pool of lenders) and a borrower for some principal amount (denominated in ETH), collateralized with an ERC721 asset, that is to be repaid, plus interest, before some agreed upon date. If the loan is not serviced before the agreed upon date, it goes into a state of default this triggers a dutch auction which sells the collateral to reduce the outstanding debt. The loan agreement itself is fungible (as an ERC20 token). Owners of the loan are entitled to a proportional share the repayment amount or, in the case of default, a proportional share of the auction proceeds.

LCB combines these core loan primitives into loan/credit bundles. The bundles are represented again as an ERC20 token. Each bundle has a balance of underlying loan tokens which is the basis of the blended instrument's value. Similarly to individual loans, owners of the loan bundle are entitled to a proportional share of each of the underlying loans' final value. By combining loans with different risk profiles into a single fungible instrument a unique yield-bearing asset is created.

## How it works

### Loan creation

1. The **lender** and **borrower** communicate through an arbitrary channel to negotiate the terms of a loan. Specifically the **borrower** and **lender** must agree upon the ERC721 `_collateralAsset address`, `_collateralID uint256`, `_loanEndTime uint256`, `_borrower address`, `_loanAmount uint256`, `_totalRequiredPayment uint256`, `_auctionStartPrice uint256`, `_auctionPerBlockPriceReduction uint256`.
2. The **lender** creates a new loan (using `deployLoanToken()` on the deployed `LoanFactory` contract).
3. The **lender** funds the loan (`fundLoan()`) by sending the agreed upon loan amount (`_loanAmount`). During this step the lender will receive tokens representing the loan.
4. The **borrower** grants approval to the newly created loan contract for the agreed upon ERC721 asset.
5. The **borrower** retrieves the loan amount by calling `initiateLoan()` on the loan contract. This step will send the NFT asset to the loan contract and will send the principal amount to the **borrower**.

**Note:** Anyone can call the `deployLoanToken()` method to create a new `Loan` contract, however in order for the loan to successfully initialize, the lender must fund the loan contract with ETH, and the borrower must approve the new Loan contract to spend the agreed upon collateral asset. Because the borrower must know the new Loan contract address in order to approve it, they have the ability to inspect the parameters of the loan before agreeing to it. These two transactions (funding from the lender, approval from the borrower) constitute the on-chain "agreement" between parties that allows the capital to be deployed to the borrower at the agreed upon rate.

## Deployments

### Mainnet

⚠️ **WARNING:** DO NOT USE except for experimentation. These contracts were written in under 24 hours by two solidity novices. ⚠️
🚨 Expect fatal errors, vulnerabilities and 100% loss of funds if these contracts are used. 🚨

| Contract name       | Notes                                               | Address Link                                                                                                            |
| :------------------ | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| `LoanFactory`       | Define terms and deploy `Loan` contracts.           | [`0xd5fa11b5e66ffe99a4026e0922102bba4bd3e5d2`](https://etherscan.io/address/0xd5fa11b5e66ffe99a4026e0922102bba4bd3e5d2) |
| `LoanBundleFactory` | Deploy loan bundles of one or more `Loan` contract. | [`0xd5fa11b5e66ffe99a4026e0922102bba4bd3e5d2`](https://etherscan.io/address/0xd5fa11b5e66ffe99a4026e0922102bba4bd3e5d2) |
