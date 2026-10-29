const socket = io();

// UI Elements
const home = document.getElementById("home");
const lobby = document.getElementById("lobby");
const nicknameInput = document.getElementById("nickname");
const roomCodeInput = document.getElementById("roomCode");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const leaveBtn = document.getElementById("leaveBtn");
const copyBtn = document.getElementById("copyBtn");
const displayCode = document.getElementById("displayCode");
const playersList = document.getElementById("players");
const playerCount = document.getElementById("playerCount");
const hostMessage = document.getElementById("hostMessage");
const connection = document.getElementById("connection");
const message = document.getElementById("message");

// Gameplay & Leaderboard Elements
const gameScreen = document.getElementById("game");
const gameoverScreen = document.getElementById("gameover");
const timerDisplay = document.getElementById("timerDisplay");
const questionProgress = document.getElementById("questionProgress");
const questionText = document.getElementById("questionText");
const optionsContainer = document.getElementById("optionsContainer");
const leaderboardList = document.getElementById("leaderboardList");

let currentRoom = null;
let myNickname = "";
let isHost = false;
let messageTimer = null;
let hasVotedThisRound = false;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.remove("hidden", "error");
  if (isError) message.classList.add("error");
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => message.classList.add("hidden"), 4500);
}

function setBusy(busy) {
  createBtn.disabled = busy;
  joinBtn.disabled = busy;
}

function getNickname() {
  const nickname = nicknameInput.value.trim().replace(/\s+/g, " ");
  if (!nickname) {
    showMessage("Choose a nickname first.", true);
    nicknameInput.focus();
    return null;
  }
  if (nickname.length > 18) {
    showMessage("Nicknames must be 18 characters or fewer.", true);
    return null;
  }
  return nickname;
}

function enterLobby({ code, nickname, isHost: host }) {
  currentRoom = code;
  myNickname = nickname;
  isHost = host;
  displayCode.textContent = code;
  home.classList.add("hidden");
  lobby.classList.remove("hidden");
  startBtn.classList.toggle("hidden", !isHost);
  hostMessage.textContent = isHost
    ? "You're the host. Invite at least one friend, then start the game."
    : "You're in! Wait for the host to start the game.";
}

function renderRoom(room) {
  if (!currentRoom || room.code !== currentRoom) return;

  if (room.status === "playing") {
    home.classList.add("hidden");
    lobby.classList.add("hidden");
    gameoverScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    renderActiveQuestion(room);
    return;
  }

  if (room.status === "gameover") {
    home.classList.add("hidden");
    lobby.classList.add("hidden");
    gameScreen.classList.add("hidden");
    gameoverScreen.classList.remove("hidden");
    renderLeaderboard(room.players);
    return;
  }

  const players = room.players;
  playerCount.textContent = `${players.length} player${players.length === 1 ? "" : "s"}`;
  playersList.replaceChildren();

  for (const player of players) {
    const item = document.createElement("li");
    item.className = "player";
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = player.nickname.slice(0, 1).toUpperCase();
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = player.nickname;
    item.append(avatar, name);

    if (player.id === room.hostId) {
      const tag = document.createElement("span");
      tag.className = "host-tag";
      tag.textContent = "HOST";
      item.append(tag);
    }
    if (!player.connected) {
      const status = document.createElement("span");
      status.className = "host-tag";
      status.textContent = "OFFLINE";
      item.append(status);
    }
    playersList.append(item);
  }

  const amHost = socket.id === room.hostId;
  isHost = amHost;
  startBtn.classList.toggle("hidden", !amHost);
  startBtn.disabled = players.length < 2;
  hostMessage.textContent = amHost
    ? (players.length < 2 ? "Share the room code. You need at least one more player to start." : "Everyone's here? You're ready to start.")
    : "You're in! The host will start when everyone is ready.";
}

function renderActiveQuestion(room) {
  timerDisplay.textContent = `${room.timer}s`;
  questionProgress.textContent = `Question ${room.currentQuestionIndex + 1} of ${room.totalQuestions}`;
  
  if (!room.currentQuestion) return;
  questionText.textContent = room.currentQuestion.question;

  if (optionsContainer.children.length === 0) {
    hasVotedThisRound = false;
    room.currentQuestion.options.forEach((option, index) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;
      btn.style.transition = "all 0.2s ease";

      btn.addEventListener("click", () => {
        if (hasVotedThisRound) return;
        hasVotedThisRound = true;
        
        btn.style.backgroundColor = "#2f3542";
        btn.style.borderColor = "#3742fa";
        btn.style.color = "#ffffff";
        btn.style.boxShadow = "0 0 12px rgba(55, 66, 250, 0.4)";
        btn.classList.add("selected");
        
        disableOptionButtons();
        socket.emit("question:submit", { optionIndex: index });
      });
      optionsContainer.appendChild(btn);
    });
  }
}

function disableOptionButtons() {
  const buttons = optionsContainer.querySelectorAll(".option-btn");
  buttons.forEach(btn => btn.disabled = true);
}

function renderLeaderboard(players) {
  leaderboardList.replaceChildren();
  const sorted = [...players].sort((a, b) => b.score - a.score);
  
  sorted.forEach((player, index) => {
    const item = document.createElement("li");
    item.className = "player";
    item.innerHTML = `
      <span class="avatar">#${index + 1}</span>
      <span class="player-name">${player.nickname}</span>
      <span class="host-tag" style="background: #3742fa;">${player.score} pts</span>
    `;
    leaderboardList.appendChild(item);
  });
}

createBtn.addEventListener("click", () => {
  const nickname = getNickname();
  if (!nickname) return;
  setBusy(true);
  socket.emit("room:create", nickname);
});

joinBtn.addEventListener("click", () => {
  const nickname = getNickname();
  if (!nickname) return;
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!code) {
    showMessage("Enter the room code your host shared with you.", true);
    roomCodeInput.focus();
    return;
  }
  setBusy(true);
  socket.emit("room:join", { code, nickname });
});

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
});

nicknameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") createBtn.click();
});
roomCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinBtn.click();
});

startBtn.addEventListener("click", () => socket.emit("room:start"));

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentRoom);
    showMessage("Room code copied. Share it with your friends.");
  } catch {
    showMessage(`Your room code is ${currentRoom}. Copy it manually.`);
  }
});

leaveBtn.addEventListener("click", () => {
  window.location.reload();
});

socket.on("question:reveal", ({ correctIndex }) => {
  const buttons = optionsContainer.querySelectorAll(".option-btn");
  buttons.forEach((btn, index) => {
    btn.disabled = true;
    if (index === correctIndex) {
      btn.classList.add("correct");
    } else if (btn.classList.contains("selected")) {
      btn.classList.add("incorrect");
    }
  });

  setTimeout(() => {
    optionsContainer.replaceChildren();
  }, 3800);
});

socket.on("connect", () => {
  connection.classList.add("online");
  connection.textContent = "Connected";
  setBusy(false);
});
socket.on("disconnect", () => {
  connection.classList.remove("online");
  connection.textContent = "Reconnecting…";
  showMessage("Connection lost. Trying to reconnect…", true);
  setBusy(true);
});
socket.on("server:ready", () => setBusy(false));
socket.on("room:joined", (data) => {
  setBusy(false);
  enterLobby(data);
  showMessage(`Welcome, ${data.nickname}! Room ${data.code} is ready.`);
});
socket.on("room:update", renderRoom);
socket.on("app:error", (text) => {
  setBusy(false);
  showMessage(text, true);
});
socket.on("app:notice", showMessage);
