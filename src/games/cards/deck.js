// how the deck works as a whole
// cards, draw(), shuffle(), capacity(), size()

// #include "card.js";

class Deck {
    #shoes; // number of 52-card decks in the total deck
    #cards = [];
    #discarded = [];

    static SUITS = ["hearts", "diamonds", "clubs", "spades"];
    static RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

    constructor(shoes = 1){
        this.#shoes = shoes;
        // form the deck
        for(let shoe=0; shoe<shoes; ++shoe){
            for(suit of Deck.SUITS){
                for(rank of Deck.RANKS){
                    this.#cards.push(new Card(suit, rank));
                }
            }
        }
    }

    get draw() { return 1; } // pop off back
    get capacity() { return this.#shoes * 52; }
    get size() { return this.#cards.length; }

    // fisher yates shuffle
    shuffle(){
        for(let i = this.#cards.length-1; i>0; --i){
            let j = Math.floor(Math.random() * (i+1));
            [this.#cards[i], this.#cards[j]] = [this.#cards[j], this.#cards[i]]; // swap in place
        }
    }
}