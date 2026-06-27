/**
 * Deploy ClawTree contracts to TRON Nile Testnet (EVM-Compatible).
 *
 * Contracts:
 *   EventRegistry   — 高校活动上链注册
 *   OutreachRecord  — 外联记录存证
 *   TrendOracle     — 趋势数据锚定
 *
 * Required in project-root .env:
 *   DEPLOYER_PRIVATE_KEY=0x...
 *   TRON_NILE_RPC_URL=https://nile.trongrid.io
 *
 * Run:
 *   npm run deploy:nile        (TRON Nile)
 *   npm run deploy:injective   (Injective 备用)
 */
const fs = require('node:fs');
const path = require('node:path');
const hre = require('hardhat');

const { ethers, network, artifacts } = hre;

const NETWORK_META = {
  tron_nile: {
    name: 'TRON Nile Testnet (EVM)',
    explorerBase: 'https://nile.tronscan.org',
    explorerTxPath: '/tx',
    explorerAddressPath: '/address',
    gasToken: 'TRX',
    faucetUrl: 'https://nileex.io/join/getJoinPage'
  },
  injective_testnet: {
    name: 'Injective Testnet (inEVM)',
    explorerBase: 'https://testnet.explorer.injective.network',
    explorerTxPath: '/tx',
    explorerAddressPath: '/address',
    gasToken: 'INJ',
    faucetUrl: 'https://testnet.faucet.injective.network/'
  }
};

const CONTRACT_NAMES = ['EventRegistry', 'OutreachRecord', 'TrendOracle'];

async function main() {
  const meta = NETWORK_META[network.name];
  if (!meta) {
    throw new Error(
      `不支持的网络: ${network.name}\n` +
      `  请使用: npm run deploy:nile        (TRON Nile)\n` +
      `           npm run deploy:injective   (Injective 备用)`
    );
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`\n🌐 网络: ${meta.name}`);
  console.log(`👤 部署者: ${deployer.address}`);
  console.log(`💰 余额:   ${ethers.formatEther(balance)} ${meta.gasToken}\n`);

  if (balance === 0n) {
    console.log(`💧 请先获取测试 ${meta.gasToken}: ${meta.faucetUrl}`);
    throw new Error(`部署者余额为 0 ${meta.gasToken}`);
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
  const record = {
    network: network.name,
    networkName: meta.name,
    chainId: Number(chainId),
    deployer: deployer.address,
    contracts: deployed,
    explorerBase: meta.explorerBase,
    gasToken: meta.gasToken,
    deployedAt: new Date().toISOString()
  };

  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const recordPath = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));

  console.log('\n📄 部署记录 →', recordPath);
  console.log(`\n✅ ClawTree 三合约部署完成 (${meta.name})\n`);
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`   ${name}: ${meta.explorerBase}${meta.explorerAddressPath}/${addr}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
