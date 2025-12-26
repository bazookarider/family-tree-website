:root {
    --bg-dark: #0a192f;
    --bg-card: #112240;
    --text-main: #ccd6f6;
    --neon-green: #64ffda;
    --neon-red: #ff5f56;
    --purple: #bd34fe;
}

body {
    background-color: var(--bg-dark);
    color: var(--text-main);
    font-family: 'Segoe UI', Roboto, sans-serif;
    margin: 0; padding: 0; overflow-x: hidden;
}

.screen { display: none; padding: 20px; min-height: 100vh; box-sizing: border-box; }
.screen.active { display: block; }
.hidden { display: none !important; }

/* Auth Forms */
#login-form, #register-form { max-width: 320px; margin: 0 auto; background: var(--bg-card); padding: 25px; border-radius: 15px; border: 1px solid #233554; }
input { width: 100%; padding: 12px; margin-bottom: 15px; background: #020c1b; border: 1px solid #233554; color: white; border-radius: 8px; box-sizing: border-box; }

/* Header */
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
.balance-area h2 { margin: 0; color: var(--neon-green); font-size: 26px; }

/* Nav */
.game-nav { display: flex; background: var(--bg-card); padding: 5px; border-radius: 15px; margin-bottom: 20px; }
.nav-btn { flex: 1; background: none; border: none; color: #8892b0; padding: 12px; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 12px; }
.nav-btn.active { background: var(--neon-green); color: var(--bg-dark); }
.nav-btn i { font-size: 18px; }

/* Buttons */
.neon-btn { width: 100%; padding: 15px; background: transparent; border: 1px solid var(--neon-green); color: var(--neon-green); font-weight: bold; cursor: pointer; border-radius: 8px; font-size: 16px; margin-bottom: 10px; }
.neon-btn.large { background: var(--neon-green); color: var(--bg-dark); margin-top: 15px; }

/* Aviator */
.round-history-bar { display: flex; gap: 5px; overflow-x: auto; padding: 5px 0; margin-bottom: 15px; }
.history-pill { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; background: #233554; white-space: nowrap; }
.history-pill.purple { color: var(--purple); border: 1px solid var(--purple); }
.history-pill.blue { color: #00baff; border: 1px solid #00baff; }
.history-pill.red { color: var(--neon-red); border: 1px solid var(--neon-red); }

.game-stage-pro { height: 220px; background: #020c1b; border-radius: 15px; margin-bottom: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #233554; }
#multiplier-display { font-size: 56px; font-weight: 800; color: white; }

.aviator-controls { background: var(--bg-card); padding: 15px; border-radius: 15px; }
.quick-chips { display: flex; gap: 8px; margin-bottom: 15px; }
.quick-chips button { flex: 1; background: #020c1b; border: 1px solid var(--neon-green); color: var(--neon-green); padding: 8px; border-radius: 20px; cursor: pointer; }

.input-group-row { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
.input-group-row input { text-align: center; font-size: 18px; }
.adjust-btn { width: 45px; height: 45px; background: #233554; color: white; border: none; border-radius: 8px; font-size: 20px; font-weight: bold; }

/* Sports */
.match-card { background: var(--bg-card); padding: 15px; margin-bottom: 12px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--neon-green); }
.live-badge { background: var(--neon-red); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
.time-badge { background: #233554; color: #ccc; padding: 2px 6px; border-radius: 4px; font-size: 10px; }

/* Profile & Wallet */
.profile-card { text-align: center; margin-bottom: 20px; background: var(--bg-card); padding: 20px; border-radius: 10px; }
.avatar { width: 60px; height: 60px; background: var(--neon-green); color: var(--bg-dark); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 10px; }
.wallet-actions { display: flex; gap: 10px; margin-bottom: 20px; }
.action-btn { width: 100%; padding: 15px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
.deposit { background: var(--neon-green); color: var(--bg-dark); }
.withdraw { background: #233554; color: white; border: 1px solid #444; }
.whatsapp-btn { display: flex; align-items: center; justify-content: center; gap: 10px; background: #25D366; color: white; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-bottom: 20px; }
.logout-btn { background: var(--neon-red); color: white; margin-top: 20px; }

/* Modals */
.modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 9999; justify-content: center; align-items: center; }
.modal-box { background: var(--bg-card); padding: 25px; border-radius: 15px; width: 85%; max-width: 320px; text-align: center; border: 1px solid var(--neon-green); }
.modal-actions { display: flex; gap: 10px; }
.confirm-btn { flex: 1; background: var(--neon-green); border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; color: var(--bg-dark); }
.cancel-btn { flex: 1; background: transparent; border: 1px solid #ff5f56; color: #ff5f56; padding: 12px; border-radius: 8px; cursor: pointer; }

/* Switch */
.switch { position: relative; display: inline-block; width: 40px; height: 20px; vertical-align: middle; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 20px; }
.slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .slider { background-color: var(--neon-green); }
input:checked + .slider:before { transform: translateX(20px); }
.small-input { width: 50px !important; padding: 5px !important; margin: 0 5px !important; }
