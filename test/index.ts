let { expect } = require("chai");
let hre = require("hardhat");
let {ethers} = hre;
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Signer, Contract, ContractFactory, BigNumber } from "ethers";
import Web3 from "web3";

  function getUri(id:number | string):string{
    return `https://site/CID/${id}`;
  }

describe("Testing marketplace functions", function () {
  let web3: any;
  hre.Web3 = Web3;
  hre.web3 = new Web3(hre.network.provider);
  web3 = hre.web3;

  let Marketplace: ContractFactory, marketplace: Contract,
      ERC20: ContractFactory, erc20: Contract, erc20_address: string,
      ERC721: ContractFactory, erc721: Contract, erc721_address: string,
      owner: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress, user3: SignerWithAddress,
      name: string = "Masterpeace",
      symbol: string = "MNFT",
      adminRole: string = Web3.utils.keccak256("admin"),
      tokenPrice: string = String(2*(10**18)),
      tokenPriceX2: string = String(4*(10**18)),
      tokenPriceX05: string = String(10**18),
      zeroAddress: string = "0x0000000000000000000000000000000000000000",
      auctionDuration: number = 2592*(10**5);

      async function increaseTime(time:any) {
         await web3.currentProvider._sendJsonRpcRequest({
           jsonrpc: '2.0',
           method: 'evm_increaseTime',
           params: [time],
           id: 0,
         }, () => {console.log("increace done!")});
         await web3.currentProvider._sendJsonRpcRequest({
           jsonrpc: '2.0',
           method: 'evm_mine',
           params: [],
           id: 0,
         }, () => {console.log("mining done!")});
         }


  beforeEach(async()=>{

    [owner, user1, user2, user3] = await ethers.getSigners();

    ERC20 = await ethers.getContractFactory("MyERC20");
    erc20 = await ERC20.connect(owner).deploy();
    await erc20.deployed();
    erc20_address = erc20.address;

    Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(name, symbol, adminRole, erc20_address);
    await marketplace.deployed();

    erc721_address = await marketplace.getERC721Address()

  })

  it("Testing get fee", async function () {
    let fee: string = "1";
    expect(await marketplace.getFee()).to.equal(fee);
  });

  it("Testing setFee function", async()=>{
    let prev_fee: string = "1";
    let new_fee: string = "2";
    expect(await marketplace.getFee()).to.equal(prev_fee);
    await marketplace.setFee(new_fee);
    expect(await marketplace.getFee()).to.equal(new_fee);
  })

  it("Testing createNewItem function", async()=>{

    await marketplace.connect(owner).createNewItem(getUri(0));
    await marketplace.connect(user1).createNewItem(getUri(1));
    await marketplace.connect(user2).createNewItem(getUri(2));
    expect(await marketplace.getOwner(0)).to.equal(owner.address);
    expect(await marketplace.getOwner(1)).to.equal(user1.address);
    expect(await marketplace.getOwner(2)).to.equal(user2.address);
    expect(await marketplace.getTokenURI(0)).to.equal(getUri(0));
    expect(await marketplace.getTokenURI(1)).to.equal(getUri(1));
    expect(await marketplace.getTokenURI(2)).to.equal(getUri(2));

  })

  async function mintAndApproveERC20(users: Array<SignerWithAddress>, amounts: Array<number | string>):Promise<boolean>{
      if(users.length != amounts.length){
        return false;
      }else{
        for(let i = 0; i < users.length; i++){
          await erc20.connect(owner).mint(users[i].address, amounts[i]);
          await approveERC20(users[i], marketplace.address, amounts[i]);
        }
        return true;
      }

  }

  async function approveERC721(sender: SignerWithAddress, spender:string, tokenId: number | string):Promise<any>{
    let data = web3.eth.abi.encodeFunctionCall({
      name: "approve",
      type: "function",
      inputs:[
        {
          name: "_spender",
          type: "address"
        },{
          name: "_tokenId",
          type: "uint256"
        }
      ]
    },[spender, tokenId]);
    await sender.sendTransaction({
      data, to: erc721_address
    });
  };

  async function approveERC20(from:SignerWithAddress, to: string, amount: string | number): Promise<void> {
      await erc20.connect(from).approve(to, amount);
  }

  it("Testing listItem funtion", async()=>{
    await marketplace.connect(owner).createNewItem(getUri(0));
    expect(await marketplace.getOwner(0)).to.equal(owner.address);
    await approveERC721(owner, marketplace.address, 0);
    await marketplace.connect(owner).listItem(0, tokenPrice);
    expect(String(await marketplace.getPriceOfListedItem(0))).to.equal(tokenPrice);

  })

  it("Testing buyItem function", async()=>{
    await mintAndApproveERC20([user1],[tokenPrice]);
    await marketplace.connect(owner).createNewItem(getUri(0));
    await approveERC721(owner, marketplace.address, 0);
    await marketplace.connect(owner).listItem(0, tokenPrice);
    await marketplace.connect(user1).buyItem(0);
    expect(await marketplace.getOwner(0)).to.equal(user1.address);
    let fee: string = String(await marketplace.getFee());
    expect(String(await erc20.balanceOf(owner.address))).to.equal(String(Number(tokenPrice) - (Number(tokenPrice)/100)*Number(fee)));
    expect(String(await erc20.balanceOf(user1.address))).to.equal("0");
  })

  it("Testing cancel function", async()=>{
    let err_mess: string = "Error: This token isn't for sale!";
    await marketplace.connect(owner).createNewItem(getUri(0));
    await approveERC721(owner, marketplace.address, 0);
    await marketplace.connect(owner).listItem(0, tokenPrice);
    expect(String(await marketplace.getPriceOfListedItem(0))).to.equal(tokenPrice)
    await marketplace.connect(owner).cancel(0);
    await expect(marketplace.getPriceOfListedItem(0)).to.be.revertedWith(err_mess);

  })

  type AuctionType = {
    owner: string,
    currentPrice: string,
    bidder: string,
    bets: string,
    minOdds: string,
  }

  async function getAuctionParams(tokenId:string | number):Promise<AuctionType>{
    let expectedAuction = await marketplace.getAuction(tokenId);
    let {currentPrice,bidder,bets,minOdds} = expectedAuction;
    let ownerOfToken = expectedAuction.owner;
    expectedAuction = {owner: ownerOfToken,currentPrice:String(currentPrice),bidder,bets:String(bets),minOdds:String(minOdds)};
    return expectedAuction;
  }

  it("Testing listItemOnAuction function", async()=>{
    await marketplace.connect(owner).createNewItem(getUri(0));
    await approveERC721(owner, marketplace.address, 0);
    await marketplace.connect(owner).listItemOnAuction(0, tokenPrice, tokenPrice);
    let auction1: AuctionType = {
      owner: owner.address,
      currentPrice: tokenPrice,
      bidder: zeroAddress,
      bets: "0",
      minOdds: tokenPrice,
    };
    let expectedAuction = await getAuctionParams(0);
    expect(expectedAuction).to.deep.equal(auction1);
  })

  it("Testing makeBid function", async()=>{
    await marketplace.connect(owner).createNewItem(getUri(0));
    await approveERC721(owner, marketplace.address, 0);
    await marketplace.connect(owner).listItemOnAuction(0, tokenPrice, String(Number(tokenPrice)/10));
    await mintAndApproveERC20([user1, user2],[tokenPriceX2,tokenPriceX2]);
    let auction1: AuctionType = {
      owner: owner.address,
      currentPrice: tokenPrice,
      bidder: zeroAddress,
      bets: "0",
      minOdds: String(Number(tokenPrice)/10),
    };
    let expectedAuction = await getAuctionParams(0);
    expect(expectedAuction).to.deep.equal(auction1);
    await marketplace.connect(user1).makeBid(0,tokenPrice);
    expect(String(await erc20.balanceOf(user1.address))).to.equal(tokenPrice);
    auction1 = {
      owner: owner.address,
      currentPrice: tokenPrice,
      bidder: user1.address,
      bets: "1",
      minOdds: String(Number(tokenPrice)/10),
    };
    expectedAuction = await getAuctionParams(0);
    expect(expectedAuction).to.deep.equal(auction1);
    let bet2: string = String(Number(tokenPrice)+Number(tokenPrice)/2);
    await marketplace.connect(user2).makeBid(0, bet2);
    expect(String(await erc20.balanceOf(user2.address))).to.equal(String(Number(tokenPriceX2)-Number(bet2)));
    auction1 = {
      owner: owner.address,
      currentPrice: bet2,
      bidder: user2.address,
      bets: "2",
      minOdds: String(Number(tokenPrice)/10),
    };
    expectedAuction = await getAuctionParams(0);
    expect(expectedAuction).to.deep.equal(auction1);
  })

  it("Testing finishAuction function. If more than one bid have been bet", async()=>{
    await marketplace.connect(owner).createNewItem(getUri(0));
    await approveERC721(owner, marketplace.address, 0);
    await marketplace.connect(owner).listItemOnAuction(0, tokenPrice, String(Number(tokenPrice)/10));
    await mintAndApproveERC20([user1,user2],[tokenPriceX2,tokenPriceX2])
    await marketplace.connect(user1).makeBid(0,tokenPrice);
    await marketplace.connect(user2).makeBid(0,tokenPriceX2);
    await increaseTime(auctionDuration);
    await marketplace.finishAuction(0);
    let auction1: AuctionType = {
      owner: zeroAddress,
      currentPrice: "0",
      bidder: zeroAddress,
      bets: "0",
      minOdds: "0",
    };
    let expectedAuction = await getAuctionParams(0);
    expect(expectedAuction).to.deep.equal(auction1);
    let fee: string = String(await marketplace.getFee());
    expect(String(await erc20.balanceOf(owner.address))).to.equal(String(Number(tokenPriceX2) - (Number(tokenPriceX2)/100)*Number(fee)));
    expect(await marketplace.getOwner(0)).to.equal(user2.address);
    expect(String(await erc20.balanceOf(user2.address))).to.equal("0");
    expect(String(await erc20.balanceOf(user1.address))).to.equal(tokenPriceX2);
    expect(String(await erc20.balanceOf(marketplace.address))).to.equal(String((Number(tokenPriceX2)/100)*Number(fee)));
  })

  it("Testing finishAuction function. If one bid has been bet", async()=>{
    await marketplace.connect(owner).createNewItem(getUri(0));
    await approveERC721(owner, marketplace.address, 0);
    await marketplace.connect(owner).listItemOnAuction(0, tokenPrice, String(Number(tokenPrice)/10));
    await mintAndApproveERC20([user1],[tokenPrice]);
    await marketplace.connect(user1).makeBid(0,tokenPrice);
    await increaseTime(auctionDuration);
    expect(String(await erc20.balanceOf(user1.address))).to.equal("0");
    expect(await marketplace.getOwner(0)).to.equal(marketplace.address);
    await marketplace.finishAuction(0);
    expect(String(await erc20.balanceOf(user1.address))).to.equal(tokenPrice);
    expect(await marketplace.getOwner(0)).to.equal(owner.address);
  })

  describe("Testin reverts with error", async()=>{

    it("Testing getTokenURI. If token isn't created!", async()=>{
      let err_mess: string = "Error: This token isn't for sale!";
      await expect(marketplace.getTokenURI(0)).to.be.revertedWith(err_mess);
    })

    it("Try to buy a non sellable item", async()=>{
      let err_mess: string = "Error: This item isn't on sell!";
      await expect(marketplace.buyItem(0)).to.be.revertedWith(err_mess);
    })

    it("Try to buy item without allowance tokens to marketplace contract", async()=>{
      let err_mess: string = "Error: To buy item you have to allow to withdraw some tokens!";
      await marketplace.connect(owner).createNewItem(getUri(0));
      await approveERC721(owner, marketplace.address, 0);
      await marketplace.connect(owner).listItem(0, tokenPrice);
      await expect(marketplace.connect(user1).buyItem(0)).to.be.revertedWith(err_mess);
    })

    it("Trying to cancel sale of not yours token!", async()=>{
      let err_mess: string = "Error: You can't cancel this sale because are not owner of this token!";
      await marketplace.connect(owner).createNewItem(getUri(0));
      await approveERC721(owner, marketplace.address, 0);
      await marketplace.connect(owner).listItem(0, tokenPrice);
      await expect(marketplace.connect(user1).cancel(0)).to.be.revertedWith(err_mess);
    })

    it("Trying to cancel a non existable sale!", async()=>{
      let err_mess: string = "Error: This item isn't on sell!";
      await expect(marketplace.connect(user1).cancel(0)).to.be.revertedWith(err_mess);
    })

    it("Trying to list not yours token on auction", async()=>{
      let err_mess: string = "Error: You are not owner of this token!";
      await expect(marketplace.connect(user1).listItemOnAuction(0,tokenPrice, tokenPrice)).to.be.revertedWith(err_mess);
    })

    it("Trying to list token on auction without allowance", async()=>{
      let err_mess: string = "Error: Please approve this token to this contract!";
      await marketplace.connect(owner).createNewItem(getUri(0));
      await expect(marketplace.connect(owner).listItemOnAuction(0,tokenPrice, tokenPrice)).to.be.revertedWith(err_mess);
    })

    it("Trying to make a bet on finished auction", async()=>{
      let err_mess: string = "Sorry but auction is already finished!";
      await marketplace.connect(owner).createNewItem(getUri(0));
      await approveERC721(owner, marketplace.address, 0);
      await marketplace.connect(owner).listItemOnAuction(0, tokenPrice, String(Number(tokenPrice)/10));
      await mintAndApproveERC20([user1],[tokenPriceX2]);
      await increaseTime(auctionDuration);
      await expect(marketplace.connect(user1).makeBid(0, tokenPrice)).to.be.revertedWith(err_mess);
    })

    it("Trying to make a bet non existed auction", async()=>{
      let err_mess: string = "Error: Sorry, but this token isn't on sale!";
      await expect(marketplace.connect(user1).makeBid(0, tokenPrice)).to.be.revertedWith(err_mess);
    })

    it("Trying to make bid lower than previous", async()=>{
      let err_mess: string = "Error: You bet is lower than current price. Please increase you bet!";
      await marketplace.connect(owner).createNewItem(getUri(0));
      await approveERC721(owner, marketplace.address, 0);
      await marketplace.connect(owner).listItemOnAuction(0, tokenPrice, String(Number(tokenPrice)/10));
      await mintAndApproveERC20([user1, user2],[tokenPriceX2, tokenPriceX2]);
      await marketplace.connect(user1).makeBid(0,tokenPrice);
      await expect(marketplace.connect(user2).makeBid(0,tokenPrice)).to.be.revertedWith(err_mess);
    })

    it("Trying to finish auction before 3 days expire", async()=>{
      let err_mess: string = "Error: Cannot finish this auction while 3 days aren't run out!";
      await marketplace.connect(owner).createNewItem(getUri(0));
      await approveERC721(owner, marketplace.address, 0);
      await marketplace.connect(owner).listItemOnAuction(0, tokenPrice, String(Number(tokenPrice)/10));
      await expect(marketplace.finishAuction(0)).to.be.revertedWith(err_mess);
    })

  /*  it("Testing mint function with wrong args", async()=>{
      await expect(erc20.connect(user1).mint(user1.address, tokenPrice)).to.be.reverted;
    })*/

    it("If somebody exept owner tries to change fee value", async()=>{
      let err_mess: string = "Error: You are not owner!";
      await expect(marketplace.connect(user1).setFee(2)).to.be.revertedWith(err_mess);
    })

  })

});
