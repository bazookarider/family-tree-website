 class FootballPredictor {
    constructor() {
        this.userPoints = 1000;
        this.predictions = [];
        this.matches = [];
        this.leaderboard = [];
        this.currentSimulation = null;
        
        this.initializeApp();
    }
    
    initializeApp() {
        this.loadSampleData();
        this.setupEventListeners();
        this.updateUI();
    }
    
    loadSampleData() {
        // Sample upcoming matches
        this.matches = [
            {
                id: 1,
                homeTeam: { name: "Manchester United", logo: "https://via.placeholder.com/60x60/DA291C/ffffff?text=MUN", strength: 85 },
                awayTeam: { name: "Liverpool", logo: "https://via.placeholder.com/60x60/C8102E/ffffff?text=LIV", strength: 88 },
                competition: "Premier League",
                date: "2024-11-15 15:00",
                venue: "Old Trafford"
            },
            {
                id: 2,
                homeTeam: { name: "Barcelona", logo: "https://via.placeholder.com/60x60/A50044/ffffff?text=FCB", strength: 90 },
                awayTeam: { name: "Real Madrid", logo: "https://via.placeholder.com/60x60/004481/ffffff?text=RMA", strength: 89 },
                competition: "La Liga",
                date: "2024-11-16 20:00",
                venue: "Camp Nou"
            },
            {
                id: 3,
                homeTeam: { name: "Bayern Munich", logo: "https://via.placeholder.com/60x6000/DC052D/ffffff?text=FCB", strength: 87 },
                awayTeam: { name: "Borussia Dortmund", logo: "https://via.placeholder.com/60x60/FDE100/000000?text=BVB", strength: 84 },
                competition: "Bundesliga",
                date: "2024-11-17 17:30",
                venue: "Allianz Arena"
            }
        ];
        
        // Sample leaderboard
        this.leaderboard = [
            { rank: 1, name: "You", points: 1000, accuracy: "65%" },
            { rank: 2, name: "Alex Predictor", points: 950, accuracy: "62%" },
            { rank: 3, name: "Goal Guru", points: 890, accuracy: "60%" },
            { rank: 4, name: "Footy Expert", points: 840, accuracy: "58%" },
            { rank: 5, name: "Soccer Sage", points: 790, accuracy: "55%" }
        ];
        
        // Sample prediction history
        this.predictions = [
            { match: "Man City 2-1 Chelsea", prediction: "2-1", actual: "2-1", correct: true, points: 50 },
            { match: "Arsenal 3-0 Tottenham", prediction: "2-1", actual: "3-0", correct: false, points: 0 },
            { match: "Inter 1-1 Milan", prediction: "1-1", actual: "1-1", correct: true, points: 45 }
        ];
    }setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            this.switchTab(e.target.dataset.tab);
        });
    });
    
    // Modal
    const modal = document.getElementById('predictionModal');
    const closeBtn = document.querySelector('.close');
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Prediction submission
    document.getElementById('submitPrediction').addEventListener('click', () => {
        this.submitPrediction();
    });
    
    // Simulation controls
    document.getElementById('startSimulation').addEventListener('click', () => {
        this.startSimulation();
    });
    
    document.getElementById('fastForward').addEventListener('click', () => {
        this.fastForwardSimulation();
    });
    
    document.getElementById('resetSimulation').addEventListener('click', () => {
        this.resetSimulation();
    });
}

switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // Load specific tab data
    if (tabName === 'predict') {
        this.loadMatches();
    } else if (tabName === 'leaderboard') {
        this.loadLeaderboard();
    } else if (tabName === 'stats') {
        this.loadUserStats();
    }
}

loadMatches() {
    const grid = document.getElementById('matchesGrid');
    grid.innerHTML = '';
    
    this.matches.forEach(match => {
        const matchCard = this.createMatchCard(match);
        grid.appendChild(matchCard);
    });
}

