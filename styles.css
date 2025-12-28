:root {
    --bg-dark: #0a192f;
    --bg-card: #112240;
    --text-main: #ccd6f6;
    --neon-green: #64ffda; /* YOUR LEMON GREEN */
    --neon-red: #ff5f56;
    --navy-btn: #0f172a;
    --input-bg: #000000;
}

body { background-color: var(--bg-dark); color: var(--text-main); font-family: 'Inter', sans-serif; margin: 0; padding-bottom: 80px; overflow-x: hidden; }
.screen { display: none; min-height: 100vh; padding: 15px; box-sizing: border-box; }
.screen.active { display: block !important; }
.hidden { display: none !important; }

/* AUTH */
.auth-box { max-width: 320px; margin: 50px auto; padding: 25px; background: var(--bg-card); border-radius: 12px; text-align: center; border: 1px solid #233554; }
.logo-area { text-align: center; margin-top: 40px; }
input, select { width: 100%; padding: 15px; margin-bottom: 15px; background: var(--input-bg); border: 1px solid #333; color: white; border-radius: 8px; box-sizing: border-box; font-size: 16px; text-align: center; outline: none; }
select { text-align: left; }

/* HEADER */
header { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: var(--bg-card); border-radius: 10px; }
.user-pill { display: flex; gap: 5px; align-items: center; font-weight: bold; } 
.balance-pill h2 { margin: 0; color: var(--neon-green); }

/* --- AVIATOR STAGE --- */
.game-stage-galaxy {
    height: 280px; background: radial-gradient(circle at bottom left, #1a222e 0%, #000 100%);
    border-radius: 15px; margin-bottom: 15px; position: relative; border: 1px solid #333; overflow: hidden;
}
.flight-area { position: absolute; width: 100%; height: 100%; top: 0; left: 0; }
#plane-icon { 
    position: absolute; bottom: 20px; left: 20px; font-size: 50px; color: var(--neon-red); 
    /* Smooth movement handled by JS */
    z-index: 5;
}
.multiplier-overlay { position: absolute; top: 30px; left: 0; width: 100%; text-align: center; pointer-events: none; z-index: 10; }
#multiplier-display { font-size: 64px; font-weight: 900; color: white; text-shadow: 0 0 20px rgba(255,255,255,0.2); }
#status-text { letter-spacing: 2px; color: #888; font-size: 12px; font-weight: bold; margin-top: 5px; }

/* --- SPIN STAGE --- */
.spin-stage { height: 250px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 20px; }
.spin-card-container { perspective: 1000px; width: 140px; height: 200px; }
.spin-card { 
    width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transition: transform 0.6s; 
    border-radius: 12px; border: 2px solid #333;
}
.spin-card.flip { transform: rotateY(180deg); }
.spin-card .front, .spin-card .back {
    position: absolute; width: 100%; height: 100%; backface-visibility: hidden; 
    display: flex; align-items: center; justify-content: center; font-size: 60px; border-radius: 10px;
}
.spin-card .front { background: #111; color: #555; }
.spin-card .back { transform: rotateY(180deg); background: #222; }

/* CARD COLORS */
.bg-lemon { background-color: var(--neon-green) !important; color: #0a192f !important; border: 4px solid white; }
.bg-navy { background-color: #0a192f !important; color: var(--neon-green) !important; border: 4px solid var(--neon-green); }

/* RECEIPTS */
.receipt-mini { background: #111; padding: 10px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid var(--neon-green); font-size: 12px; display: flex; justify-content: space-between; }
.receipt-mini b { color: white; }

/* CONTROLS */
.aviator-controls { background: var(--bg-card); padding: 15px; border-radius: 12px; }
.quick-chips { display: flex; gap: 5px; margin-bottom: 10px; }
.chip-btn { flex: 1; background: #0a192f; border: 1px solid #233554; color: white; padding: 8px; border-radius: 20px; font-size: 11px; cursor: pointer; }
.bet-input-row { display: flex; gap: 10px; margin-bottom: 15px; }
.bet-input-row input { margin: 0; background: black; }
.adjust-btn { width: 50px; background: #233554; border: none; color: white; font-size: 20px; border-radius: 8px; }
.auto-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; color: #888; }

.neon-btn { width: 100%; padding: 15px; border-radius: 8px; border: 1px solid var(--neon-green); font-weight: bold; cursor: pointer; color: var(--neon-green); background: transparent; font-size: 16px; }
.neon-btn:active, .neon-btn.large { background: var(--neon-green); color: #0a192f; }
.neon-btn.white-btn { background: white; color: #333; border: none; }

.spin-actions { display: flex; gap: 10px; width: 100%; margin-top: 10px; }
.spin-btn { flex: 1; padding: 20px; border: none; font-weight: bold; font-size: 16px; border-radius: 8px; cursor: pointer; color: white; }
.spin-btn.lemon { background: var(--neon-green); color: black; }
.spin-btn.navy { background: var(--bg-dark); border: 2px solid var(--neon-green); color: var(--neon-green); }

/* HISTORY */
.round-history-bar { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 10px; }
.history-pill { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #232a35; min-width: 35px; text-align: center; }
.history-pill.purple { color: #d946ef; border: 1px solid #d946ef; }
.history-pill.blue { color: #3b82f6; border: 1px solid #3b82f6; }
.history-pill.red { color: var(--neon-red); border: 1px solid var(--neon-red); }

/* PROFILE & MODALS */
.profile-header-card { text-align: center; background: var(--bg-card); padding: 20px; border-radius: 12px; margin-bottom: 20px; }
.avatar-circle { width: 60px; height: 60px; background: var(--neon-green); color: #0a192f; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 10px; }
.wallet-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
.wallet-btn { padding: 15px; border-radius: 10px; border: none; font-weight: bold; cursor: pointer; }
.wallet-btn.deposit { background: var(--neon-green); color: #0a192f; }
.wallet-btn.withdraw { background: #222; color: white; border: 1px solid #444; }
.match-card { background: var(--bg-card); padding: 10px; margin-bottom: 8px; border-radius: 8px; font-size: 12px; display: flex; justify-content: space-between; border-left: 2px solid var(--neon-green); }

.modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 2000; justify-content: center; align-items: center; }
.modal-box { background: var(--bg-card); width: 85%; padding: 25px; border-radius: 12px; text-align: center; border: 1px solid var(--neon-green); }
.modal-actions { display: flex; gap: 10px; margin-top: 15px; }
.confirm-btn { flex: 1; background: var(--neon-green); border: none; padding: 12px; border-radius: 8px; font-weight: bold; color: #0a192f; }
.cancel-btn { flex: 1; background: transparent; border: 1px solid #ff5f56; color: #ff5f56; padding: 12px; border-radius: 8px; }

/* NAV */
.game-nav { position: fixed; bottom: 0; left: 0; width: 100%; background: var(--bg-card); border-top: 1px solid #222; display: flex; padding: 10px 0; z-index: 100; justify-content: space-around; }
.nav-btn { flex: 1; background: none; border: none; color: #8892b0; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10px; }
.nav-btn.active { color: var(--neon-green); }
.nav-btn i { font-size: 20px; }

.switch { position: relative; display: inline-block; width: 40px; height: 20px; } .switch input { opacity: 0; width: 0; height: 0; } .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .4s; border-radius: 20px; } input:checked + .slider { background-color: var(--neon-green); } input:checked + .slider:before { content: ""; position: absolute; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; transform: translateX(20px); } .small-input { width: 50px !important; padding: 5px !important; margin: 0 !important; text-align: center; font-weight: bold; }
