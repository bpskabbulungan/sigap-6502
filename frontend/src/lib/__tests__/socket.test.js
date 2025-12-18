/* eslint-env node */
import test from "node:test";
import assert from "node:assert/strict";

const nestedBaseUrl = "https://domain.example/app";

test("websocket connections target bare origin when API base has path", async (t) => {
  const env = globalThis.process?.env;
  if (!env) {
    throw new Error("process.env unavailable in test environment");
  }
  env.VITE_API_BASE_URL = nestedBaseUrl;

  const {
    getSocket,
    closeSocket,
    resolveSocketOrigin,
    setSocketFactory,
    resetSocketFactory,
  } = await import("../socket.js");

  t.after(() => {
    closeSocket();
    resetSocketFactory();
    delete env.VITE_API_BASE_URL;
  });

  const calls = [];
  const fakeSocket = {
    removeAllListeners: () => {},
    disconnect: () => {},
  };
  setSocketFactory((...args) => {
    calls.push(args);
    return fakeSocket;
  });

  assert.equal(resolveSocketOrigin(nestedBaseUrl), "https://domain.example");

  const socket = getSocket();
  assert.equal(socket, fakeSocket);

  assert.equal(calls.length, 1);
  const [socketUrl, socketOptions] = calls[0];
  assert.equal(socketUrl, "https://domain.example");
  assert.deepEqual(socketOptions, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    autoConnect: true,
  });
});
