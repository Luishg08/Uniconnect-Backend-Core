const { io } = require("socket.io-client");

const URL = process.env.WS_URL || "http://localhost:8007";
const ID_USER = Number(process.env.ID_USER || 1);
const ID_MEMBERSHIP = Number(process.env.ID_MEMBERSHIP || 1);
const ID_GROUP = Number(process.env.ID_GROUP || 1);

const socket = io(URL, { transports: ["websocket"] });

function log(event, data) {
  console.log(`[${new Date().toISOString()}] ${event}`, data ?? "");
}

socket.on("connect", () => {
  log("connect", socket.id);

  socket.emit("authenticate", {
    id_user: ID_USER,
    id_membership: ID_MEMBERSHIP,
    id_group: ID_GROUP,
  });

  setTimeout(() => {
    socket.emit(
      "message:send",
      {
        id_membership: ID_MEMBERSHIP,
        text_content: `Mensaje de prueba ${new Date().toLocaleTimeString()}`,
        attachments: "",
      },
      (ack) => log("ACK message:send", ack)
    );
  }, 500);

  setTimeout(() => {
    socket.emit("user:typing", { is_typing: true }, (ack) =>
      log("ACK user:typing(true)", ack)
    );
  }, 900);

  setTimeout(() => {
    socket.emit("user:typing", { is_typing: false }, (ack) =>
      log("ACK user:typing(false)", ack)
    );
  }, 1300);

  setTimeout(() => {
    socket.emit("loadMessages", { limit: 5 }, (ack) =>
      log("ACK loadMessages", ack)
    );
  }, 1700);

  setTimeout(() => {
    socket.disconnect();
  }, 3000);
});

socket.on("disconnect", (reason) => log("disconnect", reason));
socket.on("connect_error", (err) => log("connect_error", err.message));

socket.on("user:connected", (data) => log("user:connected", data));
socket.on("message:new", (data) => log("message:new", data));
socket.on("message:edited", (data) => log("message:edited", data));
socket.on("message:deleted", (data) => log("message:deleted", data));
socket.on("user:typing", (data) => log("user:typing", data));
