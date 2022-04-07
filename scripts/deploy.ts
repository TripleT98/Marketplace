// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import web3 from "web3";

async function main() {

  let adminRole: string = web3.utils.keccak256("admin"),
  name: string = "Masterpeace",
  symbol: string = "MNFT",
  currency: string;


  const MyERC20 = await ethers.getContractFactory("MyERC20");
  const myERC20 = await MyERC20.deploy();

  await myERC20.deployed();
  currency = myERC20.address;
  console.log("ERC20 deployed to:", currency);


  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(name, symbol, adminRole, currency);

  await marketplace.deployed();

  console.log("Marketplace deployed to:", marketplace.address);
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
