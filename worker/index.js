/* Highhorn on Cloudflare: serves the website and runs online game rooms.
   Each room is a Durable Object that passes messages between the host and the guests.
   The host's browser still runs the game; the room only relays. */
import { DurableObject } from "cloudflare:workers";

const CODE = /^[A-Z0-9]{4,8}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
    if (m) {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
      const code = m[1].toUpperCase();
      if (!CODE.test(code)) return new Response("Bad room code", { status: 400 });
      const room = env.ROOMS.get(env.ROOMS.idFromName(code));
      return room.fetch(request);
    }
    // everything else is the website itself
    return env.ASSETS.fetch(request);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // keep-alive pings are answered without waking the room
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request) {
    const role = new URL(request.url).searchParams.get("role") === "host" ? "host" : "guest";
    const hosts = this.ctx.getWebSockets("host");
    if (role === "host" && hosts.length) return new Response("This room code is taken", { status: 409 });
    if (role === "guest" && !hosts.length) return new Response("No room with this code", { status: 404 });
    if (role === "guest" && this.ctx.getWebSockets("guest").length >= 7) return new Response("This room is full", { status: 403 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (role === "host") {
      this.ctx.acceptWebSocket(server, ["host"]);
      server.serializeAttachment({ role: "host" });
    } else {
      const id = crypto.randomUUID().slice(0, 8);
      this.ctx.acceptWebSocket(server, ["guest", "g:" + id]);
      server.serializeAttachment({ role: "guest", id });
      for (const h of hosts) this.trySend(h, JSON.stringify({ sys: "join", id }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  // guests' messages go to the host, tagged with who sent them; the host addresses guests by id, or "*" for everyone
  webSocketMessage(ws, message) {
    const a = ws.deserializeAttachment() || {};
    if (typeof message !== "string" || message.length > 200000) return;
    if (a.role === "guest") {
      for (const h of this.ctx.getWebSockets("host")) this.trySend(h, JSON.stringify({ from: a.id, data: message }));
      return;
    }
    let m;
    try { m = JSON.parse(message); } catch { return; }
    if (typeof m.data !== "string") return;
    const targets = m.to === "*" ? this.ctx.getWebSockets("guest") : this.ctx.getWebSockets("g:" + m.to);
    for (const t of targets) this.trySend(t, m.data);
  }

  webSocketClose(ws, code, reason) {
    const a = ws.deserializeAttachment() || {};
    if (a.role === "guest") {
      for (const h of this.ctx.getWebSockets("host")) this.trySend(h, JSON.stringify({ sys: "leave", id: a.id }));
    } else {
      for (const g of this.ctx.getWebSockets("guest")) { try { g.close(4000, "The host left"); } catch {} }
    }
    try { ws.close(code, reason); } catch {}
  }

  webSocketError(ws) { this.webSocketClose(ws, 1011, "Connection error"); }

  trySend(ws, text) { try { ws.send(text); } catch {} }
}
