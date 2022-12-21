const { assert, expect } = require("chai")
const { network, getNamedAccounts, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")


!developmentChains.includes(network.name) 
    ? describe.skip :
    describe("Lottery Unit Test", function() {
        
        let lottery, vrfCoordinatorV2Mock, entrancefee
        const chainId = network.config.chainId
        let Deployer
        let interval
        let accounts
        beforeEach(async function () {
            
            const { deployer } = await getNamedAccounts()
            Deployer = deployer
            await deployments.fixture(["all"])
            lottery = await ethers.getContract("Lottery", deployer)
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            entrancefee = await lottery.i_entranceFee()
            interval = networkConfig[chainId]["interval"]
            accounts = await ethers.getSigners()
        })
        describe("constructor", function() {

            it("initializes the lottery correctly", async function() {

                const lotteryState = await lottery.s_lotteryState()
                const interval = await lottery.i_interval()
                const gasLane = await lottery.i_gasLane()
                
                assert.equal(gasLane.toString(), networkConfig[chainId]["gasLane"])
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])
                assert.equal(lotteryState.toString(), "0")

            })
        })

        describe("enterrlottery", function() {
            it("reverts when you don't pay enough", async function () {
                await expect(lottery.enter_lottery()).to.be.revertedWith(
                    "Not enough ETH"
                )
            })
            it("records players when they enter", async function () {
                await lottery.enter_lottery({value: entrancefee})
                const Participant = await lottery.getParticipant(0)
                assert.equal(Participant, Deployer)
            })
            it("emits on enter", async function () {
                await expect(lottery.enter_lottery({value: entrancefee})).to.emit(
                    lottery,
                    "lotteryEnter"
                )
            })
            it("doesn't allow entrance when contract is calculating", async function() {
                await lottery.enter_lottery({value: entrancefee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
                
                await lottery.performUpkeep([])
                await expect(lottery.enter_lottery({value: entrancefee})).to.be.revertedWith("Currently not accepting participants")

            })
        })
        describe("checkUpkeep", function() {
            it("returns false if people haven't sent any ETH", async function() {
                await network.provider.send("evm_increaseTime", [Number(interval)+1]);
                await network.provider.send("evm_mine", [])
                const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                assert(!upkeepNeeded)
            })
            it("returns true if enough time has passed, has ETH, and is Open", async function() {
                await lottery.enter_lottery({value: entrancefee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
                const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                assert(upkeepNeeded)
            })
        })
        describe("performUpkeep", function() {
            it("it can only run if checkUpkeep is true", async function() {
                await lottery.enter_lottery({value: entrancefee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])

                const tx = await lottery.performUpkeep([])
                assert(tx)

            })
            it("it reverts if checkUpkeep is false", async function() {
                await expect(lottery.performUpkeep([])).to.be.reverted
            })
            it("updates the lottery state, emits an event, and calls the vrf coordinator", async function() {
                await lottery.enter_lottery({value: entrancefee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
                const txResponse = await lottery.performUpkeep([])
                const txReciept = await txResponse.wait(1)

                const RequestId = Number(txReciept.events[1].args.requestId)
                assert(RequestId > 0)
                expect(txResponse).to.emit(
                    lottery,
                    "RequestedRandomWinner"
                )
                const lotteryState = await lottery.callStatic.s_lotteryState()
                assert.equal(lotteryState.toString(), "1")
            })
            describe("fulfillRandomWords", function () {
                beforeEach(async function() {
                    

                    const player = await lottery.connect(accounts[1])
                    await player.enter_lottery({value : entrancefee})

                    await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                    await network.provider.send("evm_mine", [])
                })
                it("can onll be called after performUpkeep", async function () {
                    
                    await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)).to.be.revertedWith(
                        "nonexistent request"
                    )
                })
                it("picks a winner, resets the lottery, and sends money", async function () {
                    const additionalEntrants = 3
                    const startingAccountIndex = 2
                    
                    
                    for(let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++){
                        const participant = lottery.connect(accounts[i])
                        
                        await participant.enter_lottery({value: entrancefee})
                    }
                    const startingTimeStamp = await lottery.s_lastTimeStamp()
                    const num_participants = await lottery.getNumberOfParticipants()
                    await new Promise( async (resolve, reject) => {
                        
                        
                        lottery.once("winnerPicked", async () => {
                            try{
                                
                                const recentWinner = await lottery.s_winner()
                                
                                const lotterystate = await lottery.s_lotteryState()
                                const endingTimeStamp = await lottery.s_lastTimeStamp()
                                
                                let winnerEndingBalance = await accounts[2].getBalance()
                                
                                
                                await expect(lottery.getParticipant(0)).to.be.reverted
                                
                                assert.equal(lotterystate, 0)
                                assert(endingTimeStamp > startingTimeStamp)
                                

                                if(additionalEntrants == 0){
                                    
                                    assert.equal(recentWinner.toString(), accounts[1].address)
                                    winnerEndingBalance = await accounts[1].getBalance()
                                    assert.equal(
                                        winnerEndingBalance.toString(), 
                                        winnerStartingBalance 
                                            .add(entrancefee)   
                                            .toString()
                                    )
                                }
                                else{
                                    assert.equal(recentWinner.toString(), accounts[2].address)
                                    
                                    assert.equal(
                                        winnerEndingBalance.toString(), 
                                        winnerStartingBalance 
                                            .add(
                                                entrancefee
                                                .mul(num_participants)
                                                .mul(4).div(5)
                                            )
                                            .toString()
                                    )
                                }
                                resolve()
                            }
                            catch(e){
                                reject(e)
                            }
                            
                        })
                        const tx = await lottery.performUpkeep("0x")
                        const txReciept = await tx.wait(1)
                        
                        let winnerStartingBalance = await accounts[2].getBalance()
                        if(additionalEntrants == 0){
                            winnerStartingBalance = await accounts[1].getBalance()
                        }
                        
                        await vrfCoordinatorV2Mock.fulfillRandomWords(
                            txReciept.events[1].args.requestId,
                            lottery.address
                        )
                        
                    })
                })
            })
        })
        

    })