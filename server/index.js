require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const PORT = 5001;

const rooms = {};
const versionHistory = {};

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (req, res) => {
  res.send("Collaborative Code Editor Server Running 🚀");
});


// ========================
// 🔥 JUDGE0 RUN ROUTE (DEBUG VERSION)
// ========================
app.post("/run", async (req, res) => {
    const { code , language, room, username } = req.body;

    if (!room) {
        return res.status(400).json({ output: "Room is missing" });
    }
//   console.log("🔥 /run route hit");
//   console.log("API KEY:", process.env.RAPIDAPI_KEY);

//   const { code, language } = req.body;

  const languageMap = {
    javascript: 63,
    python: 71,
    cpp: 54,
  };

//   if (!process.env.RAPIDAPI_KEY) {
//     return res.status(500).json({ output: "API Key Missing in .env" });
//   }

//   if (!languageMap[language]) {
//     return res.status(400).json({ output: "Unsupported language" });
//   }

  try {
    const response = await fetch(
      "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
        body: JSON.stringify({
          source_code: code,
          language_id: languageMap[language],
        }),
      }
    );

    const result = await response.json();

    // console.log("Judge0 Full Response:", result);

    // if (result.message) {
    //   return res.json({ output: result.message });
    // }

    const finalOutput =
        result.stdout ||
        result.stderr ||
        result.compile_output ||
        "No Output";

    console.log("Sending output to room:", room);

    // // send output to All user in that room
    // io.to(req.body.room).emit("receive_message", {
    //   output: finalOutput,
    //   rayBy: req.body.username,
    // });

    io.to(room).emit("receive_output", {
      output: finalOutput,
      ranBy: username,
    });

    res.json({ success: true });

  } catch (err) {
    console.error("RUN ERROR:", err);
    res.status(500).json({ output: "Execution error" });
  }
});


// ========================
// SOCKET.IO LOGIC
// ========================
io.on("connection", (socket) => {
  console.log("✅ User Connected:", socket.id);

  socket.on("join_room", ({ room, username }) => {
    socket.join(room);

    socket.data.room = room;
    socket.data.username = username;

    if (!rooms[room]) {
      rooms[room] = {
        users: [],
        host: socket.id,
        language: "javascript",
      };
    }

    rooms[room].users = rooms[room].users.filter(
      (user) => user.id !== socket.id
    );

    rooms[room].users.push({
      id: socket.id,
      username,
    });

    io.to(room).emit("room_data", {
      users: rooms[room].users,
      host: rooms[room].host,
      language: rooms[room].language,
    });

    io.to(room).emit("receive_message", {
      sender: "system",
      message: `🟢 ${username} joined the room`,
      time: new Date().toLocaleTimeString(),
    });

    if (versionHistory[room]) {
      socket.emit("update_versions", versionHistory[room]);
    }

    console.log(`📌 ${username} joined room ${room}`);
  });

  socket.on("change_language", ({ room, language }) => {
    if (!rooms[room]) return;

    if (socket.id === rooms[room].host) {
      rooms[room].language = language;
      io.to(room).emit("language_updated", language);
      console.log(`🌍 Language changed to ${language}`);
    }
  });

  socket.on("send_code", ({ room, code }) => {
    socket.to(room).emit("receive_code", code);
  });

  socket.on("send_message", ({ room, message }) => {
    io.to(room).emit("receive_message", {
      sender: socket.data.username,
      message,
      time: new Date().toLocaleTimeString(),
    });
  });

  socket.on("save_version", ({ room, code }) => {
    if (!versionHistory[room]) {
      versionHistory[room] = [];
    }

    const history = versionHistory[room];
    const lastVersion = history[history.length - 1];

    if (lastVersion && lastVersion.code === code) return;

    history.push({
      code,
      time: new Date().toLocaleTimeString(),
    });

    if (history.length > 10) {
      history.shift();
    }

    io.to(room).emit("update_versions", history);
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    const username = socket.data.username;

    if (!room || !rooms[room]) return;

    rooms[room].users = rooms[room].users.filter(
      (user) => user.id !== socket.id
    );

    if (
      socket.id === rooms[room].host &&
      rooms[room].users.length > 0
    ) {
      rooms[room].host = rooms[room].users[0].id;
      console.log("👑 Host transferred");
    }

    io.to(room).emit("room_data", {
      users: rooms[room].users,
      host: rooms[room].host,
      language: rooms[room].language,
    });

    if (username) {
      io.to(room).emit("receive_message", {
        sender: "system",
        message: `🔴 ${username} left the room`,
        time: new Date().toLocaleTimeString(),
      });
    }

    if (rooms[room].users.length === 0) {
      delete rooms[room];
      delete versionHistory[room];
    }

    console.log(`❌ ${username || socket.id} left room ${room}`);
  });
});

server.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});