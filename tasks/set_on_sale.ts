import {contract, web3, task, envParams, getSign} from "./tasks";

type SetPriceParams = {
  tokenid:string;
  privatekey:string;
  gas:string;
  price:string;
}

export default function listItemTask(){
  task("sale", "List item on sale")
  .addParam("tokenid", "Id of item u wanna sale")
  .addParam("privatekey","your PRIVATE KEY")
  .addParam("gas","gas amount")
  .addParam("price", "Set item price")
  .setAction(async(tArgs: SetPriceParams)=>{
    let {tokenid, privatekey, gas, price} = tArgs;
    let marketplace_address = envParams.MARKETPLACE as string;
    try{
      //approve first
      let data = web3.eth.abi.encodeFunctionCall({
        name: "approve",
        type: "function",
        inputs: [
          {
            name: "_to",
            type: "address"
          },
          {
            name: "_tokenId",
            type: "uint256"
          }
        ]
      },[marketplace_address, tokenid]);
      let sign = await getSign({data, anotherAddress:envParams.ERC721, gaslimit: gas, privatekey});
      let transaction = await web3.eth.sendSignedTransaction(sign.rawTransaction);
      console.log(transaction.transactionHash);

      //then set on sale
      data = await contract.methods.listItem(tokenid, price).encodeABI();
      sign = await getSign({gaslimit: gas, privatekey, data});
      transaction = await web3.eth.sendSignedTransaction(sign.rawTransaction);
      console.log(transaction.transactionHash);
    }catch(e:any){
      console.log(e.message);
    }
  })
}
