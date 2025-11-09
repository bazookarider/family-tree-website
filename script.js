 class PenaltyShootout {
    constructor() {
        this.playerScore = 0;
        this.cpuScore = 0;
        this.currentPenalty = 1;
        this.totalPenalties = 5;
        this.gameActive = false;
        this.difficulty = 'easy';
        
        this.ball = document.getElementById('ball');
        this.goalkeeper = document.getElementById('goalkeeper');
        this.messageEl = document.getElementById('message');
        this.playerScoreEl = document.querySelector('.player-score');
        this.cpuScoreEl = document.querySelector('.cpu-score');
        this.penaltyCountEl = document.querySelector('.penalty-count');
        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        
        this.sounds = {
            kick: document.getElementById('kickSound'),
            goal: document.getElementById('goalSound'),
            save: document.getElementById('saveSound'),
            crowd: document.getElementById('crowdSound')
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.showMessage('Click START GAME to begin!', '#ffd700');
    }
    
    setupEventListeners() {
        // Shot areas
        document.querySelectorAll('.area').forEach(area => {
            area.addEventListener('click', (e) => {
                if (!this.gameActive) return;
                this.takeShot(e.target.dataset.pos);
            });
        });
        
        // Difficulty buttons
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.difficulty = e.target.dataset.difficulty;
            });
        });
        
        // Start/Restart buttons
        this.startBtn.addEventListener('click', () => this.startGame());
        this.restartBtn.addEventListener('click', () => this.restartGame());
        
        // Ball click (alternative shooting method)
        this.ball.addEventListener('click', () => {
            if (!this.gameActive) return;
            this.showMessage('Click on goal areas to shoot!', '#ffd700');
        });
    }
    
    startGame() {
        this.gameActive = true;
        this.playerScore = 0;
        this.cpuScore = 0;
        this.currentPenalty = 1;
        
        this.updateScoreboard();
        this.startBtn.style.display = 'none';
        this.restartBtn.style.display = 'inline-block';
        this.ball.classList.add('ready');
        
        this.sounds.crowd.play();
        this.showMessage('Click where you want to shoot!', '#4ecdc4');
    }
    
    restartGame() {
        this.startGame();
    }
    
    takeShot(position) {
        if (!this.gameActive) return;
        
        this.ball.classList.remove('ready');
        this.sounds.kick.play();
        
        // Animate ball
        this.animateBall(position);
        
        // Goalkeeper reaction
        setTimeout(() => {
            const saved = this.goalkeeperSaves(position);
            
            if (saved) {
                this.sounds.save.play();
                this.showMessage('AMAZING SAVE! 🧤', '#ff6b6b');
                this.goalkeeper.classList.add('save-animation');
            } else {
                this.playerScore++;
                this.sounds.goal.play();
                this.showMessage('GOOOOAL! ⚽', '#4ecdc4');
                document.querySelector('.field').classList.add('goal-animation');
            }
            
            this.updateScoreboard();
            
            // Reset animations
            setTimeout(() => {
                this.resetPositions();
                this.currentPenalty++;
                
                if (this.currentPenalty > this.totalPenalties) {
                    this.endGame();
                } else {
                    this.ball.classList.add('ready');
                    this.showMessage(`Penalty ${this.currentPenalty}/${this.totalPenalties} - Click to shoot!`, '#ffd700');
                }
            }, 2000);
            
        }, 800);
    }
    
    animateBall(position) {
        const positions = {
            'top-left': { x: '-80px', y: '-100px', bottom: '180px' },
            'top-right': { x: '80px', y: '-100px', bottom: '180px' },
            'bottom-left': { x: '-60px', y: '-50px', bottom: '120px' },
            'bottom-right': { x: '60px', y: '-50px', bottom: '120px' },
            'center': { x: '-50%', y: '-80px', bottom: '150px' }
        };
        
        const target = positions[position];
        this.ball.style.setProperty('--target-x', target.x);
        this.ball.style.setProperty('--target-y', target.y);
        this.ball.style.setProperty('--target-bottom', target.bottom);
        this.ball.classList.add('kick');
    }
    
    goalkeeperSaves(shotPosition) {
        // Difficulty-based save chances
        const saveRates = {
            easy: 0.3,
            medium: 0.5,
            hard: 0.7
        };
        
        const saveRate = saveRates[this.difficulty];
        const willSave = Math.random() < saveRate;
        
        if (willSave) {
            // Choose dive direction
            const diveOptions = ['left', 'right', 'jump'];
            const dive = diveOptions[Math.floor(Math.random() * diveOptions.length)];
            
            // Animate goalkeeper
            this.goalkeeper.classList.add(`gk-${dive}`);
            
            // Check if save is successful based on shot position
            return this.checkSaveSuccess(shotPosition, dive);
        }
        
        return false;
    }
    
    checkSaveSuccess(shotPosition, dive) {
        const saveMap = {
            'top-left': ['left', 'jump'],
            'top-right': ['right', 'jump'],
            'bottom-left': ['left'],
            'bottom-right': ['right'],
            'center': ['jump']
        };
        
        return saveMap[shotPosition].includes(dive);
    }
    
    resetPositions() {
        // Reset ball
        this.ball.classList.remove('kick');
        this.ball.style.removeProperty('--target-x');
        this.ball.style.removeProperty('--target-y');
        this.ball.style.removeProperty('--target-bottom');
        
        // Reset goalkeeper
        this.goalkeeper.className = 'goalkeeper';
        this.goalkeeper.innerHTML = '<div class="gk-body">🧤</div>';
        
        // Reset field
        document.querySelector('.field').classList.remove('goal-animation');
    }
    
    updateScoreboard() {
        this.playerScoreEl.textContent = this.playerScore;
        this.cpuScoreEl.textContent = this.cpuScore;
        this.penaltyCountEl.textContent = `Penalty ${this.currentPenalty}/${this.totalPenalties}`;
    }
    
    endGame() {
        this.gameActive = false;
        this.sounds.crowd.pause();
        
        let message = '';
        if (this.playerScore > 2) {
            message = `YOU WIN! 🏆 Final Score: ${this.playerScore}-${this.cpuScore}`;
        } else if (this.playerScore === 2) {
            message = `DRAW! 🤝 Final Score: ${this.playerScore}-${this.cpuScore}`;
        } else {
            message = `YOU LOSE! 😞 Final Score: ${this.playerScore}-${this.cpuScore}`;
        }
        
        this.showMessage(message, '#ffd700');
        this.showMessage('Click PLAY AGAIN for another match!', '#4ecdc4');
    }
    
    showMessage(text, color = '#ffffff') {
        this.messageEl.textContent = text;
        this.messageEl.style.color = color;
        this.messageEl.style.display = 'block';
        
        setTimeout(() => {
            this.messageEl.style.display = 'none';
        }, 3000);
    }
}

// Start the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new PenaltyShootout();
}); 
