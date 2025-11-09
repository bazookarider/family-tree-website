 const gameBoard = document.getElementById('gameBoard');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const messageDisplay = document.getElementById('message');

// --- Game Settings ---
const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }]; 
let snake = INITIAL_SNAKE;
let food = {};
let dx = 0; 
let dy = 0; 
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameInterval;
let gameSpeed = 150; 
let isGameRunning = false;

// --- Initialization ---
highScoreDisplay.textContent = `High Score: ${highScore}`;
createGrid();
placeFood();

// Update score and high score
function updateScore(newScore) {
    score = newScore;
    scoreDisplay.textContent = `Score: ${score}`;
    if (score > highScore) {
        highScore = score;
        highScoreDisplay.textContent = `High Score: ${highScore}`;
        localStorage.setItem('snakeHighScore', highScore);
    }
}

// Create the visual grid (20x20 divs)
function createGrid() {
    gameBoard.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
    gameBoard.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        gameBoard.appendChild(cell);
    }
}

// Place the food in a random, empty cell
function placeFood() {
    let newFoodPosition;
    do {
        newFoodPosition = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
    } while (snake.some(segment => segment.x === newFoodPosition.x && segment.y === newFoodPosition.y));
    
    food = newFoodPosition;
}

// Draw the game state (snake and food)
function drawGame() {
    // Clear the board
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('snake', 'food');
    });

    // Draw snake
    snake.forEach(segment => {
        const cellIndex = segment.y * GRID_SIZE + segment.x;
        const cell = gameBoard.querySelector(`[data-index="${cellIndex}"]`);
        if (cell) {
            cell.classList.add('snake');
        }
    });

    // Draw food
    const foodIndex = food.y * GRID_SIZE + food.x;
    const foodCell = gameBoard.querySelector(`[data-index="${foodIndex}"]`);
    if (foodCell) {
        foodCell.classList.add('food');
    }
}

// Game Logic: Moving the snake
function moveSnake() {
    // Create the new head position
    const newHead = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Check for collision
    if (
        newHead.x < 0 || 
        newHead.x >= GRID_SIZE || 
        newHead.y < 0 || 
        newHead.y >= GRID_SIZE ||
        snake.some((segment, index) => index > 0 && segment.x === newHead.x && segment.y === newHead.y)
    ) {
        gameOver();
        return;
    }

    // Add the new head to the front
    snake.unshift(newHead);

    // Check if food was eaten
    if (newHead.x === food.x && newHead.y === food.y) {
        updateScore(score + 10);
        placeFood(); 
        // Increase speed slightly
        gameSpeed = Math.max(80, gameSpeed * 0.95); 
        clearInterval(gameInterval);
        gameInterval = setInterval(moveSnake, gameSpeed);
    } else {
        // If no food, remove the tail
        snake.pop(); 
    }

    drawGame();
}

// Game Start/Reset
function startGame() {
    if (isGameRunning) return;

    snake = INITIAL_SNAKE;
    dx = 1; // Start moving right 
    dy = 0;
    updateScore(0);
    placeFood();
    drawGame();
    gameSpeed = 150;
    isGameRunning = true;
    messageDisplay.textContent = 'Game started. Use arrow keys or WASD.';
    gameInterval = setInterval(moveSnake, gameSpeed);
}

// Game Over
function gameOver() {
    clearInterval(gameInterval);
    isGameRunning = false;
    messageDisplay.innerHTML = `**Game Over!** Final Score: ${score}. Press **any arrow key** or **W, A, S, D** to restart.`;
}

// Input Handling (Controls)
document.addEventListener('keydown', e => {
    let key = e.key;

    // Start or restart the game
    if (!isGameRunning && (key.includes('Arrow') || ['w', 'a', 's', 'd'].includes(key.toLowerCase()))) {
        startGame();
        return; 
    }

    if (!isGameRunning) return; 

    // Handle direction change
    switch (key) {
        case 'ArrowUp':
        case 'w':
            if (dy !== 1) { dx = 0; dy = -1; }
            break;
        case 'ArrowDown':
        case 's':
            if (dy !== -1) { dx = 0; dy = 1; }
            break;
        case 'ArrowLeft':
        case 'a':
            if (dx !== 1) { dx = -1; dy = 0; }
            break;
        case 'ArrowRight':
        case 'd':
            if (dx !== -1) { dx = 1; dy = 0; }
            break;
    }
});

// Initial draw
drawGame();
