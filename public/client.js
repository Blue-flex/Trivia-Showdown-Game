const socket = io(window.location.origin);

const viewHome = document.getElementById("home");
const viewLobby = document.getElementById("lobby");
const viewGame = document.getElementById("game");
const viewOver = document.getElementById("gameover");
const connectionTag = document.getElementById("connection");

let myCode = null;
let hostState = false;
let choiceVoted = false;

socket.on("connect", () => {
  connectionTag.textContent = "● ONLINE & READY";
  connectionTag.style.color = "#00f2fe";
});

socket.on("disconnect", () => {
  connectionTag.textContent = "● OFFLINE (RECONNECTING...)";
  connectionTag.style.color = "#ff4757";
});

document.body.addEventListener("click", (e) => {
  if (!e.target) return;

  if (e.target.id === "createBtn") {
    let name = document.getElementById("nickname").value.trim();
    if (name) socket.emit("create_room", name);
    else alert("Please enter a nickname first!");
  }

  if (e.target.id === "joinBtn") {
    let name = document.getElementById("nickname").value.trim();
    let code = document.getElementById("roomCode").value.trim();
    if (name && code) socket.emit("join_room", { code, name });
    else alert("Please fill out both the nickname and code fields!");
  }

  if (e.target.id === "startBtn") {
    socket.emit("start_game");
  }

  if (e.target.id === "copyBtn") {
    if (!myCode) return;
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
          btn.textContent = choice; // Securely binds text value safely
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
      
      // Enforce absolute anti-injection rendering boundaries via node text injection elements
      let nameSpan = document.createElement("span");
      nameSpan.textContent = `#${index + 1} ${p.nickname}`;
      
      let scoreStrong = document.createElement("strong");
      scoreStrong.textContent = `${p.score} pts`;
      
      li.appendChild(nameSpan);
      li.appendChild(scoreStrong);
      list.appendChild(li);
    });
    return;
  }

  // Lobby defaults logic block
  document.getElementById("displayCode").textContent = room.code;
  
  // Exclude disconnected users when rendering connected count limits
  let activeUsersCount = room.players.filter(p => p.connected).length;
  document.getElementById("playerCount").textContent = `${activeUsersCount} Online`;
  
  let list = document.getElementById("players");
  list.innerHTML = "";
  
  room.players.forEach(p => {
    let li = document.createElement("li");
    li.className = "player-row";
    
    let wrapperSpan = document.createElement("span");
    wrapperSpan.textContent = `👤 ${p.nickname}`;
    li.appendChild(wrapperSpan);

    if (p.id === room.hostId) {
      let hostBadge = document.createElement("span");
      hostBadge.className = "badge host";
      hostBadge.textContent = "HOST";
      li.appendChild(hostBadge);
    }
    if (!p.connected) {
      let offlineBadge = document.createElement("span");
      offlineBadge.className = "badge offline";
      offlineBadge.textContent = "OFFLINE";
      li.appendChild(offlineBadge);
    }
    list.appendChild(li);
  });

  hostState = socket.id === room.hostId;
  document.getElementById("startBtn").classList.toggle("hidden", !hostState);
  
  // Base check: require at least 2 online/active users to open match pathway
  document.getElementById("startBtn").disabled = activeUsersCount < 2;
  
  document.getElementById("hostMessage").textContent = hostState
    ? (activeUsersCount < 2 ? "Waiting for players to log in online..." : "Roster verified. Ready to initiate match.")
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
