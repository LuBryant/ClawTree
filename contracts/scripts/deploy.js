/**
 * ClawTree 合约部署脚本
 *
 * 用法：
 *   npx hardhat run scripts/deploy.js --network tron_nile
 *
 * 前提：
 *   .env 中已填写 DEPLOYER_PRIVATE_KEY
 *   部署者有足够的 TRX 测试币（Nile Faucet: https://nileex.io/join/getJoinPage）
 */

async function main() {
  console.log('部署者地址:', (await ethers.getSigners())[0].address);
  console.log('');

  // ---- OutreachRecord ----
  const OutreachRecord = await ethers.getContractFactory('OutreachRecord');
  const outreach = await OutreachRecord.deploy();
  await outreach.waitForDeployment();
  const outreachAddr = await outreach.getAddress();
  console.log('OutreachRecord:', outreachAddr);

  // ---- EventRegistry ----
  const EventRegistry = await ethers.getContractFactory('EventRegistry');
  const events = await EventRegistry.deploy();
  await events.waitForDeployment();
  console.log('EventRegistry: ', await events.getAddress());

  // ---- TrendOracle ----
  const TrendOracle = await ethers.getContractFactory('TrendOracle');
  const oracle = await TrendOracle.deploy();
  await oracle.waitForDeployment();
  console.log('TrendOracle:  ', await oracle.getAddress());

  console.log('');
  console.log('===== 全部部署完成 =====');
  console.log('');
  console.log('请将以下地址填入 frontend/app/config/tron.ts 的 CONTRACTS 中：');
  console.log(`  EventRegistry:  '${await events.getAddress()}'`);
  console.log(`  OutreachRecord: '${outreachAddr}'`);
  console.log(`  TrendOracle:    '${await oracle.getAddress()}'`);
}

main().catch((err) => {
  console.error('部署失败:', err);
  process.exit(1);
});
