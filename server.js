const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const triviaDeck = [
  { question: "What is the largest ocean on Earth?", choices: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: "Pacific" },
  { question: "How many hearts does an octopus have?", choices: ["1", "2", "3", "4"], correct: "3" },
  { question: "Which country has the most time zones, including its overseas territories?", choices: ["France", "Russia", "United States", "United Kingdom"], correct: "France" },
  { question: "What is the chemical symbol for gold?", choices: ["Go", "Au", "Gd", "Ag"], correct: "Au" },
  { question: "Which is the only mammal capable of true flight?", choices: ["Flying squirrel", "Sugar glider", "Bat", "Colugo"], correct: "Bat" },
  { question: "What is the hottest planet in our solar system?", choices: ["Venus", "Mercury", "Mars", "Jupiter"], correct: "Venus" },
  { question: "What is the capital of Australia?", choices: ["Sydney", "Melbourne", "Perth", "Canberra"], correct: "Canberra" },
  { question: "How many bones are in the adult human body?", choices: ["186", "206", "226", "256"], correct: "206" },
  { question: "Which food never spoils if stored properly?", choices: ["Rice", "Peanut butter", "Honey", "Dark chocolate"], correct: "Honey" },
  { question: "Who painted the Mona Lisa?", choices: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Vincent van Gogh"], correct: "Leonardo da Vinci" },
  { question: "What is the smallest country in the world by area?", choices: ["Monaco", "San Marino", "Liechtenstein", "Vatican City"], correct: "Vatican City" },
  { question: "In what year did humans first land on the Moon?", choices: ["1965", "1969", "1972", "1975"], correct: "1969" },
  { question: "Which language has the most native speakers worldwide?", choices: ["English", "Spanish", "Mandarin Chinese", "Hindi"], correct: "Mandarin Chinese" },
  { question: "What is the hardest natural substance on Earth?", choices: ["Diamond", "Quartz", "Titanium", "Granite"], correct: "Diamond" },
  { question: "Which gas do plants absorb from the air for photosynthesis?", options: ["Oxygen", "Nitrogen", "Hydrogen", "Carbon dioxide"], correct: "Carbon dioxide" }
];

app.use(express.static(path.join(__dirname, "public")));

function shuffleQuestions() {
  let shuffled = triviaDeck.map(item => {
    let opts = [...item.choices];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return {
      question: item.question,
      choices: opts,
      ansIndex: opts.indexOf(item.correct)
    };
  });
  return shuffled.sort(() => Math.random() - 0.5).slice(0, 10);
}

function getRoomPayload(room) {
  let activeQuestion = null;
  if (room.status === "playing" && room.deck[room.currentIndex]) {
    let q = room.deck[room.currentIndex];
    activeQuestion = { question: q.question, choices: q.choices };
  }

  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    currentIndex: room.currentIndex,
    totalQuestions: 10,
    activeQuestion,
    timer: room.timer,
    players: [...room.players.values()].map(p => ({
      id: p.id,
      nickname: p.nickname,
      connected: p.connected,
      score: p.score,
      done: p.done
    }))
  };
}

function updateRoom(code) {
  let room = rooms.get(code);
  if (room) io.to(code).emit("room_change", getRoomPayload(room));
}

function finishRound(room) {
  if (room.clock) clearInterval(room.clock);
  
  let currentAns = room.deck[room.currentIndex].ansIndex;
  io.to(room.code).emit("reveal_answer", { correctIndex: currentAns });

  setTimeout(() => {
    room.currentIndex++;
    room.players.forEach(p => p.done = false);

    if (room.currentIndex < 10) {
      runTimer(room);
    } else {
      room.status = "gameover";
      updateRoom(room.code);
    }
  }, 4000);
}

function runTimer(room) {
  room.timer = 15;
  updateRoom(room.code);
  if (room.clock) clearInterval(room.clock);

  room.clock = setInterval(() => {
    room.timer--;
    if (room.timer <= 0) {
      clearInterval(room.clock);
      finishRound(room);
    } else {
      updateRoom(room.code);
    }
  }, 1000);
}

io.on("connection", (socket) => {
  socket.on("create_room", (name) => {
    let code = Math.random().toString(36).substring(2, 7).toUpperCase();
    let room = {
      code,
      hostId: socket.id,
      status: "lobby",
      players: new Map(),
      deck: [],
      currentIndex: 0,
      timer: 15,
      clock: null
    };
    room.players.set(socket.id, { id: socket.id, nickname: name, connected: true, score: 0, done: false });
    rooms.set(code, room);
    
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit("joined_ok", { code, nickname: name, isHost: true });
    updateRoom(code);
  });

  socket.on("join_room", ({ code, name }) => {
    let target = code.trim().toUpperCase();
    let room = rooms.get(target);
    
    if (!room || room.status !== "lobby" || room.players.size >= 12) {
      return socket.emit("err_msg", "Cannot join room. Check code.");
    }

    room.players.set(socket.id, { id: socket.id, nickname: name, connected: true, score: 0, done: false });
    socket.join(target);
    socket.data.roomCode = target;
    socket.emit("joined_ok", { code: target, nickname: name, isHost: false });
    updateRoom(target);
  });

  socket.on("start_game", () => {
    let room = rooms.get(socket.data.roomCode);
    if (room && socket.id === room.hostId && room.players.size >= 2) {
      room.deck = shuffleQuestions();
      room.status = "playing";
      room.currentIndex = 0;
      runTimer(room);
    }
  });

  socket.on("submit_choice", ({ choiceIndex }) => {
    let room = rooms.get(socket.data.roomCode);
    if (!room || room.status !== "playing") return;

    let p = room.players.get(socket.id);
    if (!p || p.done) return;

    p.done = true;
    if (choiceIndex === room.deck[room.currentIndex].ansIndex) {
      p.score += 100 + (room.timer * 10);
    }

    let active = [...room.players.values()].filter(player => player.connected);
    if (active.every(player => player.done)) {
      finishRound(room);
    } else {
      updateRoom(room.code);
    }
  });

  socket.on("disconnect", () => {
    let room = rooms.get(socket.data.roomCode);
    if (!room) return;

    let p = room.players.get(socket.id);
    if (p) p.connected = false;

    if (room.hostId === socket.id) {
      let nextHost = [...room.players.values()].find(player => player.connected);
      if (nextHost) room.hostId = nextHost.id;
    }

    if (![...room.players.values()].some(player => player.connected)) {
      if (room.clock) clearInterval(room.clock);
      rooms.delete(room.code);
    } else {
      updateRoom(room.code);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server live on port ${PORT}`);
});
