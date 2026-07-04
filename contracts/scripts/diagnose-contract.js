/**
 * OutreachRecord 合约调诊断脚本
 *
 * 用法：node scripts/diagnose-contract.js
 * 前提：TronLink 已连接 Nile 测试网
 *
 * 注意：此脚本在 Node.js 环境运行，无法使用浏览器的 window.tronWeb。
 * 改为使用 tronweb SDK 直连 Nile 节点。
 */

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { TronWeb } = require('tronweb');

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const CONTRACT_ADDR = 'TM33ZtfZg4ZTHAQXSe7gd6j92cQDqAjzC3';

if (!PRIVATE_KEY) {
  console.error('错误: .env 中未设置 DEPLOYER_PRIVATE_KEY');
  process.exit(1);
}

const tw = new TronWeb({
  fullHost: 'https://nile.trongrid.io',
  privateKey: PRIVATE_KEY.replace(/^0x/, ''),
});

const artifact = require('../artifacts/contracts/OutreachRecord.sol/OutreachRecord.json');

async function main() {
  const userAddr = tw.defaultAddress.base58;
  const userHex = tw.address.toHex(userAddr);
  console.log('===== 环境检查 =====');
  console.log('钱包地址 (base58):', userAddr);
  console.log('钱包地址 (hex):   ', userHex);
  console.log('合约地址:          ', CONTRACT_ADDR);
  console.log('');

  const contract = tw.contract(artifact.abi, CONTRACT_ADDR);

  // 1. 检查 outreachCount
  console.log('===== 步骤 1: outreachCount =====');
  try {
    const count = await contract.outreachCount().call({ _owner_address: userHex });
    console.log('outreachCount:', count.toString());
  } catch (e) {
    console.error('失败:', e.message?.slice(0, 200) || e);
  }

  // 2. 检查当前钱包是否为 recorder
  console.log('');
  console.log('===== 步骤 2: 检查 recorder 权限 =====');
  try {
    const isRecorder = await contract.recorders(userAddr).call({ _owner_address: userHex });
    console.log('is recorder:', isRecorder);
  } catch (e) {
    console.error('失败:', e.message?.slice(0, 200) || e);
  }

  // 3. 如果非 recorder，设置一下
  console.log('');
  console.log('===== 步骤 3: setRecorder =====');
  try {
    const result = await contract.setRecorder(userAddr, true).send({
      feeLimit: 50_000_000,
      shouldPollResponse: true,
    });
    const txID = result?.transaction?.txID || result?.txid || result;
    console.log('setRecorder txID:', txID);
  } catch (e) {
    console.error('失败:', e.message?.slice(0, 300) || e);
  }

  // 4. 测试 sha3
  console.log('');
  console.log('===== 步骤 4: sha3 测试 =====');
  const testEmailBody = 'Hello Test';
  const emailHash = tw.sha3(testEmailBody);
  console.log('输入:', testEmailBody);
  console.log('sha3:', emailHash);
  console.log('sha3 type:', typeof emailHash);

  // 5. 尝试 recordOutreach（新的 transactionBuilder 方式）
  console.log('');
  console.log('===== 步骤 5: recordOutreach (transactionBuilder) =====');
  const testOutreachId = `diagnose-${Date.now()}`;
  console.log('outreachId:', testOutreachId);
  console.log('university:', '测试大学');
  console.log('emailHash:', emailHash);

  try {
    const contractHex = tw.address.toHex(CONTRACT_ADDR).replace(/^41/, '0x');
    const userHexAddr = tw.address.toHex(userAddr).replace(/^41/, '0x');

    const unsignedTx = await tw.transactionBuilder.triggerSmartContract(
      contractHex,
      'recordOutreach(string,string,string,bytes32)',
      { feeLimit: 100_000_000 },
      [{ type: 'string', value: testOutreachId },
       { type: 'string', value: '测试大学' },
       { type: 'string', value: 'test-event' },
       { type: 'bytes32', value: emailHash }],
      userHexAddr,
    );

    console.log('unsignedTx result:', unsignedTx.result?.result);
    console.log('txID:', unsignedTx.transaction?.txID);

    const signedTx = await tw.trx.sign(unsignedTx.transaction);
    console.log('signed signature:', signedTx.signature ? 'OK' : 'MISSING');

    const broadcastResult = await tw.trx.sendRawTransaction(signedTx);
    console.log('broadcast result:', JSON.stringify(broadcastResult));

    const txHash = broadcastResult?.txid || broadcastResult?.txID || broadcastResult?.transaction?.txID;
    console.log('');
    console.log('txHash:', txHash);
    console.log('✅ 交易已广播！');
    console.log('浏览器: https://nile.tronscan.org/#/transaction/' + txHash);
  } catch (e) {
    console.error('❌ 失败:', e.message?.slice(0, 500) || e);
  }
}

main().catch(e => {
  console.error('脚本异常:', e);
  process.exit(1);
});
