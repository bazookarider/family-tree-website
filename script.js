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
        // Sample matches
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
            }
        ];
        
        // Sample leaderboard
        this.leaderboard = [
            { rank: 1, name: "You", points: 1000, accuracy: "65%" },
            { rank: 2, name: "Alex Predictor", points: 950, accuracy: "62%" },
            { rank: 3, name: "Goal Guru", points: 890, accuracy: "60%" }
        ];
        
        // Sample predictions
        this.predictions = [
            { match: "Man City 2-1 Chelsea", prediction: "2-1", actual: "2-1", correct: true, points: 50 },
            { match: "Arsenal 3-0 Tottenham", prediction: "2-1", actual: "3-0", correct: false, points: 0 }
        ];
    }
    
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('predictionModal').style.display = 'none';
        });
        
        // Prediction submission
        document.getElementById('submitPrediction').addEventListener('click', () => {
            this.submitPrediction();
        });
        
        // Simulation controls
        document.getElementById('startSimulation').addEventListener('click', () => {
            this.startSimulation();
        });
        
        document.getElementById('resetSimulation').addEventListener('click', () => {
            this.resetSimulation();
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('predictionModal')) {
                document.getElementById('predictionModal').style.display = 'none';
            }
        });
    }    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Show active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        
        // Load tab data
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
                    ${match.competition} • ${new Date(match.date).toLocaleDateString()}
                </div>
                <button class="predict-btn" data-match-id="${match.id}">
                    Make Prediction
                </button>
            `;
            
            card.querySelector('.predict-btn').addEventListener('click', () => {
                this.openPredictionModal(match);
            });
            
            grid.appendChild(card);
        });
    }
    
    openPredictionModal(match) {
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
        const homeScore = document.getElementById('homeScore').value;
        const awayScore = document.getElementById('awayScore').value;
        
        this.predictions.push({
            match: "Sample Match",
            prediction: `${homeScore}-${awayScore}`,
            actual: "?",
            correct: false,
            points: 0
        });
        
        this.userPoints += 25;
        this.showNotification(`Prediction submitted: ${homeScore}-${awayScore}`, 'success');
        modal.style.display = 'none';
        this.updateUI();
    }
    
    startSimulation() {
        const commentaryFeed = document.getElementById('commentaryFeed');
        commentaryFeed.innerHTML = '';
        
        this.addCommentary('🏟️ Match is starting...');
        this.addCommentary('⚽ First half begins');
        this.addCommentary('🎯 Chance! Great opportunity!');
        this.addCommentary('⚽ GOAL! Amazing strike!');
        this.addCommentary('🟨 Yellow card shown');
        this.addCommentary('🥅 Great save by the goalkeeper!');
        this.addCommentary('🏁 Match finished!');
        
        document.getElementById('startSimulation').disabled = true;
    }
    
    resetSimulation() {
        const commentaryFeed = document.getElementById('commentaryFeed');
        commentaryFeed.innerHTML = '<div class="commentary-item">Click Start Simulation to begin...</div>';
        document.getElementById('startSimulation').disabled = false;
    }
    
    addCommentary(text) {
        const commentaryFeed = document.getElementById('commentaryFeed');
        const item = document.createElement('div');
        item.className = 'commentary-item';
        item.textContent = text;
        commentaryFeed.appendChild(item);
        commentaryFeed.scrollTop = commentaryFeed.scrollHeight;
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
        // Simple alert for now
        alert(message);
    }
    
    updateUI() {
        document.getElementById('userPoints').textContent = this.userPoints;
        document.getElementById('userAccuracy').textContent = '65%';
    }
}

// Start the app
document.addEventListener('DOMContentLoaded', () => {
    new FootballPredictor();
});