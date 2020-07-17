import { accounts, contract } from "@openzeppelin/test-environment";
const { BN, ether, balance, constants, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");
import { expect } from "chai";
import "mocha";

const CollateralNFT = contract.fromArtifact("DummyERC721");
const Loan = contract.fromArtifact("Loan");

const bn = (n: any) => new BN(n);

describe("Loan", async () => {
    const [deployer, borrower, lender] = accounts;

    // Dummy parameters:
    // - 1 ETH loan over 30 years, repayment amount 1.54 ETH (~3% APR)
    // - Auction starts at 12 ETH and drops by 0.000023 ETH per block (~10 day mainnet auction)
    // - 100 loan shares (6 decimals)
    const defaultLoanAmount = new ether("1");
    const defaultRepaymentAmount = new ether("1.54");
    const defaultAuctionStartPrice = new ether("1.2");
    const defaultAuctionDropRatePerBlock = new ether("0.000023");
    const defaultLoanExpiry = bn(Math.floor(Date.now() / 1000) + 933120000);
    const defaultLoanShares = bn(100000000);
    const defaultLoanSharesDecimals = bn(6);

    const defaultCollateralAssetID = bn(6);
    let collateralAsset: any = undefined;

    beforeEach(async function () {
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

            expect(await loan.loanInitiated(), "loan borrowed").to.be.false;
            expect(await loan.auctionEnded(), "loan auction ended").to.be.false;
            expect(await loan.loanRepaid(), "loan repaid").to.be.false;
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

    describe("initiateLoan", async () => {
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
            await expectRevert(loan.initiateLoan({ from: borrower }), "loan unfunded");
        });

        it("should not allow the loan to begin if the borrower has not approved the loan contract", async () => {
            await fundLoan();
            await expectRevert(
                loan.initiateLoan({ from: borrower }),
                "ERC721: transfer caller is not owner nor approved",
            );
        });

        it("should allow the loan to begin if the borrower has approved the loan contract and has the required NFT", async () => {
            await fundLoan();
            await collateralAsset.setApprovalForAll(loan.address, true, { from: borrower });

            const borrowerEthBalanceBeforeLoan = await balance.current(borrower);
            expect(await collateralAsset.ownerOf(defaultCollateralAssetID)).to.eql(borrower);

            // anyone can initiate the loan, given the conditions are met
            await loan.initiateLoan({ from: deployer });
            expect(await collateralAsset.ownerOf(defaultCollateralAssetID)).to.eql(loan.address);
            expect((await balance.current(borrower)).eq(borrowerEthBalanceBeforeLoan.add(defaultLoanAmount))).to.be
                .true;
        });

        it("should not allow the loan to be borrowed twice", async () => {
            await fundLoan();
            await collateralAsset.setApprovalForAll(loan.address, true, { from: borrower });
            await loan.initiateLoan({ from: deployer });
            expect(await collateralAsset.ownerOf(defaultCollateralAssetID)).to.eql(loan.address);
            await expectRevert(loan.initiateLoan({ from: deployer }), "loan was already borrowed");
        });
    });

    describe("initiateCollateralAuction (& all auction methods)", async () => {
        let loan: any;
        const getExpirationTime = async () => (await time.latest()).add(bn(100000));
        const fundLoan = async () => loan.fundLoan({ from: lender, value: defaultLoanAmount });
        const initiateLoan = async () => loan.initiateLoan({ from: deployer });
        const startAuction = async () => loan.initiateCollateralAuction({ from: deployer });
        const payOffLoan = async () => loan.reclaimCollateral({ from: borrower, value: defaultRepaymentAmount });
        const borrowerApproveContract = async () =>
            collateralAsset.setApprovalForAll(loan.address, true, { from: borrower });
        const skipToEndOfLoan = async () => time.increaseTo((await loan.loanEndTime()).add(bn(100)));

        beforeEach(async () => {
            loan = await Loan.new(
                "LOAN-A1",
                "LA1",

                // 100 shares with 6 decimals (e.g. 100.000000 total supply)
                defaultLoanSharesDecimals,
                defaultLoanShares,

                collateralAsset.address,
                defaultCollateralAssetID,
                await getExpirationTime(),
                borrower,
                defaultLoanAmount,
                defaultRepaymentAmount,
                defaultAuctionStartPrice,
                defaultAuctionDropRatePerBlock,
                { from: deployer },
            );
        });

        it("should not allow the auction to begin if the loan is not expired", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            expect((await loan.loanEndTime()).gt(time.latest())).to.be.true;
            await expectRevert(startAuction(), "loan not ended");
        });

        it("should not allow the auction to begin if the loan is paid and expired", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await payOffLoan();
            expect(await loan.loanRepaid(), "loan not paid").to.be.true;

            await skipToEndOfLoan();
            expect((await loan.loanEndTime()).lt(await time.latest()), "loan not expired").to.be.true;
            await expectRevert(startAuction(), "loan is paid");
        });

        it("should allow the auction to begin if the loan is not paid and expired", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await skipToEndOfLoan();
            expect((await balance.current(loan.address)).eq(bn(0))).to.be.true;
            expect((await loan.loanEndTime()).gt(await time.latest())).to.be.false;
            await startAuction();
            expect((await loan.auctionStartBlock()).eq(await time.latestBlock())).to.be.true;
        });

        it("should have an initial auction price that matches the value include in the loan terms", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await skipToEndOfLoan();
            await startAuction();
            expect((await loan.getPrice()).eq(defaultAuctionStartPrice)).to.be.true;
        });

        it("should decrease the price by the correct amount each block", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await skipToEndOfLoan();
            await startAuction();

            expect((await loan.getPrice()).eq(defaultAuctionStartPrice)).to.be.true;
            await time.advanceBlock();
            await time.advanceBlock();
            await time.advanceBlock();
            expect((await loan.getPrice()).eq(defaultAuctionStartPrice.sub(defaultAuctionDropRatePerBlock.mul(bn(3)))));
        });

        it("should allow a bidder to purchase the collateral if they pay enough during an auction", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await skipToEndOfLoan();
            await startAuction();

            expect((await loan.getPrice()).eq(defaultAuctionStartPrice)).to.be.true;
            await time.advanceBlock();
            await time.advanceBlock();
            await time.advanceBlock();
            expect(await collateralAsset.ownerOf(defaultCollateralAssetID)).to.eql(loan.address);
            await loan.buyCollateralDuringAuction({ from: lender, value: await loan.getPrice() });
            expect(await collateralAsset.ownerOf(defaultCollateralAssetID)).to.eql(lender);
        });

        it("should not allow a bidder to purchase the collateral if they don't pay enough during an auction", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await skipToEndOfLoan();
            await startAuction();
            await time.advanceBlock();
            await time.advanceBlock();
            await time.advanceBlock();
            await expectRevert(loan.buyCollateralDuringAuction({ from: lender, value: bn(10000) }), "insufficient bid");
        });

        it("should not allow a bidder to purchase the collateral if an auction is not underway yet", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await expectRevert(
                loan.buyCollateralDuringAuction({ from: lender, value: new ether("2") }),
                "auction not started",
            );
        });

        it("should not allow a bidder to purchase the collateral if an auction has ended", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await skipToEndOfLoan();
            await startAuction();

            await time.advanceBlock();
            await time.advanceBlock();
            await time.advanceBlock();
            await loan.buyCollateralDuringAuction({ from: lender, value: await loan.getPrice() });
            await expectRevert(
                loan.buyCollateralDuringAuction({ from: borrower, value: new ether("2") }),
                "auction already ended",
            );
        });

        it("should re-fund the bidder if they over-pay", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await skipToEndOfLoan();
            await startAuction();

            const price = await loan.getPrice();
            const overpayAmount = (await loan.getPrice()).add(new ether("1"));
            expect((await balance.current(loan.address)).eq(bn(0)), "balance not 0").to.be.true;
            await loan.buyCollateralDuringAuction({
                from: borrower,
                value: price.add(overpayAmount),
            });
            expect(
                (await balance.current(loan.address)).eq(price.sub(defaultAuctionDropRatePerBlock.mul(bn(1)))),
                "contract balance not equal price",
            ).to.be.true;
        });
    });

    describe("claimPayment", async () => {
        let loan: any;
        const getExpirationTime = async () => (await time.latest()).add(bn(100000));
        const fundLoan = async () => loan.fundLoan({ from: lender, value: defaultLoanAmount });
        const initiateLoan = async () => loan.initiateLoan({ from: deployer });
        const startAuction = async () => loan.initiateCollateralAuction({ from: deployer });
        const borrowerApproveContract = async () =>
            collateralAsset.setApprovalForAll(loan.address, true, { from: borrower });
        const skipToEndOfLoan = async () => time.increaseTo((await loan.loanEndTime()).add(bn(100)));

        beforeEach(async () => {
            loan = await Loan.new(
                "LOAN-A1",
                "LA1",

                // 100 shares with 6 decimals (e.g. 100.000000 total supply)
                defaultLoanSharesDecimals,
                defaultLoanShares,

                collateralAsset.address,
                defaultCollateralAssetID,
                await getExpirationTime(),
                borrower,
                defaultLoanAmount,
                defaultRepaymentAmount,
                defaultAuctionStartPrice,
                defaultAuctionDropRatePerBlock,
                { from: deployer },
            );
        });

        it("should allow a holder of all shares to claim all value in the contract after an auction", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await skipToEndOfLoan();
            await startAuction();
            await loan.buyCollateralDuringAuction({ from: lender, value: await loan.getPrice() });

            expect((await loan.totalSupply()).eq(await loan.balanceOf(lender))).to.be.true;
            const lenderBalanceBefore = await balance.current(lender);
            await loan.claimPayment({ from: lender });
            expect((await balance.current(lender)).gt(lenderBalanceBefore)).to.be.true;
            expect((await loan.totalSupply()).eq(bn(0))).to.be.true;
        });

        it("should not allow a user with no loan tokens to claim a reward", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await skipToEndOfLoan();
            await startAuction();
            await loan.buyCollateralDuringAuction({ from: lender, value: await loan.getPrice() });

            expect(bn(0).eq(await loan.balanceOf(borrower))).to.be.true;
            await expectRevert(loan.claimPayment({ from: borrower }), "sender holds no claim to payment");
        });

        it("should not allow any claim to be made if loan not expired", async () => {
            await fundLoan();
            await borrowerApproveContract();
            await initiateLoan();
            await expectRevert(
                loan.claimPayment({ from: lender }),
                "either loan wasn't replayed or auction hasn't ended",
            );
        });
    });
});
