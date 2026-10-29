const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const NICKNAME_MAX = 18;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// 1. BASE QUESTIONS DATA SET (15 QUESTIONS)
const BASE_QUESTIONS = [
  { question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctAnswer: "Pacific" },
  { question: "How many hearts does an octopus have?", options: ["1", "2", "3", "4"], correctAnswer: "3" },
  { question: "Which country has the most time zones, including its overseas territories?", options: ["France", "Russia", "United States", "United Kingdom"], correctAnswer: "France" },
  { question: "What is the chemical symbol for gold?", options: ["Go", "Au", "Gd", "Ag"], correctAnswer: "Au" },
  { question: "Which is the only mammal capable of true flight?", options: ["Flying squirrel", "Sugar glider", "Bat", "Colugo"], correctAnswer: "Bat" },
  { question: "What is the hottest planet in our solar system?", options: ["Venus", "Mercury", "Mars", "Jupiter"], correctAnswer: "Venus" },
  { question: "What is the capital of Australia?", options: ["Sydney", "Melbourne", "Perth", "Canberra"], correctAnswer: "Canberra" },
  { question: "How many bones are in the adult human body?", options: ["186", "206", "226", "256"], correctAnswer: "206" },
  { question: "Which food never spoils if stored properly?", options: ["Rice", "Peanut butter", "Honey", "Dark chocolate"], correctAnswer: "Honey" },
  { question: "Who painted the Mona Lisa?", options: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Vincent van Gogh"], correctAnswer: "Leonardo da Vinci" },
  { question: "What is the smallest country in the world by area?", options: ["Monaco", "San Marino", "Liechtenstein", "Vatican City"], correctAnswer: "Vatican City" },
  { question: "In what year did humans first land on the Moon?", options: ["1965", "1969", "1972", "1975"], correctAnswer: "1969" },
  { question: "Which language has the most native speakers worldwide?", options: ["English", "Spanish", "Mandarin Chinese", "Hindi"], correctAnswer: "Mandarin Chinese" },
  { question: "What is the hardest natural substance on Earth?", options: ["Diamond", "Quartz", "Titanium", "Granite"], correctAnswer: "Diamond" },
  { question: "Which gas do plants absorb from the air for photosynthesis?", options: ["Oxygen", "Nitrogen", "Hydrogen", "Carbon dioxide"], correctAnswer: "Carbon dioxide" }
];

const QUESTION_DURATION = 15; // 15-second countdown timer

// 2. HELPER FUNCTIONS
function generateShuffledQuestions() {
  return BASE_QUESTIONS.map(q => {
    let options = [...q.options];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    const newAnswerIndex = options.indexOf(q.correctAnswer);
    return {
      question: q.question,
      options: options,
      answer: newAnswerIndex
    };
  });
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "Trivia Showdown" });
});

function makeRoomCode() {
  let code;
  do { code = Array.from({ length: 5 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join(""); } while (rooms.has(code));
  return code;
}

function cleanNickname(value) {
  return String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, NICKNAME_MAX);
}

function publicRoom(room) {
  const deck = room.questionsDeck || [];
  const currentQuestion = room.status === "playing" && deck[room.currentQuestionIndex] 
    ? { question: deck[room.currentQuestionIndex].question, options: deck[room.currentQuestionIndex].options } 
    : null;

  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: deck.length || BASE_QUESTIONS.length,
    currentQuestion,
    timer: room.timer,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      connected: p.connected,
      score: p.score,
      answered: p.hasAnswered
    }))
  };
}

function sendRoomUpdate(room) {
  io.to(room.code).emit("room:update", publicRoom(room));
}

function sendError(socket, message) {
  socket.emit("app:error", message);
}

function startCountdown(room) {
  room.timer = QUESTION_DURATION;
  sendRoomUpdate(room);

  if (room.timerInterval) clearInterval(room.timerInterval);

  room.timerInterval = setInterval(() => {
    room.timer--;
    if (room.timer <= 0) {
      clearInterval(room.timerInterval);
      evaluateRoundAnswers(room);
    } else {
      sendRoomUpdate(room);
    }
  }, 1000);
}

