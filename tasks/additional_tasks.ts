import {contract, web3, task, envParams, getSign} from "./tasks";

type OnlyIdType = {
  itemid: string;
}

export default function additionalTasks() {

  task("getowner", "Get owner of any item")
  .addParam("itemid", "Item Id")
  .setAction(async(task_Args: OnlyIdType)=>{
    let {itemid} = task_Args;
    try{
      let data = await contract.methods.getOwner(itemid).call();
      console.log(data);
    }catch(e:any){
      console.log(e.message);
    }
  })

  task("geturi", "Get item's uri")
  .addParam("itemid", "Item id")
  .setAction(async(task_Args: OnlyIdType)=>{
    let {itemid} = task_Args;
    try{
      let data = await contract.methods.getTokenURI(itemid).call();
      console.log(data);
    }catch(e:any){
      console.log(e.message);
    }
  })

  task("getprice", "Get price of listed item")
  .addParam("itemid", "Item id")
  .setAction(async(task_Args: OnlyIdType)=>{
    let {itemid} = task_Args;
    try{
      let data = await contract.methods.getPriceOfListedItem(itemid).call();
      console.log(data);
    }catch(e:any){
      console.log(e.message);
    }
  })

  task("geterc721address", "Get ERC721 address")
  .setAction(async(task_Args)=>{
    try{
      let data = await contract.methods.getERC721Address().call();
      console.log(data);
    }catch(e:any){
      console.log(e.message);
    }
  })

}
