import { accounts, contract } from "@openzeppelin/test-environment";
const { BN, ether, balance, constants, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");
import { expect } from "chai";
import "mocha";

const CollateralNFT = contract.fromArtifact("DummyERC721");
const Loan = contract.fromArtifact("Loan");
const LoanBundle = contract.fromArtifact("LoanBundle");

const bn = (n: any) => new BN(n);

describe("LoanBundle", async () => {
    const [deployer, borrower, lender] = accounts;

    // Dummy parameters:
    // - 10 ETH loan over 1 year, repayment amount 15 ETH (50% APR)
    // - Auction starts at 15 ETH and drops by 0.01 ETH per block (~37.5 min auction)
    // - 100 loan shares (6 decimals)
    const defaultLoanAmount = new ether("10");
    const defaultRepaymentAmount = new ether("15");
    const defaultAuctionStartPrice = new ether("15");
    const defaultAuctionDropRatePerBlock = new ether("0.01");
    const defaultLoanExpiry = bn(Math.floor(Date.now() / 1_000) + 31_536_000);
    const defaultLoanShares = bn(100_000_000);
    const defaultLoanSharesDecimals = bn(6);

    let collateralAsset: any = undefined;

    let loanList: any[] = [];
    let loanAddressList: any = undefined;
    let loanBundle: any = undefined;

    async function createNftAndLoan(assetID: number) {
        await collateralAsset.mint(assetID, { from: borrower });
        const loan = await Loan.new(
            `LOAN-A${assetID}`,
            `LA1${assetID}`,

            // 100 shares with 6 decimals (e.g. 100.000000 total supply)
            defaultLoanSharesDecimals,
            defaultLoanShares,

            collateralAsset.address,
            bn(assetID),
            defaultLoanExpiry,
            borrower,
            defaultLoanAmount,
            defaultRepaymentAmount,
            defaultAuctionStartPrice,
            defaultAuctionDropRatePerBlock,
            { from: deployer },
        );
        return loan;
    }

    beforeEach(async function() {
        collateralAsset = await CollateralNFT.new({ from: deployer });
        loanList = [];
        for (let i = 0; i < 5; i++) {
            const loan = await createNftAndLoan(i);
            loanList.push(loan);
        }

        loanAddressList = loanList.map(x => x.address);

        loanBundle = await LoanBundle.new(
            "LOAN-BUNDLE-1",
            "LB1",
            defaultLoanSharesDecimals,
            loanAddressList,
            defaultLoanShares,
            { from: deployer },
        );
    });

    describe("constructor", async () => {
        it("should correctly initialize parameters upon deployment", async () => {
            expect(await loanBundle.name()).to.eql("LOAN-BUNDLE-1");
            expect(await loanBundle.symbol()).to.eql("LB1");
            expect((await loanBundle.decimals()).eq(defaultLoanSharesDecimals)).to.be.true;
            expect(await loanBundle.loanArray(1)).to.eql(loanAddressList[1]);
            expect((await loanBundle.balanceOf(deployer)).eq(bn(100_000_000))).to.be.true;
        });
    });

    describe("claimPaymentForContract", async () => {
        it("should correctly claim payment", async () => {
            for (let i = 0; i < loanList.length; i++) {
                await loanList[i].fundLoan({ from: lender, value: defaultLoanAmount });
                await collateralAsset.approve(loanList[i].address, bn(i), { from: borrower });
                await loanList[i].initiateLoan({ from: borrower });
                await loanList[i].transfer(loanBundle.address, bn(10_000_000), { from: lender });
            }
            time.increaseTo(Math.floor(Date.now() / 1_000) + 30_536_000);
            for (let i = 0; i < loanList.length; i++) {
                await loanList[i].reclaimCollateral({ from: borrower, value: defaultRepaymentAmount });
            }
            const loanBundleBalanceBefore = await balance.current(loanBundle.address);
            await loanBundle.claimPaymentForContract({ from: lender });
            expect((await balance.current(loanBundle.address)).gt(loanBundleBalanceBefore)).to.be.true;
            const deployerBalanceBefore = await balance.current(deployer);
            await loanBundle.claimPayment({ from: deployer });
            expect((await balance.current(deployer)).gt(deployerBalanceBefore)).to.be.true;
        });
    });
});