function evaluateRoundAnswers(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  
  const deck = room.questionsDeck;
  const correctAnswerIndex = deck[room.currentQuestionIndex].answer;
  io.to(room.code).emit("question:reveal", { correctIndex: correctAnswerIndex });

  setTimeout(() => {
    room.currentQuestionIndex++;
    for (let player of room.players.values()) {
      player.hasAnswered = false;
    }

    if (room.currentQuestionIndex < deck.length) {
      startCountdown(room);
    } else {
      room.status = "gameover";
      sendRoomUpdate(room);
    }
  }, 4000);
}

// 3. SOCKET CONNECTION ARENA FLOW
io.on("connection", (socket) => {
  socket.emit("server:ready", { message: "Connected to Trivia Showdown." });

  socket.on("room:create", (rawNickname) => {
    const nickname = cleanNickname(rawNickname);
    if (!nickname) return sendError(socket, "Enter a nickname before creating a game.");

    const code = makeRoomCode();
    const room = {
      code,
      hostId: socket.id,
      status: "lobby",
      players: new Map(),
      questionsDeck: [],
      currentQuestionIndex: 0,
      timer: QUESTION_DURATION,
      timerInterval: null,
      createdAt: Date.now()
    };
    room.players.set(socket.id, { id: socket.id, nickname, connected: true, score: 0, hasAnswered: false });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit("room:joined", { code, nickname, isHost: true });
    sendRoomUpdate(room);
  });

  socket.on("room:join", ({ code: rawCode, nickname: rawNickname } = {}) => {
    const code = String(rawCode || "").trim().toUpperCase();
    const nickname = cleanNickname(rawNickname);

    if (!/^[A-HJ-NP-Z2-9]{5}$/.test(code)) return sendError(socket, "Enter a valid five-character room code.");
    if (!nickname) return sendError(socket, "Enter a nickname to join.");
    
    const room = rooms.get(code);
    if (!room) return sendError(socket, "That room doesn't exist. Check the code and try again.");
    if (room.status !== "lobby") return sendError(socket, "That game has already started.");
    
    const duplicate = [...room.players.values()].some((p) => p.nickname.toLowerCase() === nickname.toLowerCase() && p.connected);
    if (duplicate) return sendError(socket, "That nickname is already in use in this room.");
    if (room.players.size >= 12) return sendError(socket, "This room is full (12 players maximum).");

    room.players.set(socket.id, { id: socket.id, nickname, connected: true, score: 0, hasAnswered: false });
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit("room:joined", { code, nickname, isHost: false });
    sendRoomUpdate(room);
  });

  socket.on("room:start", () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return sendError(socket, "Your room is no longer available.");
    if (socket.id !== room.hostId) return sendError(socket, "Only the host can start the game.");
    if (room.status !== "lobby") return sendError(socket, "This game has already started.");
    if (room.players.size < 2) return sendError(socket, "Invite at least one more player before starting.");

    room.questionsDeck = generateShuffledQuestions(); 
    room.status = "playing";
    room.currentQuestionIndex = 0;
    startCountdown(room);
  });

  socket.on("question:submit", ({ optionIndex }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.status !== "playing") return;

    const player = room.players.get(socket.id);
    if (!player || player.hasAnswered) return;

    player.hasAnswered = true;
    const currentQuestion = room.questionsDeck[room.currentQuestionIndex];

    if (optionIndex === currentQuestion.answer) {
      player.score += 100 + (room.timer * 10); 
    }

    const activePlayers = [...room.players.values()].filter(p => p.connected);
    const totalAnswered = activePlayers.filter(p => p.hasAnswered).length;
    
    if (totalAnswered >= activePlayers.length) {
      evaluateRoundAnswers(room);
    } else {
      sendRoomUpdate(room);
    }
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) player.connected = false;

    if (room.hostId === socket.id) {
      const next = [...room.players.values()].find((p) => p.connected);
      if (next) room.hostId = next.id;
    }

    if (![...room.players.values()].some((p) => p.connected)) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      rooms.delete(code);
    } else {
      sendRoomUpdate(room);
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Trivia Showdown is running at http://localhost:${PORT}`);
});

