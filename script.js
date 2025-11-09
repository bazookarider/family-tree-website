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
        
        if (data.matches && data.matches