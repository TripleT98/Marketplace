import {contract, web3, task, envParams, getSign} from "./tasks";

type MintAgs = {
  privatekey: string;
  gas: string;
  uri: string;
}

export async function mintTask(){

  task("mint", "Create item on marketplace")
  .addParam("privatekey","your PRIVATE KEY")
  .addParam("gas","gas amount")
  .addParam("uri", "Item uri")
  .setAction(async(tArgs: MintAgs)=>{

    let {gas, privatekey, uri} = tArgs;
    try{
      let data = await contract.methods.createNewItem(uri).encodeABI();
      let sign = await getSign({gaslimit: gas, privatekey, data});
      let transaction = await web3.eth.sendSignedTransaction(sign.rawTransaction)
      console.log(transaction.transactionHash);
    }catch(e: any){
      console.log(e.message);
    }
  })

}
