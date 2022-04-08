import web3 from "web3";
import * as dotenv from "dotenv";
dotenv.config();

let currensy_address: string = process.env.ERC20 as string,
adminRole: string = web3.utils.keccak256("admin"),
name: string = "Masterpeace",
symbol: string = "MNFT";

module.exports = [name, symbol, adminRole, currensy_address];
