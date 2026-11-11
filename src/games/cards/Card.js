const Suit = {
  HEARTS:   { name: 'hearts',   symbol: '\u2665', color: 'red'   }, // ♥
  CLUBS:    { name: 'clubs',    symbol: '\u2663', color: 'black' }, // ♣
  DIAMONDS: { name: 'diamonds', symbol: '\u2666', color: 'red'   }, // ♦
  SPADES:   { name: 'spades',   symbol: '\u2660', color: 'black' }, // ♠
};

const RANK_LABELS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

const normalize = (text) => String(text).trim().toLowerCase().replace(/\uFE0F/g, '');

const SUIT_LOOKUP = new Map();
for (const suit of Object.values(Suit)) {
  for (const alias of [suit.name, suit.name.slice(0, -1), suit.name[0], suit.symbol]) {
    SUIT_LOOKUP.set(alias, suit);
  }
}

const RANK_LOOKUP = new Map([
  ['j', 11], ['jack', 11],
  ['q', 12], ['queen', 12],
  ['k', 13], ['king', 13],
  ['a', 14], ['ace', 14], ['1', 14], // map 1 to ace for convenience
]);
for (let r = 2; r <= 14; ++r) RANK_LOOKUP.set(String(r), r);

// return an integer 2-14 (ace high), or null if input isn't a rank
export function parseRank(input) {
  if (typeof input === 'number') {
    if (input === 1) return 14;
    return Number.isInteger(input) && input >= 2 && input <= 14 ? input : null;
  }
  if (typeof input !== 'string') return null;
  return RANK_LOOKUP.get(normalize(input)) ?? null;
}

const describe = (x) => x?.name ?? String(x);

export class Card {
  #rank;
  #suit;

  // construct a card from a rank and suit, in either order
  constructor(a, b) {
    let rank = parseRank(a);
    let suit = parseSuit(b);
    if (rank === null || suit === null) { // try the other order
      rank = parseRank(b);
      suit = parseSuit(a);
    }
    if (rank === null || suit === null) {
      throw new Error(`invalid parameters for card class: (${describe(a)}, ${describe(b)})`);
    }
    this.#rank = rank;
    this.#suit = suit;
  }

  static fromString(text) {
    const s = normalize(text);
    const words = s.split(/\s+(?:of\s+)?/);
    if (words.length === 2) return new Card(words[0], words[1]);
 
    // compact form: suit is the last character or the first
    for (const [r, su] of [[s.slice(0, -1), s.slice(-1)], [s.slice(1), s.slice(0, 1)]]) {
      if (parseRank(r) !== null && parseSuit(su) !== null) return new Card(r, su);
    }
    throw new Error(`can't parse "${text}" as a card`);
  }

  get rank() { return this.#rank; }
  get suit() { return this.#suit; }

  get rankLabel() {
    return this.#rank > 10 ? RANK_LABELS[this.#rank] : String(this.#rank);
  }

  get key() { return `${this.#rank}${this.#suit.name[0]}`; }

  equals(other) {
    return other instanceof Card && other.rank === this.#rank && other.suit === this.#suit;
  }

  toString() {
    return `${this.rankLabel}${this.#suit.symbol}`;
  }
}

export { Suit };