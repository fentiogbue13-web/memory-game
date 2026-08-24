const gameBoard = document.getElementById('game-board');
const shuffleBtn = document.getElementById('shuffle-btn');
const startBtn = document.getElementById('start-btn');
const clickDisplay = document.getElementById('click-count');
const pairDisplay = document.getElementById('pair-count');
const aiPairDisplay = document.getElementById('ai-pair-count');
const turnDisplay = document.getElementById('turn-display');
const radioButtons = document.getElementsByName('boardSize');

let cards = [];
let flippedCards = [];
let clicks = 0;
let pairs = 0;
let aiPairs = 0;
let isShuffled = false;
let gameStarted = false;
let currentTurn = 'player'; // 'player' or 'ai'

/**
 * AI's memory of the board. Each entry is either:
 *  - undefined (never seen)
 *  - { rank, suit } if seen before
 * AI_MEMORY_ACCURACY models imperfect recall - the AI can "forget" a card
 * it saw a while ago, rather than having perfect information.
 */
let aiMemory = [];
const AI_MEMORY_ACCURACY = 0.85; // 85% chance the AI correctly recalls a previously seen card

radioButtons.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const rows = parseInt(e.target.value);
        createBoard(rows);
    });
});

function createBoard(rows) {
    gameBoard.innerHTML = '';
    cards = [];
    aiMemory = [];
    isShuffled = false;
    gameStarted = false;
    pairs = 0;
    aiPairs = 0;
    clicks = 0;
    currentTurn = 'player';

    const suits = ['club', 'diamond', 'heart', 'spade'];

    for (let i = 1; i <= rows; i++) {
        for (let j = 0; j < 4; j++) {
            const suitName = suits[j];
            cards.push({
                rank: i,
                suit: suitName,
                img: `images/${suitName}_${i}.png`
            });
            aiMemory.push(undefined);
        }
    }
    renderCards(false);
    updateStats();
}

function renderCards(faceDown) {
    gameBoard.innerHTML = '';
    cards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        const img = document.createElement('img');

        img.src = faceDown ? 'images/back.jpg' : card.img;
        img.dataset.index = index;
        cardDiv.appendChild(img);

        if (gameStarted) {
            cardDiv.addEventListener('click', () => handleCardClick(index, img));
        }
        gameBoard.appendChild(cardDiv);
    });
}

shuffleBtn.addEventListener('click', () => {
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    isShuffled = true;
    renderCards(false);
});

startBtn.addEventListener('click', () => {
    if (!isShuffled) {
        alert('Please shuffle the cards before starting the game.');
        return;
    }
    gameStarted = true;
    clicks = 0;
    pairs = 0;
    aiPairs = 0;
    currentTurn = 'player';
    updateStats();

    shuffleBtn.disabled = true;
    startBtn.disabled = true;
    radioButtons.forEach(r => r.disabled = true);

    renderCards(true);
});

function handleCardClick(index, imgElement) {
    if (currentTurn !== 'player') return; // block clicks during AI's turn
    if (flippedCards.length === 2 || imgElement.parentElement.classList.contains('highlight') || imgElement.src.indexOf('back.jpg') === -1) {
        return;
    }

    revealCard(index, imgElement);
    flippedCards.push({ index, element: imgElement });
    clicks++;
    clickDisplay.innerText = clicks;

    if (flippedCards.length === 2) {
        checkMatch('player');
    }
}

// Reveal a card and update the AI's memory of it (this is how the AI
// "learns" the board over time, same as a human player would).
function revealCard(index, imgElement) {
    imgElement.src = cards[index].img;
    aiMemory[index] = { rank: cards[index].rank, suit: cards[index].suit };
}

function checkMatch(actor) {
    const [card1, card2] = flippedCards;
    const match = cards[card1.index].rank === cards[card2.index].rank;

    if (match) {
        card1.element.parentElement.classList.add('highlight');
        card2.element.parentElement.classList.add('highlight');
        if (actor === 'player') {
            pairs++;
        } else {
            aiPairs++;
        }
        flippedCards = [];
        updateStats();

        if (pairs + aiPairs === cards.length / 2) {
            setTimeout(() => endGame(), 500);
            return;
        }
        // Matching a pair earns another go, same as classic Pairs/Concentration rules
        setTimeout(() => takeTurn(actor), 600);
    } else {
        setTimeout(() => {
            card1.element.src = 'images/back.jpg';
            card2.element.src = 'images/back.jpg';
            flippedCards = [];
            currentTurn = actor === 'player' ? 'ai' : 'player';
            updateStats();
            if (currentTurn === 'ai') setTimeout(aiTurn, 800);
        }, 1000);
    }
}

function takeTurn(actor) {
    currentTurn = actor;
    updateStats();
    if (actor === 'ai') setTimeout(aiTurn, 800);
}

/**
 * Core AI decision logic.
 *
 * 1. Look through memory for any known matching pair (two remembered cards
 *    with the same rank). If found, play that pair - a "confident" move.
 * 2. Apply AI_MEMORY_ACCURACY: even a known pair has a chance of being
 *    misremembered, modelling imperfect recall rather than a perfect-info AI.
 * 3. If no known pair is found (or memory fails), pick one known card to
 *    pair with an unseen one, or fall back to a random unseen card.
 *
 * This is a probabilistic, information-based strategy rather than a fixed
 * script - the AI's move quality genuinely depends on what it has observed
 * so far in the game.
 */
function chooseAiMove() {
    const cardDivs = document.querySelectorAll('.card');
    const faceDownIndices = cards
        .map((_, i) => i)
        .filter(i => !cardDivs[i]?.classList.contains('highlight'))
        .filter(i => cardDivs[i]?.querySelector('img').src.indexOf('back.jpg') !== -1);

    const knownByRank = {};
    faceDownIndices.forEach(i => {
        const mem = aiMemory[i];
        if (mem) {
            knownByRank[mem.rank] = knownByRank[mem.rank] || [];
            knownByRank[mem.rank].push(i);
        }
    });

    const knownPair = Object.values(knownByRank).find(arr => arr.length >= 2);

    if (knownPair && Math.random() < AI_MEMORY_ACCURACY) {
        return [knownPair[0], knownPair[1]];
    }

    const knownSingles = Object.values(knownByRank).map(arr => arr[0]);

    let first = knownSingles.length > 0
        ? knownSingles[Math.floor(Math.random() * knownSingles.length)]
        : faceDownIndices[Math.floor(Math.random() * faceDownIndices.length)];

    let remaining = faceDownIndices.filter(i => i !== first);
    let second = remaining[Math.floor(Math.random() * remaining.length)];

    return [first, second];
}

function aiTurn() {
    if (currentTurn !== 'ai') return;
    const [i1, i2] = chooseAiMove();
    const cardEls = document.querySelectorAll('.card img');

    revealCard(i1, cardEls[i1]);
    flippedCards.push({ index: i1, element: cardEls[i1] });

    setTimeout(() => {
        revealCard(i2, cardEls[i2]);
        flippedCards.push({ index: i2, element: cardEls[i2] });
        checkMatch('ai');
    }, 500);
}

function updateStats() {
    pairDisplay.innerText = pairs;
    if (aiPairDisplay) aiPairDisplay.innerText = aiPairs;
    if (turnDisplay) turnDisplay.innerText = currentTurn === 'player' ? 'Your turn' : "AI's turn";
}

function endGame() {
    const result = pairs > aiPairs ? 'You win!' : pairs < aiPairs ? 'AI wins!' : "It's a draw!";
    alert(`Game over! ${result}  (You: ${pairs} pairs, AI: ${aiPairs} pairs)`);
    location.reload();
}