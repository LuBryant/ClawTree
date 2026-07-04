const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('@nomicfoundation/hardhat-ethers');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  networks: {
    // TRON Nile Testnet (EVM-compatible) — 主部署目标（HTX Genesis 黑客松）
    tron_nile: {
      url: process.env.TRON_NILE_RPC_URL || 'https://nile.trongrid.io/jsonrpc',
      chainId: 3448148188,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY.trim()] : []
    },
    // Injective Testnet — 备用
    injective_testnet: {
      url: process.env.INJECTIVE_RPC_URL || 'https://k8s.testnet.json-rpc.injective.network',
      chainId: 1439,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY.trim()] : []
    }
  }
};
