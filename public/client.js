// Force immediate local and production routing detection
const socket = io(window.location.origin);

const viewHome = document.getElementById("home");
const viewLobby = document.getElementById("lobby");
const viewGame = document.getElementById("game");
const viewOver = document.getElementById("gameover");
const connectionTag = document.getElementById("connection");

let myCode = null;
let hostState = false;
let choiceVoted = false;

// Instantly force state indicator status transitions
socket.on("connect", () => {
  connectionTag.textContent = "● ONLINE & READY";
  connectionTag.style.color = "#00f2fe";
});

socket.on("disconnect", () => {
  connectionTag.textContent = "● OFFLINE (RECONNECTING...)";
  connectionTag.style.color = "#ff4757";
});

// Use robust universal interaction handlers to avoid DOM initialization skips
document.body.addEventListener("click", (e) => {
  if (!e.target) return;

  if (e.target.id === "createBtn") {
    let name = document.getElementById("nickname").value.trim();
    if (name) {
      socket.emit("create_room", name);
    } else {
      alert("Please enter a nickname first!");
    }
  }

  if (e.target.id === "joinBtn") {
    let name = document.getElementById("nickname").value.trim();
    let code = document.getElementById("roomCode").value.trim();
    if (name && code) {
      socket.emit("join_room", { code, name });
    } else {
      alert("Please enter both a nickname and a valid room code!");
    }
  }

  if (e.target && e.target.closest("#startBtn")) {
  socket.emit("start_game");
}

  if (e.target.id === "copyBtn") {
    if (!myCode) return;
    
    // Universal fail-safe clipboard extraction handler
    const el = document.createElement('textarea');
    el.value = myCode;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    
    e.target.textContent = "COPIED! ✓";
    e.target.style.background = "#10ac84";
    setTimeout(() => { 
      e.target.textContent = "Copy Code"; 
      e.target.style.background = "#10ac84";
    }, 2000);
  }

  if (e.target.id === "leaveBtn") {
    window.location.reload();
  }
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
