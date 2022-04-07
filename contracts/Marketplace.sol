//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./myERC721.sol";


contract Marketplace{

  uint currentTokenId = 0;
  uint private fee = 1;
  address currency;
  MyERC721 NFT;
  address owner;
  uint auctionDuration = 2592*(10**5);

  struct Seller {
    uint price;
    address owner;
  }

  struct Auction {
    address owner;
    uint currentPrice;
    address bidder;
    uint bets;
    uint minOdds;
    uint startedTime;
  }

  mapping (uint => Seller) listing;
  mapping (uint => Auction) auction;

  event ItemCreated(address indexed owner, uint indexed tokenId, string tokenURL);
  event Buy(address indexed customer, uint indexed tokenId, uint price);
  event ItemListed(address indexed owner, uint indexed tokenId, uint price);
  event canceled(address indexed owner, uint indexed tokenId);
  event AuctionStarts(address indexed owner, uint indexed tokenId, uint startedPrice);
  event Bid(address indexed bidder, uint indexed tokenId, uint betValue);
  event AuctionFinished(address indexed seller, address indexed customer, uint indexed tokenId, uint price);
  event Auctioncanceled(address indexed owner, uint indexed tokenId);

  modifier IsOnSale(uint _tokenId){
    require(listing[_tokenId].owner != address(0), "Error: This item isn't on sell!");
    _;
  }

  modifier OnlyOwner(){
    require(msg.sender == owner, "Error: You are not owner!");
    _;
  }

  constructor(string memory _name, string memory _symbol, bytes32 _adminRole, address _currency){
    NFT = new MyERC721(_name, _symbol, _adminRole);
    currency = _currency;
    owner = msg.sender;
  }

  function getERC721Address() view public returns (address) {
    return NFT.getAddress();
  }

  function getFee() view public returns(uint){
    return fee;
  }

  function setFee(uint _fee) public OnlyOwner{
    fee = _fee;
  }

  function createNewItem(string memory _tokenURL) public returns(bool){
    try NFT.mint(msg.sender, currentTokenId, _tokenURL) {
      emit ItemCreated(msg.sender, currentTokenId, _tokenURL);
      currentTokenId++;
      return true;
    }catch{
      return false;
    }
  }

  function getOwner(uint _tokenId) view public returns (address) {
    return NFT.ownerOf(_tokenId);
  }

  function getTokenURI(uint _tokenId) view public returns (string memory) {
    return NFT.getTokenURI(_tokenId);
  }

  function listItem(uint _tokenId, uint _price) public {

    _transferFromERC721(msg.sender, address(this), _tokenId);

    listing[_tokenId].price = _price;
    listing[_tokenId].owner = msg.sender;

    emit ItemListed(msg.sender, _tokenId, _price);

  }

  function getPriceOfListedItem(uint _tokenId) view public returns (uint){

    require(listing[_tokenId].price != 0, "Error: This token isn't for sale!");
    return listing[_tokenId].price;

  }

  function _transferERC20(address _to, uint _amount) internal {

    (bool success,) = currency.call(abi.encodeWithSignature("transfer(address,uint256)", _to, _amount));
    require(success, "Error: Can't transfer your token! Something is wrong!");

  }

  function _transferERC721(address _to, uint _tokenId) internal {

    NFT.transfer(_to, _tokenId);

  }

  function _transferFromERC20(address _from, address _to, uint _amount) internal {
     (bool success, bytes memory data) = currency.call(abi.encodeWithSignature("allowance(address,address)", _from, _to));
     uint allowance = abi.decode(data,(uint));
     require(allowance >= _amount, "Error: To buy item you have to allow to withdraw some tokens!");
     (success,) = currency.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", _from, _to, _amount));
     require(success, "Error: Can't transferFrom your token! Something is wrong!");
  }

  function _transferFromERC721(address _from, address _to, uint _tokenId) internal {
    require(NFT.ownerOf(_tokenId) == _from, "Error: You are not owner of this token!");
    bool isApproved = NFT.isApproved(_to, _tokenId);

    require(isApproved, "Error: Please approve this token to this contract!");
    NFT.transferFrom(_from, _to, _tokenId);

  }



  function buyItem(uint _tokenId) public IsOnSale(_tokenId){
    _transferFromERC20(msg.sender, address(this), listing[_tokenId].price);
    NFT.transfer(msg.sender, _tokenId);
    uint pay = listing[_tokenId].price - (listing[_tokenId].price/100)*fee;
    _transferERC20(listing[_tokenId].owner,  pay);
    emit Buy(msg.sender, _tokenId, listing[_tokenId].price);
  }

  function cancel(uint _tokenId) public IsOnSale(_tokenId){
    require(listing[_tokenId].owner == msg.sender, "Error: You can't cancel this sale because are not owner of this token!");
    delete listing[_tokenId];
    NFT.transfer(msg.sender, _tokenId);

    emit canceled(msg.sender, _tokenId);

  }

  function listItemOnAuction(uint _tokenId, uint _startedPrice, uint _minOdds) public {
    _transferFromERC721(msg.sender, address(this), _tokenId);
    Auction storage auctionParams = auction[_tokenId];
    auctionParams.owner = msg.sender;
    auctionParams.currentPrice = _startedPrice;
    auctionParams.minOdds = _minOdds;
    auctionParams.startedTime = block.timestamp;

    emit AuctionStarts(msg.sender, _tokenId, _startedPrice);
  }

  function getAuction(uint _tokenId) public view returns (Auction memory){
    return auction[_tokenId];
  }

  function makeBid(uint _tokenId, uint bet) public {
    Auction storage auctionParams = auction[_tokenId];
    require(auctionParams.owner != address(0), "Error: Sorry, but this token isn't on sale!");
    if(auction[_tokenId].startedTime + auctionDuration <= block.timestamp){
      _finishAuction(_tokenId);
      revert("Sorry but auction is already finished!");
    }
    if(auctionParams.bidder != address(0)){
      require(auctionParams.currentPrice + auctionParams.minOdds <= bet, "Error: You bet is lower than current price. Please increase you bet!");
      _transferERC20(auctionParams.bidder, auctionParams.currentPrice);
    }else{
      require(auctionParams.currentPrice <= bet, "Error: You bet is lower than current price. Please increase you bet!");
    }
     _transferFromERC20(msg.sender, address(this), bet);
     auctionParams.bidder = msg.sender;
     auctionParams.currentPrice = bet;
     auctionParams.bets++;

     emit Bid(msg.sender, _tokenId, bet);

  }

  function finishAuction(uint _tokenId) public {
      _finishAuction(_tokenId);
  }

  function _finishAuction(uint _tokenId) internal {
  require(auction[_tokenId].startedTime + auctionDuration <= block.timestamp, "Error: Cannot finish this auction while 3 days aren't run out!");
  if(auction[_tokenId].bets >= 2){
    _transferERC20(auction[_tokenId].owner, auction[_tokenId].currentPrice - (auction[_tokenId].currentPrice/100)*fee);
    _transferERC721(auction[_tokenId].bidder, _tokenId);
    emit AuctionFinished(auction[_tokenId].owner, auction[_tokenId].bidder, _tokenId, auction[_tokenId].currentPrice);
  }else{
    if(auction[_tokenId].bets != 0){
      _transferERC20(auction[_tokenId].bidder, auction[_tokenId].currentPrice);
    }
      _transferERC721(auction[_tokenId].owner, _tokenId);
      emit Auctioncanceled(auction[_tokenId].owner, _tokenId);
  }
  delete auction[_tokenId];
  }

}
