const socket = io();

const viewHome = document.getElementById("home");
const viewLobby = document.getElementById("lobby");
const viewGame = document.getElementById("game");
const viewOver = document.getElementById("gameover");
const connectionTag = document.getElementById("connection");

let myCode = null;
let hostState = false;
let choiceVoted = false;

// Fix Connection Status Indicator text elements dynamically
socket.on("connect", () => {
  connectionTag.textContent = "● Online";
  connectionTag.style.color = "#10ac84";
});

socket.on("disconnect", () => {
  connectionTag.textContent = "● Offline (Reconnecting...)";
  connectionTag.style.color = "#ff4757";
});

document.getElementById("createBtn").addEventListener("click", () => {
  let name = document.getElementById("nickname").value.trim();
  if (name) socket.emit("create_room", name);
});

document.getElementById("joinBtn").addEventListener("click", () => {
  let name = document.getElementById("nickname").value.trim();
  let code = document.getElementById("roomCode").value.trim();
  if (name && code) socket.emit("join_room", { code, name });
});

document.getElementById("startBtn").addEventListener("click", () => {
  socket.emit("start_game");
});

// Fix Native Browser Copy Functionality
document.getElementById("copyBtn").addEventListener("click", () => {
  if (!myCode) return;
  navigator.clipboard.writeText(myCode).then(() => {
    let btn = document.getElementById("copyBtn");
    btn.textContent = "Copied! ✓";
    setTimeout(() => { btn.textContent = "Copy Code"; }, 2000);
  }).catch(() => {
    alert("Room Code: " + myCode);
  });
});

document.getElementById("leaveBtn").addEventListener("click", () => {
  window.location.reload();
});

function displayRoomState(room) {
  if (room.status === "playing") {
    viewHome.classList.add("hidden");
    viewLobby.classList.add("hidden");
    viewOver.classList.add("hidden");
    viewGame.classList.remove("hidden");
    
    document.getElementById("timerDisplay").textContent = room.timer + "s";
    document.getElementById("questionProgress").textContent = `ROUND ${room.currentIndex + 1} / 10`;
    
    if (room.activeQuestion) {
      document.getElementById("questionText").textContent = room.activeQuestion.question;
      let container = document.getElementById("optionsContainer");
      
      if (container.children.length === 0) {
        choiceVoted = false;
        room.activeQuestion.choices.forEach((choice, idx) => {
          let btn = document.createElement("button");
          btn.className = "option-btn";
          btn.textContent = choice;
          btn.addEventListener("click", () => {
            if (choiceVoted) return;
            choiceVoted = true;
            btn.classList.add("selected");
            
            container.querySelectorAll(".option-btn").forEach(b => b.disabled = true);
            socket.emit("submit_choice", { choiceIndex: idx });
          });
          container.appendChild(btn);
        });
      }
    }
    return;
  }

  if (room.status === "gameover") {
    viewHome.classList.add("hidden");
    viewLobby.classList.add("hidden");
    viewGame.classList.add("hidden");
    viewOver.classList.remove("hidden");
    
    let list = document.getElementById("leaderboardList");
    list.innerHTML = "";
    let ordered = [...room.players].sort((a, b) => b.score - a.score);
    ordered.forEach((p, index) => {
      let li = document.createElement("li");
      li.className = "player-row";
      li.innerHTML = `<span>#${index + 1} ${p.nickname}</span> <strong>${p.score} pts</strong>`;
      list.appendChild(li);
    });
    return;
  }

  // Handle Waiting Room UI Updates
  document.getElementById("displayCode").textContent = room.code;
  document.getElementById("playerCount").textContent = room.players.length + " Players";
  
  let list = document.getElementById("players");
  list.innerHTML = "";
  room.players.forEach(p => {
    let li = document.createElement("li");
    li.className = "player-row";
    li.innerHTML = `<span>👤 ${p.nickname}</span> ${p.id === room.hostId ? '<span class="badge host">HOST</span>' : ''} ${!p.connected ? '<span class="badge offline">OFFLINE</span>' : ''}`;
    list.appendChild(li);
  });

  hostState = socket.id === room.hostId;
  document.getElementById("startBtn").classList.toggle("hidden", !hostState);
  document.getElementById("startBtn").disabled = room.players.length < 2;
  
  document.getElementById("hostMessage").textContent = hostState
    ? (room.players.length < 2 ? "Waiting for players to join..." : "Roster verified. Ready to initiate match.")
    : "Waiting for host to start the game match loops...";
}

socket.on("joined_ok", (data) => {
  myCode = data.code;
  viewHome.classList.add("hidden");
  viewLobby.classList.remove("hidden");
});

socket.on("room_change", displayRoomState);

socket.on("reveal_answer", ({ correctIndex }) => {
  let container = document.getElementById("optionsContainer");
  let buttons = container.querySelectorAll(".option-btn");
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === correctIndex) {
      btn.classList.add("correct");
    } else if (btn.classList.contains("selected")) {
      btn.classList.add("incorrect");
    }
  });
  setTimeout(() => { container.innerHTML = ""; }, 3800);
});

socket.on("err_msg", (msg) => alert(msg));
