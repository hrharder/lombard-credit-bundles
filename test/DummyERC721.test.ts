import { accounts, contract } from "@openzeppelin/test-environment";
const testHelpers = require("@openzeppelin/test-helpers");
import { expect } from "chai";
import "mocha";

const DummyNFT = contract.fromArtifact("DummyERC721");
describe("Mint", async () => {
  const [owner, otherAccount] = accounts;

  let dummyNFT: any = undefined;
  beforeEach(async function() {
    dummyNFT = await DummyNFT.new({ from: owner });
  });

  it("should be able to mint an NFT with any ID", async () => {
    // mint token to self
    await dummyNFT.mint(3, { from: owner });

    expect(await dummyNFT.ownerOf(3)).to.eql(owner);
  });
});
