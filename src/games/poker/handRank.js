import { Card } from './Card.js';

// poker hand tiers, in order of strength
const Tier = {
    ROYAL_FLUSH:    { name: 'royal flush',      tier: 9, },
    STRAIGHT_FLUSH: { name: 'straight flush',   tier: 8, },
    QUADS:          { name: 'four of a kind',   tier: 7, },
    FULL_HOUSE:     { name: 'full house',       tier: 6, },
    FLUSH:          { name: 'flush',            tier: 5, },
    STRAIGHT:       { name: 'straight',         tier: 4, },
    TRIPLES:        { name: 'three of a kind',  tier: 3, },
    TWO_PAIR:       { name: 'two pair',         tier: 2, },
    PAIR:           { name: 'pair',             tier: 1, },
    HIGH_CARD:      { name: 'high card',        tier: 0, },
};

export class HandRank {
    #tier;
    #cards = [];

    constructor(cards) {
        if (!Array.isArray(cards) || cards.length !== 5) throw new Error('Hand must have exactly 5 cards');
        if (!cards.every(card => card instanceof Card)) throw new TypeError('Hand must contain Card objects');

        // how many cards of each rank: 8 8 8 K K -> Map { 8 => 3, 13 => 2 }
        const counts = new Map();
        for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);

        // copy, then sort into tiebreak order: bigger group first, then higher rank
        this.#cards = [...cards].sort((a, b) =>
            counts.get(b.rank) - counts.get(a.rank) || b.rank - a.rank);

        // ace-low straight (A 5 4 3 2): the ace plays as a 1, so move it to the end
        if (HandRank.#isWheel(this.#cards)) this.#cards.push(this.#cards.shift());

        this.#tier = HandRank.#determineTier(this.#cards, counts);
    }

    static #isWheel(cards) {
        return [14, 5, 4, 3, 2].every((rank, i) => cards[i].rank === rank);
    }

    // cards must already be in tiebreak order (see constructor)
    static #determineTier(cards, counts) {
        const ranks = cards.map(card => card.rank);

        // 5 distinct ranks spanning exactly 4 means consecutive; the wheel is [5,4,3,2,14]
        const isWheel = ranks[0] === 5 && ranks[4] === 14;
        const isStraight = counts.size === 5 && (ranks[0] - ranks[4] === 4 || isWheel);

        const isFlush = cards.every(card => card.suit === cards[0].suit);

        // one entry per rank that appears more than once
        const sets = [...counts]
            .filter(([, count]) => count > 1)
            .map(([rank, count]) => ({ rank, count }));

        // determine tier based on checks
        if (isStraight && isFlush && ranks[0] === 14) {
            return Tier.ROYAL_FLUSH;
        } else if (isStraight && isFlush) {
            return Tier.STRAIGHT_FLUSH;
        } else if (sets.some(set => set.count === 4)) {
            return Tier.QUADS;
        } else if (sets.some(set => set.count === 3) && sets.some(set => set.count === 2)) {
            return Tier.FULL_HOUSE;
        } else if (isFlush) {
            return Tier.FLUSH;
        } else if (isStraight) {
            return Tier.STRAIGHT;
        } else if (sets.some(set => set.count === 3)) {
            return Tier.TRIPLES;
        } else if (sets.filter(set => set.count === 2).length === 2) {
            return Tier.TWO_PAIR;
        } else if (sets.some(set => set.count === 2)) {
            return Tier.PAIR;
        } else {
            return Tier.HIGH_CARD;
        }
    }

    // negative: a loses, positive: a wins, 0: tie (split pot). Works with Array.sort
    static compare(a, b) {
        const x = a.order(), y = b.order();
        for (let i = 0; i < x.length; ++i) {
            if (x[i] !== y[i]) return x[i] - y[i];
        }
        return 0;
    }

    get tier()  { return this.#tier; }
    get cards() { return [...this.#cards]; }

    order() { return [this.#tier.tier, ...this.#cards.map(card => card.rank)]; }
}

export { Tier };