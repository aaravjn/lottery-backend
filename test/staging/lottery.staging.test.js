const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, network } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Staging Tests", function () {
          let lottery, LotteryEntranceFee, deployer

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              lottery = await ethers.getContract("Lottery", deployer)
              LotteryEntranceFee = await lottery.i_entranceFee()
              
          })

          describe("fulfillRandomWords", function () {
              it("returns back ETH of the participant (ONE PARTICIPANT), also checks the time interval and states of lottery", async function () {
                  
                  console.log("Setting up test 1...")
                  const startingTimeStamp = await lottery.s_lastTimeStamp()
                  const accounts = await ethers.getSigners()

                  console.log("Setting up Listener...")
                  await new Promise( async (resolve, reject) => {
                      
                      lottery.once("winnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              
                              const recentWinner = await lottery.s_winner()
                              const LotteryState = await lottery.s_lotteryState()
                              const winnerEndingBalance = await accounts[0].getBalance()
                              const endingTimeStamp = await lottery.s_lastTimeStamp()

                              await expect(lottery.getParticipant(0)).to.be.reverted
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(LotteryState, 0)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(LotteryEntranceFee).toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(error)
                          }
                      })
                      const tx = await lottery.enter_lottery({ value: LotteryEntranceFee })
                      console.log("Entered Lottery...")

                      await tx.wait(1)
                      
                      console.log("Waiting for the time interval for the winner to be chosen")
                      const winnerStartingBalance = await accounts[0].getBalance()
                  })
              })
              it("Work well when there are MULTIPLE PARTICIPANTS", async function () {
                console.log("Setting up test 2...")
                const accounts = await ethers.getSigners()

                console.log("Setting up listner for test 2...")
                await new Promise( async (resolve, reject) => {
                    lottery.once("winnerPicked", async function() {
                        console.log("WinnerPicked event fired")
                        try {

                            console.log("Determining the winner")
                            const recentWinner = await lottery.s_winner()
                            let winnerAccount;
                            for(let i = 1;i<num_of_participants;i++){
                                if(accounts[i].address.toString() == recentWinner.toString()){
                                    winnerAccount = accounts[i] 
                                }
                            }
                            
                            const endingBalance = await winnerAccount.getBalance()
                            assert.equal(
                                endingBalance.toString(),
                                startingBalance.add(
                                    LotteryEntranceFee.mul(num_of_participants).mul(4).div(5)
                                )
                                .toString()
                            )
                            resolve()
                        }
                        catch(error){
                            console.log(error)
                            reject(error)
                        }
                    })
                    const num_of_participants = 2;
                    
                    console.log(await (await accounts[0].getBalance()).toString())
                    console.log(accounts[1].address)
                    console.log(accounts[2].address)
                    for(let i = 1;i<=num_of_participants;i++){
                        
                        let participant = lottery.connect(accounts[i])
                        console.log(`Participant ${i} entering Lottery`)
                        let tx = await participant.enter_lottery({value: LotteryEntranceFee})
                        await tx.wait(1)
                        console.log(`Participant ${i} entered lottery`)
                    }
                    const startingBalance = await accounts[1].getBalance()
                    console.log("Waiting for the time interval for the winner to be chosen")

                })
              })
          })
      })