createMatchCard(match) {
    const card = document.createElement('div');
    card.className = 'match-card';
    card.innerHTML = `
        <div class="match-teams">
            <div class="team home-team">
                <img src="${match.homeTeam.logo}" alt="${match.homeTeam.name}">
                <span class="team-name">${match.homeTeam.name}</span>
            </div>
            <div class="vs">VS</div>
            <div class="team away-team">
                <img src="${match.awayTeam.logo}" alt="${match.awayTeam.name}">
                <span class="team-name">${match.awayTeam.name}</span>
            </div>
        </div>
        <div class="match-info">
            ${match.competition} • ${new Date(match.date).toLocaleDateString()} • ${match.venue}
        </div>
        <button class="predict-btn" data-match-id="${match.id}">
            Make Prediction
        </button>
    `;
    
    card.querySelector('.predict-btn').addEventListener('click', () => {
        this.openPredictionModal(match);
    });
    
    return card;
}    openPredictionModal(match) {
        const modal = document.getElementById('predictionModal');
        const matchInfo = document.getElementById('predictionMatchInfo');
        
        matchInfo.innerHTML = `
            <div class="match-teams">
                <div class="team home-team">
                    <img src="${match.homeTeam.logo}" alt="${match.homeTeam.name}">
                    <span class="team-name">${match.homeTeam.name}</span>
                </div>
                <div class="vs">VS</div>
                <div class="team away-team">
                    <img src="${match.awayTeam.logo}" alt="${match.awayTeam.name}">
                    <span class="team-name">${match.awayTeam.name}</span>
                </div>
            </div>
            <div class="match-info">
                ${match.competition} • ${new Date(match.date).toLocaleDateString()}
            </div>
        `;
        
        modal.style.display = 'block';
        modal.dataset.currentMatch = match.id;
    }
    
    submitPrediction() {
        const modal = document.getElementById('predictionModal');
        const matchId = parseInt(modal.dataset.currentMatch);
        const homeScore = parseInt(document.getElementById('homeScore').value);
        const awayScore = parseInt(document.getElementById('awayScore').value);
        const confidence = parseInt(document.getElementById('confidence').value);
        
        const match = this.matches.find(m => m.id === matchId);
        
        if (match) {
            const prediction = {
                matchId: matchId,
                match: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                prediction: `${homeScore}-${awayScore}`,
                confidence: confidence,
                timestamp: new Date()
            };
            
            this.predictions.push(prediction);
            this.userPoints += 25;
            
            this.showNotification(`Prediction submitted: ${homeScore}-${awayScore}`, 'success');
            modal.style.display = 'none';
            this.updateUI();
        }
    }
    
    startSimulation() {
        const startBtn = document.getElementById('startSimulation');
        const fastForwardBtn = document.getElementById('fastForward');
        
        startBtn.disabled = true;
        fastForwardBtn.disabled = false;
        
        const match = this.matches[Math.floor(Math.random() * this.matches.length)];
        this.simulateMatch(match);
    }
    
    simulateMatch(match) {
        const commentaryFeed = document.getElementById('commentaryFeed');
        commentaryFeed.innerHTML = '<div class="commentary-item">Match simulation starting...</div>';
        
        document.querySelector('.home-team .team-name').textContent = match.homeTeam.name;
        document.querySelector('.away-team .team-name').textContent = match.awayTeam.name;
        document.querySelector('.home-team img').src = match.homeTeam.logo;
        document.querySelector('.away-team img').src = match.awayTeam.logo;
        
        this.addCommentary(`🏁 Simulation complete! Check other methods for full game.`, 'fullTime');
        document.getElementById('startSimulation').disabled = false;
        document.getElementById('fastForward').disabled = true;
    }
    
    addCommentary(text, type = 'normal') {
        const commentaryFeed = document.getElementById('commentaryFeed');
        const item = document.createElement('div');
        item.className = `commentary-item ${type}`;
        item.textContent = text;
        commentaryFeed.appendChild(item);
        commentaryFeed.scrollTop = commentaryFeed.scrollHeight;
    }
    
    fastForwardSimulation() {
        this.addCommentary(`⏩ Fast-forwarded to end`, 'normal');
        document.getElementById('startSimulation').disabled = false;
        document.getElementById('fastForward').disabled = true;
    }
    
    resetSimulation() {
        const commentaryFeed = document.getElementById('commentaryFeed');
        commentaryFeed.innerHTML = '<div class="commentary-item">Match about to start...</div>';
        document.getElementById('startSimulation').disabled = false;
        document.getElementById('fastForward').disabled = true;
    }
    
    loadLeaderboard() {
        const leaderboardList = document.getElementById('leaderboardList');
        leaderboardList.innerHTML = '';
        
        this.leaderboard.forEach(entry => {
            const item = document.createElement('div');
            item.className = `leaderboard-item ${entry.name === 'You' ? 'you' : ''}`;
            item.innerHTML = `
                <div class="rank">#${entry.rank}</div>
                <div class="user-info">${entry.name}</div>
                <div class="points">${entry.points} pts</div>
                <div class="accuracy">${entry.accuracy}</div>
            `;
            leaderboardList.appendChild(item);
        });
    }
    
    loadUserStats() {
        const historyContainer = document.getElementById('predictionHistory');
        historyContainer.innerHTML = '';
        
        this.predictions.forEach(pred => {
            const item = document.createElement('div');
            item.className = `prediction-item ${pred.correct ? 'correct' : 'incorrect'}`;
            item.innerHTML = `
                <div class="prediction-match">${pred.match}</div>
                <div class="prediction-details">
                    <span>You: ${pred.prediction}</span>
                    <span>Actual: ${pred.actual}</span>
                    <span class="points">+${pred.points} pts</span>
                </div>
            `;
            historyContainer.appendChild(item);
        });
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4ecdc4' : '#ff6b6b'};
            color: white;
            border-radius: 10px;
            z-index: 10000;
            font-weight: bold;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }
    
    updateUI() {
        document.getElementById('userPoints').textContent = this.userPoints;
        const correctPredictions = this.predictions.filter(p => p.correct).length;
        const totalPredictions = this.predictions.length;
        const accuracy = totalPredictions > 0 ? Math.round((correctPredictions / totalPredictions) * 100) : 0;
        document.getElementById('userAccuracy').textContent = `${accuracy}%`;
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new FootballPredictor();
});