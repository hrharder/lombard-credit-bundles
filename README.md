# Lombard Credit Bundles

## Overview

Lombard Credit Bundles (LCBs) are ERC-20 tokens redeemable for bundled loan payments secured by valuable NFTs. LCBs provide borrowers a way to leverage asset value for liquidity and provides investors a unique yield opportunity.

## Details

The core primitive of LCBs are ERC20-based loans which represent an agreement between a lender (or pool of lenders) and a borrower for some principal amount (denominated in ETH), collateralized with an ERC721 asset, that is to be repaid, plus interest, before some agreed upon date. If the loan is not serviced before the agreed upon date, it goes into a state of default this triggers a dutch auction which sells the collateral to reduce the outstanding debt. The loan agreement itself is fungible (as an ERC20 token). Owners of the loan are entitled to a proportional share the repayment amount or, in the case of default, a proportional share of the auction proceeds.

LCB combines these core loan primitives into loan/credit bundles. The bundles are represented again as an ERC20 token. Each bundle has a balance of underlying loan tokens which is the basis of the blended instrument's value. Similarly to individual loans, owners of the loan bundle are entitled to a proportional share of each of the underlying loans' final value. By combining loans with different risk profiles into a single fungible instrument a unique yield-bearing asset is created.

## How it works
