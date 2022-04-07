import Web3 from "web3";
import * as dotenv from "dotenv";
import {task} from "hardhat/config";
import {provider as Provider} from "web3-core/types/index.d"
dotenv.config();
let {abi} = require("./../artifacts/contracts/Marketplace.sol/Marketplace.json");

let envParams = process.env

let provider: Provider = new Web3.providers.HttpProvider(`${envParams.META_MASK_PROVIDER_URL}`)
let web3: Web3 = new Web3(provider);
let contract = new web3.eth.Contract(abi, `${envParams.MARKETPLACE}`);

interface SignType {
  gaslimit: string;
  privatekey: string;
  data: string;
}

async function getSign(obj:SignType, isForStaking?:boolean):Promise<any> {
  //Создаю объект необходимый для подписи транзакций
    return await web3.eth.accounts.signTransaction({
      to:envParams.MARKETPLACE,//Адрес контракта, к которому нужно обратиться
      //value: web3js.utils.toWei(obj.value || "0", "wei") || null,//Велечина эфира, которую вы хотите отправить на контракт
      gas: Number(obj.gaslimit),//Лимит газа, максимально допустимый газ, который вы допускаете использовать при выполнении транзакции.Чем больше лимит газа, тем более сложные операции можно провести при выполнении транзакции
      data: obj.data//Бинарный код транзакции, которую вы хотите выполнить
    }, obj.privatekey)
}


export {
  contract, web3, task, envParams, getSign
}
