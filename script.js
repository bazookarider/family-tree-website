const gameBoard = document.getElementById('gameBoard');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const messageDisplay = document.getElementById('message');

// --- Game Settings ---
const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }]; // Start in the middle
let snake = INITIAL_SNAKE;
let food = {};
let dx = 0; // x-direction velocity
let dy = 0; // y-direction velocity
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameInterval;
let gameSpeed = 150; // Milliseconds per move
let isGameRunning = false;

// --- Initialization ---
highScoreDisplay.textContent = `High Score: ${highScore}`;
createGrid();
placeFood();

// Helper to update score display
function updateScore(newScore) {
    score = newScore;
    scoreDisplay.textContent = `Score: ${score}`;
    if (score > highScore) {
        highScore = score;
        highScoreDisplay.textContent = `High Score: ${highScore}`;
        localStorage.setItem('snakeHighScore', highScore);
    }
}

// 1. Create the visual grid (20x20 divs)
function createGrid() {
    gameBoard.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
    gameBoard.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        // We'll use a data attribute for easier lookup
        cell.dataset.index = i;
        gameBoard.appendChild(cell);
    }
}

// 2. Place the food in a random cell not occupied by the snake
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

// 3. Draw the game state (snake and food)
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

// 4. Game Logic: Moving the snake
function moveSnake() {
    // 4a. Create the new head position
    const newHead = { x: snake[0].x + dx, y: snake[0].y + dy };

    // 4b. Check for self-collision or wall collision
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

    // 4c. Check if food was eaten
    if (newHead.x === food.x && newHead.y === food.y) {
        updateScore(score + 10);
        placeFood(); // Place new food
        // Increase speed slightly for more difficulty
        gameSpeed = Math.max(80, gameSpeed * 0.95); 
        clearInterval(gameInterval);
        gameInterval = setInterval(moveSnake, gameSpeed);
    } else {
        // If no food, remove the tail (snake moves)
        snake.pop(); 
    }

    drawGame();
}

// 5. Game Start/Reset
function startGame() {
    if (isGameRunning) return;

    snake = INITIAL_SNAKE;
    dx = 1; // Start moving right (initial direction)
    dy = 0;
    updateScore(0);
    placeFood();
    drawGame();
    gameSpeed = 150;
    isGameRunning = true;
    messageDisplay.textContent = 'Game started. Use arrow keys or WASD.';
    gameInterval = setInterval(moveSnake, gameSpeed);
}

// 6. Game Over
function gameOver() {
    clearInterval(gameInterval);
    isGameRunning = false;
    messageDisplay.innerHTML = `**Game Over!** Final Score: ${score}. Press **any arrow key** or **W, A, S, D** to restart.`;
}

// 7. Input Handling (Controls)
document.addEventListener('keydown', e => {
    let key = e.key;

    // Check for a start/restart key press
    if (!isGameRunning && (key.includes('Arrow') || ['w', 'a', 's', 'd'].includes(key.toLowerCase()))) {
        startGame();
        return; 
    }

    // Only allow direction changes during an active game
    if (!isGameRunning) return; 

    // Prevent moving back on yourself immediately
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

// Initial draw to show the starting snake
drawGame();
