const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify") 

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Mock
    let vrfCoordinatorV2Address
    let subscriptionId
    const entranceFee = networkConfig[chainId]["entrance_fee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callBackGasLimit = networkConfig[chainId]["callBackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    
    if(developmentChains.includes(network.name)){

        console.log("Development environment detected")

        /** 
         * @dev get() function from the deployments doesn't work
         * we need to use ethers.getContract() in order to get an instance of the contract
         * I don't know why it happens.
        */

        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address

        console.log(`Mock deployed at ${vrfCoordinatorV2Mock.address}`)

        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReciept = await transactionResponse.wait(1)
        subscriptionId = transactionReciept.events[0].args.subId

        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    }
    else{
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    const arguments = [entranceFee, vrfCoordinatorV2Address, gasLane, subscriptionId, callBackGasLimit, interval]

    const lottery = await deploy("Lottery", {
        from: deployer,
        args: arguments,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if(developmentChains.includes(network.name)){
        console.log("Subscription Id added")
        await vrfCoordinatorV2Mock.addConsumer(Number(subscriptionId), lottery.address)
    }

    if(!(developmentChains.includes(network.name))){
        console.log("Verifying contract deployment in goerli network")
        await verify(lottery.address, arguments)
        
    }  
}
module.exports.tags = ["all", "lottery"]