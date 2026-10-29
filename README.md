# Trivia Showdown — Stage 1

Stage 1 implements room creation and joining, a live lobby, host transfer on disconnect, nickname checks, and Socket.IO communication. Trivia gameplay is not implemented yet.

## Requirements

- Node.js 20 or newer recommended
- Internet connection for the first dependency installation

## Run locally

1. Install Node.js from https://nodejs.org if it is not installed.
2. Extract this project folder.
3. Open a terminal in the `trivia_showdown_stage1` folder.
4. Run `npm install`.
5. Run `npm start`.
6. Open http://localhost:3000 in your browser.

## Test the lobby

1. Open http://localhost:3000 in one browser window.
2. Enter a nickname and select **Create game**.
3. Open a private/incognito window or a second browser and visit the same address.
4. Enter a different nickname and the room code, then select **Join game**.
5. Confirm both browser windows show both players.
6. Try a wrong room code and a duplicate nickname to verify error messages.
7. Close the host window and confirm host status transfers to the remaining connected player.

The **Start game** button currently verifies that the room has at least two players and that the host is the one requesting the start. It displays a Stage 2 notice instead of starting trivia.

## Deployment note

This app serves the browser interface and Socket.IO server from one Node.js service. For Render, create a Web Service connected to a Git repository, use `npm install` as the build command and `npm start` as the start command. The server reads the port from `process.env.PORT`.

Rooms are stored in memory and disappear when the server restarts. The first version is intended for a prototype, not persistent or high-availability gameplay.
