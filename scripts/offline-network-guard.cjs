/* eslint-disable @typescript-eslint/no-require-imports -- Preload for offline validation, never used by the application. */
const deny = () => {
  const error = new Error("Network access forbidden during offline validation");
  error.code = "OFFLINE_NETWORK_FORBIDDEN";
  throw error;
};
global.fetch = deny;
for (const name of ["node:http", "node:https"]) {
  const transport = require(name);
  transport.request = transport.get = deny;
}
require("node:net").Socket.prototype.connect = deny;
require("node:net").Server.prototype.listen = deny;
require("node:tls").connect = deny;
