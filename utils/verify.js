const { run } = require("hardhat")

const verify = async (ContractAddress, contractArgs) => {
    console.log("Verifying Contract")
    try {
        await run("verify:verify", {
            address: ContractAddress,
            constructorArguments: contractArgs
        })
    }
    catch (e) {
        if(e.message.toLowerCase().includes("already verified")) {
            console.log("Contract Deployment already verified")
        }
        else{
            console.log(e)
        }
    }
    console.log("verification complete")
}

module.exports = {
    verify
}