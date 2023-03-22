# DeLott

This is a decentralized lottery system which takes an entry fee from the user. If there is only 1 participant in the lottery, the entire money is returned back to the participant. If there are more than 1 participant in the lottery, 80% of the total prize of money is given back to the randomly chosen winner and the rest 20% is kept as the platform's profit.
The time of reseting a lotery is currently kept a minute (for development and testing purposes).

It uses chainlink VRF and Chainlink automation to pick a random winner and automatically reset the lottery.

It's smart contract is deployed on Ethereum's Goerli TestNet.
Here is the contract address:
`0xDe0Ec4000475a5DE026dE12267A89f56F1B888Be`

Deployed Link to the Project: [https://delott.onrender.com](https://delott.onrender.com)

Link to the frontend: [https://github.com/aaravjn/lottery-frontend/](https://github.com/aaravjn/lottery-frontend/)