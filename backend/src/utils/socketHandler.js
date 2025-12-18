let ioInstance = null;
let currentStatus = { active: false, phase: "idle" };
let currentQR = null;

function initSocket(io) {
  ioInstance = io;

  io.on("connection", (socket) => {
    console.log("[Socket.IO] Client connected:", socket.id);

    // Kirim status dan QR saat konek
    socket.emit("status-update", currentStatus);
    if (currentQR) {
      socket.emit("qr-update", currentQR);
    }

    socket.on("disconnect", () => {
      console.log("[Socket.IO] Client disconnect:", socket.id);
    });
  });
}

function emitStatusUpdate(status) {
  if (!status || typeof status !== "object") {
    return;
  }

  const nextStatus = {
    active: Boolean(status.active),
    phase:
      typeof status.phase === "string" && status.phase.length > 0
        ? status.phase
        : currentStatus.phase,
  };

  currentStatus = nextStatus;

  if (ioInstance) {
    ioInstance.emit("status-update", nextStatus);
  }
}

function emitQrUpdate(qr) {
  currentQR = qr;
  if (ioInstance) {
    ioInstance.emit("qr-update", qr);
  }
}

function emitLogUpdate(logLine, audience = "admin") {
  if (!ioInstance) {
    return;
  }

  const eventName = audience === "public" ? "log-update:public" : "log-update:admin";
  ioInstance.emit(eventName, logLine);
}

module.exports = {
  initSocket,
  emitStatusUpdate,
  emitQrUpdate,
  emitLogUpdate,
};
