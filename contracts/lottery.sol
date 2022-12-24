// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error Lottery__UpKeepNotNeeded(
    uint256 currentBalance, 
    uint256 numberOfParticipants,
    uint256 lotteryState
);

/**
    @title A sample lottery contract
    @author Aarav Jain
    @notice This contract is for creating an untemperable decentralized smart contract\
    @dev This implements ChainLink VRFV2 and ChainLink Automation
*/

contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
    
    enum State{
        OPEN,
        CALCULATING
    }

    /**
        State Variables
        @dev The State Variables are kept private or immutable in order to make them gas effecient
            https://www.alchemy.com/overviews/solidity-gas-optimization#:~:text=What%20is%20gas%20and%20gas,code%20less%20expensive%20to%20execute.
            A good article on Gas Optimization in Solidity
        List of State variables and their purposes
        1. `i_entranceFee` :Entrance fee of the lottery which will be decided by the deployer
        2. `s_participants`:List of Participants
        3. `i_vrfCoordinator`:
        4. `i_gasLane`:
        5. `i_subscriptionId`:
        6. `REQUEST_CONFIRMATION`:
        7. `i_callBackGasLimit`:
        8. `NUM_WORDS`:
    */

    uint256 public immutable i_entranceFee;          
    address payable[] private s_participants;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 public immutable i_gasLane;
    uint64 public immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATION = 3;
    uint32 private immutable i_callBackGasLimit;
    uint32 private constant NUM_WORDS = 1;
    uint256 public lastPrizeValue = 0;
    address payable private i_deployer;


    /**
        Lottery Variables
        1. `s_winner` : Winner of the previous lottery
        2. `s_lotteryState` : State of the lottery
        3. `s_lastTimeStamp`: Last time the winner was chosen
        4. `i_interval` : An interval after which the winner would be chosen 
    */
    address public s_winner;
    State public s_lotteryState;
    uint256 public s_lastTimeStamp;
    uint256 public immutable i_interval;
    

    /**
        Events
    */
    event lotteryEnter(address indexed participant);
    event RequestedRandomWinner(uint256 indexed requestId);
    event winnerPicked(address indexed winner);


    constructor(uint256 entrance_Fee,
                address vrfCoordinatorV2,
                bytes32 gasLane,
                uint64 subscriptionId,
                uint32 callBackGasLimit,
                uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entrance_Fee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callBackGasLimit = callBackGasLimit;
        s_lotteryState = State.OPEN; 
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
        i_deployer = payable(msg.sender);
    }
    
    /**
        @dev msg.value send the money from the user to the contract
            Checks whether the participant is paying enough ETH to enter the lottery
            Also checking whether the lottery is accepting participants 
    */
    function enter_lottery() public payable {
        require(msg.value >= i_entranceFee, "Not enough ETH");
        require(s_lotteryState == State.OPEN, "Currently not accepting participants");
        s_participants.push(payable(msg.sender));
        emit lotteryEnter(msg.sender);
    }


    /* function to access the members of the array partcipants */
    function getParticipant(uint256 index) public view returns(address payable){
        return s_participants[index];
    }
    
    
    /**
     Using Chainlink keepers to automate the execution of selecting random winners

     @dev This is the function that the Chainlink Keeper nodes call
     they look for the upKeepNeeded to return true
     In order to trigger the call of upKeep, the following should happen
     1. Our timeinterval should have passed
     2. Lottery should have atleast 1 player
     3. Our subscription should be funded with LINK
     4. Lottery should be in open state
    */

    function checkUpkeep(
            bytes memory /*checkData*/
        ) 
        public view override 
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool isOpen = (s_lotteryState == State.OPEN);
        bool timePassed = (block.timestamp - s_lastTimeStamp > i_interval);
        bool hasPlayers = s_participants.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && timePassed && hasBalance && hasPlayers);
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        /* pick a random winner */

        (bool upKeepNeeded, ) = checkUpkeep("");
        if(!upKeepNeeded){
            revert Lottery__UpKeepNotNeeded(
                address(this).balance,
                s_participants.length,
                uint256(s_lotteryState)
            );
        }
        s_lotteryState = State.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATION,
            i_callBackGasLimit,
            NUM_WORDS
        );
        
        emit RequestedRandomWinner(requestId);
    }


    function fulfillRandomWords(uint256, /* Request Id*/ uint256[] memory randomWords)
    internal
    override
    {
        uint256 indexOfWinner = randomWords[0] % s_participants.length;
        address payable winner = s_participants[indexOfWinner];
        s_winner = winner;
        
        uint256 prizeValue = getPotentialPrizeValue();
        
        (bool success, ) = winner.call{value: prizeValue}("");
        require(success, "Transfer failed");
        emit winnerPicked(winner);
        lastPrizeValue = prizeValue;

        (bool withdrawSuccess, ) = i_deployer.call{value: address(this).balance}("");
        require(withdrawSuccess, "Withdraw Failed"); 
        s_participants = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        s_lotteryState = State.OPEN;
    }

    function getPotentialPrizeValue() public view returns(uint256) {
        uint256 prizeValue = s_participants.length*i_entranceFee*4;
        prizeValue = prizeValue / 5;
        
        if(s_participants.length == 1){
            prizeValue = i_entranceFee;
        }
        return prizeValue;
    }
    
    function getNumberOfParticipants() public view returns(uint256) {
        return s_participants.length;
    }

   
}