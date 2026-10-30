const socket = io();

// Simple UI caching
const viewHome = document.getElementById("home");
const viewLobby = document.getElementById("lobby");
const viewGame = document.getElementById("game");
const viewOver = document.getElementById("gameover");

let myCode = null;
let hostState = false;
let choiceVoted = false;

// Dynamic CSS Arcade Logo injection
const brandMark = document.querySelector(".brand-mark");
if (brandMark) {
  brandMark.innerHTML = "⚡ TRIVIA SHOCKWAVE ⚡";
  brandMark.style.fontSize = "1.5rem";
  brandMark.style.letterSpacing = "2px";
}

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
      li.className = "player";
      li.innerHTML = `<span>#${index + 1}</span> <strong>${p.nickname}</strong> <span>${p.score} pts</span>`;
      list.appendChild(li);
    });
    return;
  }

  // Lobby defaults logic
  document.getElementById("displayCode").textContent = room.code;
  document.getElementById("playerCount").textContent = room.players.length + " Players";
  
  let list = document.getElementById("players");
  list.innerHTML = "";
  room.players.forEach(p => {
    let li = document.createElement("li");
    li.className = "player";
    li.textContent = p.nickname + (p.id === room.hostId ? " [HOST]" : "") + (!p.connected ? " (OFFLINE)" : "");
    list.appendChild(li);
  });

  hostState = socket.id === room.hostId;
  document.getElementById("startBtn").classList.toggle("hidden", !hostState);
  document.getElementById("startBtn").disabled = room.players.length < 2;
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
