import { Deck } from '../cards/Deck.js';
import { HandRank } from './handRank.js';

const HAND_SIZE = 5;
const MAX_DISCARD = 3;   // standard draw-poker house rule: swap up to 3 cards
const MAX_PLAYERS = 6;   // 6 * (5 dealt + 3 drawn) = 48 cards, fits in one 52-card deck
const MAX_TRIES = 3;     // bad inputs before we auto check/fold for the player

/**
 * Play ONE hand of five-card draw with blinds, then settle coins.
 *
 *   const result = await playPoker(players, { smallBlind, bigBlind, delta, getAction, getDiscards });
 *
 * players  [{ id, name, chips }] in seat order. `chips` is what each player brings to the table
 *          (the lobby checks they can afford it). Need 2 to 6 players.
 * options
 *   smallBlind, bigBlind   positive integers
 *   dealer                 seat index of the dealer button (lobby rotates it between hands), default 0
 *   delta(id, amount)      db hook; called once per player at the END with their net win/loss
 *   getAction(player, view)   -> { type: 'fold' | 'check' | 'call' | 'raise' | 'allin', amount }
 *                              amount is the total to raise TO this round (only for 'raise')
 *   getDiscards(player, view) -> array of card indices (0-4) to throw away, [] to keep all
 *   announce(text)         optional, public play-by-play messages
 *   deck                   optional pre-built Deck (for tests); otherwise a fresh shuffled deck
 *
 * Resolves to { pots: [{ amount, winners: [id] }], players: [{ id, name, chips, net, folded, hand, handName }] }
 * If getAction/getDiscards throws, the hand aborts before delta is called, so nobody loses coins.
 */
export async function playPoker(players, options) {
    const {
        smallBlind, bigBlind, dealer = 0,
        delta, getAction, getDiscards,
        announce = () => {},
        deck = shuffledDeck(),
    } = options;
    validate(players, options);

    const n = players.length;
    const seats = players.map(p => ({
        id: p.id, name: p.name, chips: p.chips, start: p.chips,
        hand: [], bet: 0, total: 0, folded: false, // bet = this round, total = whole hand
    }));
    const table = { seats, bigBlind, announce, getAction };

    // deal one card at a time, starting left of the dealer
    for (let r = 0; r < HAND_SIZE; ++r) {
        for (const p of rotate(seats, dealer + 1)) p.hand.push(...deck.draw(1));
    }

    // blinds: heads-up the dealer posts the small blind, otherwise the two seats left of the dealer
    const sb = n === 2 ? dealer % n : (dealer + 1) % n;
    const bb = (sb + 1) % n;
    announce(`${seats[sb].name} posts small blind ${pay(seats[sb], smallBlind)}`);
    announce(`${seats[bb].name} posts big blind ${pay(seats[bb], bigBlind)}`);

    // round 1: action starts left of the big blind (heads-up that's the dealer/small blind)
    announce('-- betting round 1 --');
    await bettingRound(table, bb + 1, bigBlind);

    if (contenders(seats).length > 1) {
        announce('-- draw --');
        for (const p of rotate(seats, dealer + 1)) {
            if (p.folded) continue;
            const discards = await askDiscards(p, getDiscards);
            p.hand = p.hand.filter((_, i) => !discards.includes(i)).concat(deck.draw(discards.length));
            announce(`${p.name} draws ${discards.length}`);
        }

        // round 2: action starts left of the dealer
        announce('-- betting round 2 --');
        for (const p of seats) p.bet = 0;
        await bettingRound(table, dealer + 1, 0);
    }

    const pots = awardPots(seats, dealer, announce);

    for (const p of seats) {
        const net = p.chips - p.start;
        if (net !== 0) await delta(p.id, net);
    }

    const showdown = contenders(seats).length > 1;
    return {
        pots,
        players: seats.map(p => ({
            id: p.id, name: p.name, chips: p.chips, net: p.chips - p.start, folded: p.folded,
            hand: showdown && !p.folded ? [...p.hand] : null,
            handName: showdown && !p.folded ? new HandRank(p.hand).tier.name : null,
        })),
    };
}

// ---------- betting ----------

// Everyone who can still act gets a turn. A raise re-opens action for everyone else.
// The round ends when the queue is empty (all have called/checked/folded) or one player is left.
async function bettingRound(table, first, currentBet) {
    const { seats, bigBlind, announce } = table;
    let minRaise = bigBlind; // a raise must be at least the big blind or the last raise size
    let queue = rotate(seats, first).filter(canAct);

    while (queue.length > 0 && contenders(seats).length > 1) {
        const p = queue.shift();
        if (!canAct(p)) continue;

        const othersCanAct = seats.some(q => q !== p && canAct(q));
        if (currentBet === p.bet && !othersCanAct) continue; // nobody left to bet against

        const legal = {
            toCall: Math.min(currentBet - p.bet, p.chips),
            canCheck: currentBet === p.bet,
            canRaise: othersCanAct && p.chips > currentBet - p.bet,
            minRaiseTo: Math.min(currentBet + minRaise, p.bet + p.chips),
            maxRaiseTo: p.bet + p.chips, // all in
            currentBet,
        };
        const action = await askAction(p, legal, table);

        if (action.type === 'fold') {
            p.folded = true;
            announce(`${p.name} folds`);
        } else if (action.type === 'check') {
            announce(`${p.name} checks`);
        } else if (action.type === 'call') {
            pay(p, currentBet - p.bet);
            announce(`${p.name} calls ${currentBet}${p.chips === 0 ? ' (all in)' : ''}`);
        } else { // raise
            pay(p, action.to - p.bet);
            announce(`${p.name} ${currentBet === 0 ? 'bets' : 'raises to'} ${action.to}${p.chips === 0 ? ' (all in)' : ''}`);
        }

        if (p.bet > currentBet) {
            // a short all-in raise doesn't change the min raise, but still makes others respond
            minRaise = Math.max(minRaise, p.bet - currentBet);
            currentBet = p.bet;
            queue = rotate(seats, seats.indexOf(p) + 1).filter(q => q !== p && canAct(q));
        }
    }
}

