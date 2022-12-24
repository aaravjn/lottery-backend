require("@nomicfoundation/hardhat-toolbox")
require("hardhat-deploy")
require("solidity-coverage")
require("dotenv").config()


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  namedAccounts: {
    deployer: {
      default: 0,
    },
    adrs1: {
      default: 1,
    },
    adrs2: {
      default: 2,
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL,
      accounts: [process.env.PRIVATE_KEY_DEPLOYER, process.env.PRIVATE_KEY_ADRS1, process.env.PRIVATE_KEY_ADRS2],
      chainId: 5,
      blockConfirmations: 6,
    },
    localhost: {
      url: "http://localhost:8545",
      chainId: 31337,
    },
  },
  gasReporter: {
    enabled: false,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    token: "MATIC",
  },
  mocha : {
    timeout: 400000
  },
  etherscan : {
    apiKey: {
      goerli: process.env.ETHERSCAN_API_KEY,
    }
  }
};