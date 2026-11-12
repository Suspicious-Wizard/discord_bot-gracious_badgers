import { Card, Suit } from './Card.js';

// new Deck()                  -> one standard 52-card deck
// new Deck(6)                 -> six-deck shoe
// new Deck(['AS', 'KH', ...]) -> exactly these cards (Card objects or strings)

export class Deck {
    #capacity; // number of 52-card decks in the total deck
    #cards = [];
    #discarded = [];

    constructor(source = 1, { allowDuplicates = false } = {}) {
        if (Array.isArray(source)) {
            // map() also copies, so the caller's array and this deck never alias
            this.#cards = source.map(c => (c instanceof Card ? c : Card.fromString(c)));
            if (!allowDuplicates) Deck.#assertNoDuplicates(this.#cards);
        } else if (Number.isInteger(source) && source > 0) {
            // form the deck
            for (let deck = 0; deck < source; ++deck) {
                for (const suit of Object.values(Suit)) {
                    for (let rank = 2; rank <= 14; ++rank) {
                        this.#cards.push(new Card(rank, suit));
                    }
                }
            }
        } else {
            throw new TypeError('Deck expects a positive integer (number of decks) or an array of cards');
        }
        this.#capacity = this.#cards.length;
    }

    // Deck.of('AS', 'KS', 'QS')
    static of(...cards) { return new Deck(cards); }

    static #assertNoDuplicates(cards) {
        const seen = new Set();
        for (const card of cards) {
            if (seen.has(card.key)) throw new Error(`duplicate card in deck: ${card}`);
            seen.add(card.key);
        }
    }

    // pop off back of array; returns undefined for an empty deck
    draw(cards = 1) { 
        let hand = [];
        for (let i = 0; i < cards; ++i) {
            const card = this.#cards.pop();
            if (!card) break;
            hand.push(card);
        }
        return hand;
    }
    get capacity() { return this.#capacity; }
    get size() { return this.#cards.length; }

    // fisher yates shuffle
    shuffle(){
        for(let i = this.#cards.length-1; i>0; --i){
            let j = Math.floor(Math.random() * (i+1)); // [0,1)
            [this.#cards[i], this.#cards[j]] = [this.#cards[j], this.#cards[i]]; // swap in place
        }
    }
}