// Ask until we get a legal action; after MAX_TRIES bad answers, check if free, otherwise fold.
async function askAction(p, legal, table) {
    const pot = table.seats.reduce((sum, q) => sum + q.total, 0);
    let error = null;
    for (let tries = 0; tries < MAX_TRIES; ++tries) {
        const view = { ...legal, pot, chips: p.chips, bet: p.bet, hand: [...p.hand], error };
        const action = normalize(await table.getAction(publicInfo(p), view), legal);
        if (action) return action;
        error = 'illegal action, try again';
    }
    return { type: legal.canCheck ? 'check' : 'fold' };
}

// Turn the player's answer into a legal { type, to } or return null if it's illegal.
function normalize(action, legal) {
    const type = action?.type;
    if (type === 'fold') return { type };
    if (type === 'check') return legal.canCheck ? { type } : null;
    if (type === 'call') return { type: legal.canCheck ? 'check' : 'call' };
    if (type === 'allin') {
        if (legal.canRaise) return { type: 'raise', to: legal.maxRaiseTo };
        return { type: legal.canCheck ? 'check' : 'call' };
    }
    if (type === 'raise') {
        const to = Number(action.amount);
        if (!legal.canRaise || !Number.isInteger(to)) return null;
        if (to >= legal.maxRaiseTo) return { type, to: legal.maxRaiseTo }; // more than they have = all in
        if (to >= legal.minRaiseTo) return { type, to };
    }
    return null;
}

async function askDiscards(p, getDiscards) {
    for (let tries = 0; tries < MAX_TRIES; ++tries) {
        const picks = await getDiscards(publicInfo(p), { hand: [...p.hand], maxDiscard: MAX_DISCARD });
        const ok = Array.isArray(picks)
            && picks.length <= MAX_DISCARD
            && new Set(picks).size === picks.length
            && picks.every(i => Number.isInteger(i) && i >= 0 && i < HAND_SIZE);
        if (ok) return picks;
    }
    return []; // keep the hand
}

// ---------- payout ----------

// Main pot + side pots. Each "level" is an amount someone was all in for; a player can only
// win the slice of chips up to what they themselves put in. Folded players' chips stay in.
function awardPots(seats, dealer, announce) {
    const alive = contenders(seats);
    const ranks = new Map(alive.map(p => [p, new HandRank(p.hand)]));
    if (alive.length > 1) {
        for (const p of alive) announce(`${p.name} shows ${p.hand.join(' ')} (${ranks.get(p).tier.name})`);
    }

    // levels come only from players still in; folded chips just sit in whichever slice they reach
    const levels = [...new Set(alive.map(p => p.total))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const level of levels) {
        const amount = seats.reduce((sum, p) => sum + Math.min(p.total, level) - Math.min(p.total, prev), 0);
        prev = level;
        const eligible = alive.filter(p => p.total >= level);

        const best = eligible.reduce((a, b) => (HandRank.compare(ranks.get(b), ranks.get(a)) > 0 ? b : a));
        const winners = rotate(seats, dealer + 1) // seat order matters for the odd chip
            .filter(p => eligible.includes(p) && HandRank.compare(ranks.get(p), ranks.get(best)) === 0);

        const share = Math.floor(amount / winners.length);
        let oddChips = amount - share * winners.length; // go to winners closest left of the dealer
        for (const w of winners) w.chips += share + (oddChips-- > 0 ? 1 : 0);

        pots.push({ amount, winners: winners.map(w => w.id) });
    }

    for (const pot of pots) {
        const names = pot.winners.map(id => seats.find(p => p.id === id).name).join(' and ');
        announce(`${names} win${pot.winners.length === 1 ? 's' : ''} ${pot.amount}`);
    }
    return pots;
}

// ---------- helpers ----------

// move chips from stack into the pot; never more than they have (short = all in). Returns amount paid.
function pay(p, amount) {
    const paid = Math.min(amount, p.chips);
    p.chips -= paid;
    p.bet += paid;
    p.total += paid;
    return paid;
}

const canAct = p => !p.folded && p.chips > 0;            // all-in players are still in, but don't act
const contenders = seats => seats.filter(p => !p.folded);
const rotate = (arr, start) => arr.map((_, i) => arr[(start + i) % arr.length]);
const publicInfo = p => ({ id: p.id, name: p.name });

function shuffledDeck() {
    const deck = new Deck();
    deck.shuffle();
    return deck;
}

function validate(players, o) {
    if (!Array.isArray(players) || players.length < 2 || players.length > MAX_PLAYERS) {
        throw new RangeError(`need 2 to ${MAX_PLAYERS} players`);
    }
    if (new Set(players.map(p => p.id)).size !== players.length) throw new Error('duplicate player id');
    for (const p of players) {
        if (!Number.isInteger(p.chips) || p.chips <= 0) throw new RangeError(`${p.name} needs a positive integer chip count`);
    }
    if (!Number.isInteger(o.smallBlind) || !Number.isInteger(o.bigBlind) || o.smallBlind <= 0 || o.bigBlind < o.smallBlind) {
        throw new RangeError('blinds must be positive integers with smallBlind <= bigBlind');
    }
    for (const fn of ['delta', 'getAction', 'getDiscards']) {
        if (typeof o[fn] !== 'function') throw new TypeError(`${fn} must be a function`);
    }
}