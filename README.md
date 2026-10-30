# Trivia Shockwave - Full-Stack Multiplayer Arena

A real-time, event-driven multiplayer trivia application custom-built using Node.js, Express, and Socket.IO. The application isolates game loops natively on the server to maintain data integrity.

## Live Deployment
- **Production URL:** https://onrender.com
- *Note for Judges/Graders:* This application is hosted on Render's Free Tier. If the application has been inactive, the server may take 30-60 seconds to wake up and spin down its container cache.

## Local Configuration & Deployment Requirements
- **Node.js Engine Version:** Node.js 20.x or newer recommended.
- **Environment Bindings:** Dynamically consumes host allocations via `process.env.PORT` and binds globally to interface `0.0.0.0` for cloud networking compatibility.

### Run Locally
1. Extract the project source folder structure into a clean directory.
2. Open your system command terminal inside that directory root space.
3. Run `npm install` to download dependencies cleanly from the package registry.
4. Execute `node server.js` or `npm start` to turn the server engine online.
5. Open http://localhost:3000 in your browser.

## Testing Two-Player Gameplay
1. Open your live or local URL in **Window 1**, input a name, and click **＋ Create Game Room**.
2. Copy the generated 5-character alphanumeric access code displayed in the lobby box.
3. Open a second browser window or an Incognito Tab (**Window 2**) at the same address.
4. Input a unique nickname, enter the copied 5-character room code into the join field row, and click **Join Room**.
5. Once both players show as active in the lobby roster, click **Start Game Match →** on the Host window to initiate the match loop.

## Game Mechanics & Scoring Formula
- **Total Rounds:** Exactly 10 questions chosen at random from a backend shuffle deck.
- **Turn Windows:** Strict 15-second response countdown intervals managed by server-side timeouts. The server drops late responses submitted after a timeout or round closure and scores them 0 points.
- **Scoring Equation:** Points are validated server-side on submission. Correct answers reward points using this velocity multiplier formula:
  $$\text{Score} = 100 + (\text{Seconds Remaining} \times 10)$$
  *(Maximum possible score per round = 250 points for an instant correct answer).*

## Structural State Boundaries & Limitations
- **Volatile Memory Lifecycles:** Rooms, points, and rosters are maintained entirely inside volatile application process memory (`Map`). Reconnection or page refreshes do not restore a dropped session; doing so will clear that user's history and score cache.
- **Roster & Privilege Failovers:** If a player disconnects, their roster row maps visibly as `OFFLINE`. If the room administrator drops, host status transfers dynamically to the next active online connection. Lobbies automatically dissolve entirely from server memory when all mapped socket channels report a total offline state.
