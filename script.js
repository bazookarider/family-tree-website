 const API_KEY = 'uPBrckouMX9YFjJNKxfj6fPcTAZLtImfEnMeIyka27BQDGsVSx5HTCwiU0Uu';
const API_URL = 'https://api.football-data.org/v4/matches';

async function fetchLiveScores() {
    const loadingElement = document.getElementById('loading');
    const scoresElement = document.getElementById('scores');
    
    loadingElement.style.display = 'block';
    scoresElement.innerHTML = '';

    try {
        const response = await fetch(API_URL, {
            headers: {
                'X-Auth-Token': API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        loadingElement.style.display = 'none';
        
        if (data.matches && data.matches.length > 0) {
            displayScores(data.matches);
        } else {
            showNoMatches();
        }
        
        updateLastUpdated();
        
    } catch (error) {
        console.error('Error fetching scores:', error);
        loadingElement.style.display = 'none';
        scoresElement.innerHTML = `
            <div class="no-matches">
                <p>⚠️ Unable to load live scores</p>
                <p>Please check your connection and try again</p>
                <button onclick="fetchLiveScores()" style="margin-top: 10px;">Retry</button>
            </div>
        `;
    }
}

function displayScores(matches) {
    const container = document.getElementById('scores');
    container.innerHTML = '';

    // Sort matches: LIVE first, then recent finished, then scheduled
    matches.sort((a, b) => {
        if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
        if (a.status !== 'LIVE' && b.status === 'LIVE') return 1;
        if (a.status === 'IN_PLAY' && b.status !== 'IN_PLAY') return -1;
        if (a.status !== 'IN_PLAY' && b.status === 'IN_PLAY') return 1;
        return new Date(b.utcDate) - new Date(a.utcDate);
    });

    matches.forEach(match => {
        const matchElement = createMatchElement(match);
        container.appendChild(matchElement);
    });
}

function createMatchElement(match) {
    const matchElement = document.createElement('div');
    matchElement.className = `match ${match.status.toLowerCase().replace('_', '-')}`;
    
    const homeScore = match.score.fullTime?.home ?? match.score.halfTime?.home ?? '-';
    const awayScore = match.score.fullTime?.away ?? match.score.halfTime?.away ?? '-';
    
    const matchTime = new Date(match.utcDate).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    matchElement.innerHTML = `
        <div class="match-header">
            <span class="competition">${match.competition?.name || 'Unknown Competition'}</span>
            <span class="status ${match.status}">${getStatusText(match.status)}</span>
        </div>
        <div class="teams">
            <div class="team team-home">
                <div class="team-name">${match.homeTeam?.name || 'TBD'}</div>
            </div>
            <div class="score">${homeScore} - ${awayScore}</div>
            <div class="team team-away">
                <div class="team-name">${match.awayTeam?.name || 'TBD'}</div>
            </div>
        </div>
        <div class="match-time">
            ${getMatchTimeInfo(match)}
        </div>
    `;
    
    return matchElement;
}

function getStatusText(status) {
    const statusMap = {
        'LIVE': 'LIVE',
        'IN_PLAY': 'LIVE',
        'FINISHED': 'FT',
        'PAUSED': 'HT',
        'SCHEDULED': 'Upcoming',
        'POSTPONED': 'Postponed',
        'CANCELLED': 'Cancelled'
    };
    return statusMap[status] || status;
}

function getMatchTimeInfo(match) {
    if (match.status === 'LIVE' || match.status === 'IN_PLAY') {
        return '⚽ Live Now';
    } else if (match.status === 'FINISHED') {
        return '✅ Match Finished';
    } else if (match.status === 'SCHEDULED') {
        return `🕒 ${new Date(match.utcDate).toLocaleDateString()} ${new Date(match.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return match.status;
    }
}

function showNoMatches() {
    const container = document.getElementById('scores');
    container.innerHTML = `
        <div class="no-matches">
            <p>No live matches at the moment</p>
            <p>Check back later for upcoming games!</p>
        </div>
    `;
}

function updateLastUpdated() {
    const lastUpdatedElement = document.getElementById('lastUpdated');
    const now = new Date();
    lastUpdatedElement.textContent = `Last updated: ${now.toLocaleTimeString()}`;
}

// Auto-refresh every 2 minutes
setInterval(fetchLiveScores, 120000);

// Load scores when page loads
document.addEventListener('DOMContentLoaded', fetchLiveScores);