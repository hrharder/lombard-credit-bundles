import { accounts, contract } from "@openzeppelin/test-environment";
const { BN, ether, balance, constants, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
import { expect } from "chai";
import "mocha";

const CollateralNFT = contract.fromArtifact("DummyERC721");
const Loan = contract.fromArtifact("Loan");

const bn = (n: any) => new BN(n);

describe("Loan", async () => {
    const [deployer, borrower, lender] = accounts;

    // Dummy parameters:
    // - 10 ETH loan over 30 years, repayment amount 1.54 ETH (~3% APR)
    // - Auction starts at 12 ETH and drops by 0.00023 ETH per block (~10 day mainnet auction)
    // - 100 loan shares (6 decimals)
    const defaultLoanAmount = new ether("10");
    const defaultRepaymentAmount = new ether("15.4");
    const defaultAuctionStartPrice = new ether("12");
    const defaultAuctionDropRatePerBlock = new ether("0.00023");
    const defaultLoanExpiry = bn(Math.floor(Date.now() / 1000) + 933120000);
    const defaultLoanShares = bn(100000000);
    const defaultLoanSharesDecimals = bn(6);

    const defaultCollateralAssetID = bn(6);
    let collateralAsset: any = undefined;

    beforeEach(async function() {
        collateralAsset = await CollateralNFT.new({ from: deployer });
        await collateralAsset.mint(6, { from: borrower });
    });

    describe("constructor", async () => {
        it("should enable deployment of a loan with parameters set correctly", async () => {
            const loan = await Loan.new(
                "LOAN-A1",
                "LA1",

                // 100 shares with 6 decimals (e.g. 100.000000 total supply)
                defaultLoanSharesDecimals,
                defaultLoanShares,

                collateralAsset.address,
                defaultCollateralAssetID,
                defaultLoanExpiry,
                borrower,
                defaultLoanAmount,
                defaultRepaymentAmount,
                defaultAuctionStartPrice,
                defaultAuctionDropRatePerBlock,
                { from: deployer },
            );
            expect(await loan.name()).to.eql("LOAN-A1");
            expect(await loan.symbol()).to.eql("LA1");
            expect((await loan.decimals()).eq(defaultLoanSharesDecimals)).to.be.true;

            expect((await loan.shares()).eq(defaultLoanShares)).to.be.true;
            expect(await loan.collateralAsset()).to.eql(collateralAsset.address);
            expect((await loan.collateralID()).eq(defaultCollateralAssetID)).to.be.true;
            expect((await loan.loanEndTime()).eq(defaultLoanExpiry)).to.be.true;
            expect(await loan.borrower()).to.eql(borrower);
            expect((await loan.loanAmount()).eq(defaultLoanAmount)).to.be.true;
            expect((await loan.totalRequiredPayment()).eq(defaultRepaymentAmount)).to.be.true;

            expect(
                (await loan.auctionStartPrice()).eq(defaultAuctionStartPrice),
                "auction start price not set correctly",
            ).to.be.true;
            expect(
                (await loan.auctionPerBlockPriceReduction()).eq(defaultAuctionDropRatePerBlock),
                "auction price reduction not correct",
            ).to.be.true;
            expect((await loan.auctionStartBlock()).eq(bn(0)), "auction start not 0").to.be.true;

            expect(await loan.loanBorrowed(), "loan borrowed").to.be.false;
            expect(await loan.auctionEnded(), "loan auction ended").to.be.false;
            expect(await loan.loanRepayed(), "loan re-payed").to.be.false;
            expect(await loan.loanFunded(), "loan funded").to.be.false;
        });
    });

    describe("fundLoan", async () => {
        let loan: any;

        beforeEach(async () => {
            loan = await Loan.new(
                "LOAN-A1",
                "LA1",

                // 100 shares with 6 decimals (e.g. 100.000000 total supply)
                defaultLoanSharesDecimals,
                defaultLoanShares,

                collateralAsset.address,
                defaultCollateralAssetID,
                defaultLoanExpiry,
                borrower,
                defaultLoanAmount,
                defaultRepaymentAmount,
                defaultAuctionStartPrice,
                defaultAuctionDropRatePerBlock,
                { from: deployer },
            );
        });

        it("should enable lender to fund loan", async () => {
            expect(await loan.loanFunded()).to.be.false;
            expect((await balance.current(loan.address)).eq(bn(0))).to.be.true;

            await loan.fundLoan({ from: lender, value: defaultLoanAmount });

            expect((await balance.current(loan.address)).eq(bn(defaultLoanAmount))).to.be.true;
            expect(await loan.loanFunded()).to.be.true;
        });

        it("should should revert if lender sends too much eth to fund loan", async () => {
            expect(await loan.loanFunded()).to.be.false;
            expect((await balance.current(loan.address)).eq(bn(0))).to.be.true;

            await expectRevert(
                loan.fundLoan({ from: lender, value: defaultLoanAmount.add(bn(1)) }),
                "must send loan value when constructing loan contract",
            );
        });
        it("should should revert if lender sends too little eth to fund loan", async () => {
            expect(await loan.loanFunded()).to.be.false;
            expect((await balance.current(loan.address)).eq(bn(0))).to.be.true;

            await expectRevert(
                loan.fundLoan({ from: lender, value: defaultLoanAmount.sub(bn(1)) }),
                "must send loan value when constructing loan contract",
            );
        });
        it("should give the correct number of shares to the lender after funding", async () => {
            expect(await loan.loanFunded()).to.be.false;
            expect((await loan.balanceOf(lender)).eq(bn(0))).to.be.true;

            await loan.fundLoan({ from: lender, value: defaultLoanAmount });

            expect((await balance.current(loan.address)).eq(bn(defaultLoanAmount))).to.be.true;
            expect((await loan.balanceOf(lender)).eq(defaultLoanShares)).to.be.true;
        });
        it("should not allow the loan to be funded twice", async () => {
            expect(await loan.loanFunded()).to.be.false;
            expect((await loan.balanceOf(lender)).eq(bn(0))).to.be.true;
            await loan.fundLoan({ from: lender, value: defaultLoanAmount });
            expect((await balance.current(loan.address)).eq(bn(defaultLoanAmount))).to.be.true;
            expect((await loan.balanceOf(lender)).eq(defaultLoanShares)).to.be.true;
            await expectRevert(loan.fundLoan({ from: lender, value: defaultLoanAmount }), "loan already funded");
        });
    });

    describe("borrow", async () => {
        let loan: any;
        const fundLoan = async () => loan.fundLoan({ from: lender, value: defaultLoanAmount });

        beforeEach(async () => {
            loan = await Loan.new(
                "LOAN-A1",
                "LA1",

                // 100 shares with 6 decimals (e.g. 100.000000 total supply)
                defaultLoanSharesDecimals,
                defaultLoanShares,

                collateralAsset.address,
                defaultCollateralAssetID,
                defaultLoanExpiry,
                borrower,
                defaultLoanAmount,
                defaultRepaymentAmount,
                defaultAuctionStartPrice,
                defaultAuctionDropRatePerBlock,
                { from: deployer },
            );
        });

        it("should not allow the borrower to borrow if the loan isn't funded", async () => {
            await expectRevert(loan.borrow({ from: borrower }), "loan unfunded");
        });

        it("should not allow the loan to begin if the borrower has not approved the loan contract", async () => {
            await fundLoan();
            await expectRevert(loan.borrow({ from: borrower }), "ERC721: transfer caller is not owner nor approved");
        });

        it("should allow the loan to begin if the borrower has approved the loan contract and has the required NFT", async () => {
            await fundLoan();
            await collateralAsset.setApprovalForAll(loan.address, true, { from: borrower });

            const borrowerEthBalanceBeforeLoan = await balance.current(borrower);
            expect(await collateralAsset.ownerOf(defaultCollateralAssetID)).to.eql(borrower);

            // anyone can initiate the loan, given the conditions are met
            await loan.borrow({ from: deployer });
            expect(await collateralAsset.ownerOf(defaultCollateralAssetID)).to.eql(loan.address);
            expect((await balance.current(borrower)).eq(borrowerEthBalanceBeforeLoan.add(defaultLoanAmount))).to.be
                .true;
        });

        it("should not allow the loan to be borrowed twice", async () => {
            await fundLoan();
            await collateralAsset.setApprovalForAll(loan.address, true, { from: borrower });
            await loan.borrow({ from: deployer });
            expect(await collateralAsset.ownerOf(defaultCollateralAssetID)).to.eql(loan.address);
            await expectRevert(loan.borrow({ from: deployer }), "loan was already borrowed");
        });
    });
});
