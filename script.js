let token = "";
let deviceId = null;
let player;
let room = "";
let isHost = false;

const socket = io();

// 🔹 CREATE ROOM
function createRoom() {
  socket.emit("create-room");
}

socket.on("room-created", (roomId) => {
  room = roomId;
  isHost = true;

  alert("Room ID: " + roomId + " (You are HOST)");
});

// 🔹 JOIN ROOM
function joinRoom() {
  room = document.getElementById("room").value;
  socket.emit("join-room", room);
}

// 🔹 USERS COUNT
socket.on("users-update", (count) => {
  document.getElementById("users").innerText = "Users: " + count;
});

// 🔹 LOGIN
function spotifyLogin() {
  const clientId = "8d9d252b4cf7445f84a887354176f3ad";
  const redirectUri = "http://127.0.0.1:3000/callback";

  const scope =
    "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state";

  window.location =
    "https://accounts.spotify.com/authorize?response_type=code" +
    "&client_id=" +
    clientId +
    "&scope=" +
    encodeURIComponent(scope) +
    "&redirect_uri=" +
    encodeURIComponent(redirectUri);
}

// 🔹 TOKEN
async function getToken() {
  const res = await fetch("/token");
  const data = await res.json();

  token = data.access_token;
  initPlayer();
}

// 🔹 PLAYER
function initPlayer() {
  if (!window.Spotify) return setTimeout(initPlayer, 500);

  player = new Spotify.Player({
    name: "Listen Together",
    getOAuthToken: (cb) => cb(token),
  });

  player.addListener("ready", ({ device_id }) => {
    deviceId = device_id;
    transferPlayback();
  });

  player.connect();
}

// 🔹 ACTIVATE DEVICE
async function transferPlayback() {
  await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: true,
    }),
  });
}

// 🔹 SEARCH
async function searchSong() {
  const query = document.getElementById("searchInput").value;
  const res = await fetch(`/search?q=${query}`);
  const data = await res.json();

  const results = document.getElementById("results");
  results.innerHTML = "";

  data.tracks.items.forEach((track) => {
    const div = document.createElement("div");
    div.classList.add("song-card");

    div.innerHTML = `
      <img src="${track.album.images[0].url}" />
      <h4>${track.name}</h4>
      <p>${track.artists[0].name}</p>
      <button onclick="playSong('${track.uri}')">Play</button>
    `;

    results.appendChild(div);
  });
}

// 🔹 PLAY
async function playSong(uri) {
  if (!isHost) return alert("Only host can control");

  await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [uri] }),
    },
  );

  socket.emit("play", { room, uri });
}

// 🔹 CONTROLS
function nextSong() {
  if (!isHost) return;

  fetch("https://api.spotify.com/v1/me/player/next", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
  });

  socket.emit("next", room);
}

function prevSong() {
  if (!isHost) return;

  fetch("https://api.spotify.com/v1/me/player/previous", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
  });

  socket.emit("prev", room);
}

function pauseSong() {
  if (!isHost) return;

  fetch("https://api.spotify.com/v1/me/player/pause", {
    method: "PUT",
    headers: { Authorization: "Bearer " + token },
  });

  socket.emit("pause", room);
}

// 🔹 SYNC
socket.on("play", (uri) => {
  fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: [uri] }),
  });
});

socket.on("next", () => {
  fetch("https://api.spotify.com/v1/me/player/next", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
  });
});

socket.on("prev", () => {
  fetch("https://api.spotify.com/v1/me/player/previous", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
  });
});

socket.on("pause", () => {
  fetch("https://api.spotify.com/v1/me/player/pause", {
    method: "PUT",
    headers: { Authorization: "Bearer " + token },
  });
});

document.addEventListener("DOMContentLoaded", getToken);
