import web3 from "web3";

let currensy_address: string = "0x652d87Fa17a2B28c50E04532742668A2BBb19d56",
adminRole: string = web3.utils.keccak256("admin"),
name: string = "Masterpeace",
symbol: string = "MNFT";

module.exports = [name, symbol, adminRole, currensy_address];
