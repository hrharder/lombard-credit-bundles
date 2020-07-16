pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract DummyERC721 is ERC721 {
    function mint(uint256 id) public {
        _safeMint(msg.sender, id);
    }
}
