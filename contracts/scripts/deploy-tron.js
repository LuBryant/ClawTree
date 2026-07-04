/**
 * TRON Nile 合约部署脚本（使用 tronweb 原生 API）
 *
 * 用法：
 *   node scripts/deploy-tron.js
 *
 * 前提：
 *   .env 中已填写 DEPLOYER_PRIVATE_KEY（需要 0x 前缀）
 *   hardhat compile 已完成
 */

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { TronWeb } = require('tronweb');

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('错误: .env 中未设置 DEPLOYER_PRIVATE_KEY');
  process.exit(1);
}

// Nile 测试网配置
const fullNode = 'https://nile.trongrid.io';
const solidityNode = 'https://nile.trongrid.io';
const eventServer = 'https://nile.trongrid.io';

const tronWeb = new TronWeb({
  fullHost: fullNode,
  privateKey: PRIVATE_KEY.replace(/^0x/, ''),
});

async function main() {
  let address;
  try {
    address = tronWeb.defaultAddress.base58;
  } catch {
    console.error('错误: 私钥无效，请检查 DEPLOYER_PRIVATE_KEY');
    process.exit(1);
  }

  console.log('部署者地址 (base58):', address);
  console.log('部署者地址 (hex):   ', tronWeb.address.toHex(address));
  console.log('');

  // 读取编译产物
  const artifact = require('../artifacts/contracts/OutreachRecord.sol/OutreachRecord.json');
  const bytecode = artifact.bytecode;
  const abi = artifact.abi;

  console.log('合约字节码长度:', bytecode.length, 'bytes');
  console.log('');

  // 部署 OutreachRecord
  console.log('正在部署 OutreachRecord...');
  try {
    const result = await tronWeb.contract().new({
      abi: abi,
      bytecode: bytecode,
      feeLimit: 500_000_000, // 500 TRX
      callValue: 0,
      parameters: [],
    });

    if (!result?.contract_address) {
      console.error('部署失败: 未返回合约地址');
      console.error('结果 keys:', Object.keys(result || {}));
      console.error('txID:', result?.txID || result?.txid || result?.transaction?.txID || '无');
      process.exit(1);
    }

    const contractAddr = tronWeb.address.fromHex(result.contract_address);
    console.log('');
    console.log('===== 部署成功 =====');
    console.log('');
    console.log('OutreachRecord 合约地址:', contractAddr);
    console.log('交易 ID:', result.txID);
    console.log('');
    console.log('请将以下地址填入 frontend/app/config/tron.ts 的 CONTRACTS 中：');
    console.log(`  OutreachRecord: '${contractAddr}'`);
    console.log('');
    console.log('Nile 浏览器:', `https://nile.tronscan.org/#/contract/${contractAddr}`);

  } catch (err) {
    console.error('部署失败:', err.message || err);
    if (err.message?.includes('class org.tron.core.exception.ContractValidateException')) {
      console.error('→ 请确认账户有足够的 TRX 测试币');
      console.error('→ 水龙头: https://nileex.io/join/getJoinPage');
    }
    process.exit(1);
  }
}

main();
