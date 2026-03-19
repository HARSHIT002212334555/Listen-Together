const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let access_token = "";

// 🔥 Room storage
let rooms = {};

app.use(express.static(__dirname));
app.use(express.json());

// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 🔹 CREATE ROOM (HOST)
  socket.on("create-room", () => {
    const roomId = uuidv4().slice(0, 6);

    rooms[roomId] = {
      host: socket.id,
      users: [],
    };

    socket.join(roomId);

    console.log("Room created:", roomId);

    socket.emit("room-created", roomId);
  });

  // 🔹 JOIN ROOM
  socket.on("join-room", (roomId) => {
    if (!rooms[roomId]) return;

    socket.join(roomId);
    rooms[roomId].users.push(socket.id);

    io.to(roomId).emit("users-update", rooms[roomId].users.length);
  });

  // 🔹 HOST CHECK
  function isHost(roomId) {
    return rooms[roomId]?.host === socket.id;
  }

  // 🔹 PLAY
  socket.on("play", ({ room, uri }) => {
    if (!isHost(room)) return;

    socket.to(room).emit("play", uri);
  });

  // 🔹 CONTROLS
  socket.on("next", (room) => {
    if (!isHost(room)) return;
    socket.to(room).emit("next");
  });

  socket.on("prev", (room) => {
    if (!isHost(room)) return;
    socket.to(room).emit("prev");
  });

  socket.on("pause", (room) => {
    if (!isHost(room)) return;
    socket.to(room).emit("pause");
  });
});

// ================= SPOTIFY =================
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  const client_id = process.env.CLIENT_ID;
  const client_secret = process.env.CLIENT_SECRET;

  const auth = Buffer.from(client_id + ":" + client_secret).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: "http://127.0.0.1:3000/callback",
    }),
  });

  const data = await response.json();
  access_token = data.access_token;

  res.redirect("/");
});

// 🔹 TOKEN
app.get("/token", (req, res) => {
  res.json({ access_token });
});

// 🔹 SEARCH
app.get("/search", async (req, res) => {
  const query = req.query.q;

  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`,
    {
      headers: { Authorization: "Bearer " + access_token },
    },
  );

  const data = await response.json();
  res.json(data);
});

// 🔹 RECOMMEND
app.get("/recommend", async (req, res) => {
  const seed = req.query.seed;

  const response = await fetch(
    `https://api.spotify.com/v1/recommendations?seed_tracks=${seed}&limit=10`,
    {
      headers: { Authorization: "Bearer " + access_token },
    },
  );

  const data = await response.json();
  res.json(data);
});

// ================= SERVER =================
server.listen(3000, () => {
  console.log("Server running on port 3000 🚀");
});
