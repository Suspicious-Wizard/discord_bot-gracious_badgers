import { Card } from '../cards/Card.js';
import { Deck } from '../cards/Deck.js';
import { HandRank } from './handRank.js';
 
const DEFAULT_ANTE = 100;
const HAND_SIZE = 5;
const MAX_PLAYERS = 5;

// game logic: create a PokerGame instance, then call ante() hand players thier hands
// then call bettingRound() and discard() 
// then call showdown() and results() to get the winner and pot
export class PokerGame {
    #deck;
    #pool = 0;
    #numberOfPlayers;
    #playerHands = []; // bot is playerHands[0]
    #playerCalls = 1;
 
    // for 1 player they play against a bot, for 2 players they play against each other
    constructor(ante = DEFAULT_ANTE, numberOfPlayers = 2, deck){
        if (MAX_PLAYERS < numberOfPlayers || numberOfPlayers < 1) throw new RangeError(`numberOfPlayers must be in [1, ${MAX_PLAYERS}]`);
        if (!Number.isInteger(ante) || ante <= 0) throw new RangeError('ante must be a positive integer');
        if (!deck) {
            deck = new Deck();
            deck.shuffle();
        }
        this.#deck = deck;
        this.ante = ante;
        this.#numberOfPlayers = numberOfPlayers;
        this.#playerCalls;

        this.#playerHands[0] = this.#deck.draw(HAND_SIZE).sort(byRankDesc);
        for (let i = 1; i < this.#numberOfPlayers; ++i) {
            this.#playerHands[i] = this.#deck.draw(HAND_SIZE).sort(byRankDesc);
        }
    }
 
    get pot() { return this.#pool; }
 
    /** @param {number[]} indices zero-based positions in playerHand */
    discard(indices, playerIndex) {
        const hand = this.#playerHands[playerIndex];
        for (const index of indices) {
            if (!Number.isInteger(index) || index < 0 || index >= hand.length) {
                throw new RangeError(`discard index must be a valid integer in [0, ${hand.length}), got ${index}`);
            }
            hand[index] = this.#deck.draw();
        }
        this.#playerHands[playerIndex] = Card.sortByRank(hand);
    }

    ante(amount = DEFAULT_ANTE) {
        if (!Number.isInteger(amount) || amount <= 0) {
            throw new RangeError(`bet must be a positive integer, got ${amount}`);
        }
        for (let i = 0; i < this.#numberOfPlayers; ++i) {
            // drain money from each players bank
            // if they can t afford the bet, they are folded
        }
        this.#pool += amount * this.#playerHands.length;
    }

    bettingRound(){
        let topBet = 0;
        for (let i = 0; i < this.#numberOfPlayers; ++i) {
            if (this.#playerHands[i] === null) continue; // skip folded players
            const playerBet = 0; 
            // TODO: get player bet from input
            if (!Number.isInteger(playerBet) || playerBet < 0) {
                throw new RangeError(`player bet must be a non-negative integer, got ${playerBet}`);
            }
            if (playerBet > topBet) {
                topBet = playerBet;
                if (i !== 0) i = 0; // reset to first player if a new top bet is made
                this.#playerCalls = 1; // reset player calls if a new top bet is made
            } 
            this.#playerCalls++;
        }
        bet(topBet, this.#playerCalls);
    }
 
    bet(amount, playerCalls) {
        if (!Number.isInteger(amount) || amount <= 0) {
            throw new RangeError(`bet must be a positive integer, got ${amount}`);
        }
        for (let i = 0; i < this.#numberOfPlayers; ++i) {
            // drain money from each players bank
            // if they can t afford the bet, they are folded
        }
        this.#pool += amount * playerCalls;
    }

    fold(playerIndex) {
        if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= this.#numberOfPlayers) {
            throw new RangeError(`playerIndex must be a valid integer in [0, ${this.#numberOfPlayers}), got ${playerIndex}`);
        }
        this.#playerHands[playerIndex] = null; // mark player as folded
    }
 
    showdown() {
        let winningHand = [0, 0, 0, 0, 0, 0,];
        let winnerIndex = 0;
        for (let i = 0; i < this.#numberOfPlayers; ++i) {
            const handRank = HandRank.rank(this.#playerHands[i]);
            const cmp = HandRank.compare(handRank, winningHand);
            if (cmp > 0) {
                winningHand = handRank;
                winnerIndex = i;
            }
        }
        return winnerIndex;
    }

    results() {
        const winnerIndex = this.showdown();
        return {
            winnerIndex,
            winningHand: this.#playerHands[winnerIndex],
            pot: this.#pool,
            playerHands: this.#playerHands,
        };
    }

    playerHand(playerIndex) {
        if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= this.#numberOfPlayers) {
            throw new RangeError(`playerIndex must be a valid integer in [0, ${this.#numberOfPlayers}), got ${playerIndex}`);
        }
        return this.#playerHands[playerIndex];
    }
}
 