/**
 * Deploy ClawTree contracts to Injective Testnet (inEVM).
 *
 * Contracts:
 *   EventRegistry   — 高校活动上链注册
 *   OutreachRecord  — 外联记录存证
 *   TrendOracle     — 趋势数据锚定
 *
 * Required in project-root .env:
 *   DEPLOYER_PRIVATE_KEY=0x...
 *   INJECTIVE_RPC_URL=https://k8s.testnet.json-rpc.injective.network
 *
 * Run: npm run deploy:injective
 */
const fs = require('node:fs');
const path = require('node:path');
const hre = require('hardhat');

const { ethers, network, artifacts } = hre;

const EXPLORER_BASE = 'https://testnet.explorer.injective.network';
const CONTRACT_NAMES = ['EventRegistry', 'OutreachRecord', 'TrendOracle'];

async function main() {
  if (network.name !== 'injective_testnet') {
    throw new Error(`部署网络应为 injective_testnet，当前: ${network.name}`);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log('\n🌐 网络: Injective Testnet (inEVM)');
  console.log(`👤 部署者: ${deployer.address}`);
  console.log(`💰 余额:   ${ethers.formatEther(balance)} INJ\n`);

  if (balance === 0n) {
    console.log('💧 请先从水龙头获取测试 INJ: https://testnet.faucet.injective.network/');
    throw new Error('部署者余额为 0');
  }

  const chainId = (await ethers.provider.getNetwork()).chainId;
  const deployed = {};

  for (const name of CONTRACT_NAMES) {
    process.stdout.write(`⛓  部署 ${name}... `);
    const Factory = await ethers.getContractFactory(name);
    const contract = await Factory.deploy();
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    deployed[name] = address;
    console.log(address);
  }

  // 写入部署记录
  const deployTx = null; // 多合约部署，不记录单个 tx
  const record = {
    network: 'injective_testnet',
    chainId: Number(chainId),
    deployer: deployer.address,
    contracts: deployed,
    explorerBase: EXPLORER_BASE,
    deployedAt: new Date().toISOString()
  };

  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const recordPath = path.join(outDir, 'injective_testnet.json');
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));

  console.log('\n📄 部署记录 →', recordPath);
  console.log('\n✅ ClawTree 三合约部署完成\n');
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`   ${name}: ${EXPLORER_BASE}/address/${addr}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
