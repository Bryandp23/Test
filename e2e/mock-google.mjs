// Simulateur local des API Google (OAuth + Calendar v3) pour les tests automatisés.
// Il reproduit les comportements utiles : identifiant d'événement imposé, 409 en cas de doublon,
// 404 après suppression par l'utilisateur, refus de consentement, révocation.
// Ce n'est PAS Google : les tests réels avec un compte Google restent à faire (voir docs/TESTS.md).
import http from "node:http";

export function startMockGoogle(port) {
  const events = new Map();
  const log = [];
  let revoked = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let body = "";
    for await (const c of req) body += c;
    const send = (status, data, headers = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(typeof data === "string" ? data : JSON.stringify(data));
    };
    log.push(`${req.method} ${url.pathname}`);
    const authOk = (req.headers.authorization ?? "").startsWith("Bearer at-");

    if (url.pathname === "/auth") {
      const redirect = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><title>Simulateur Google</title><h1>Simulateur Google — autoriser EPHEC Calendar ?</h1>
        <a id="allow" href="${redirect}?code=code-ok&state=${state}">Autoriser</a>
        <a id="deny" href="${redirect}?error=access_denied&state=${state}">Refuser</a>`);
    }
    if (url.pathname === "/token") {
      const p = new URLSearchParams(body);
      if (p.get("grant_type") === "authorization_code" && p.get("code") === "code-ok" && p.get("code_verifier"))
        return send(200, { access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, scope: "openid email https://www.googleapis.com/auth/calendar.events" });
      if (p.get("grant_type") === "refresh_token") return send(200, { access_token: "at-2", expires_in: 3600 });
      return send(400, { error: "invalid_grant" });
    }
    if (url.pathname === "/userinfo") return authOk ? send(200, { email: "participant.test@example.com" }) : send(401, { error: "unauthorized" });
    if (url.pathname === "/revoke") {
      revoked++;
      return send(200, {});
    }
    if (url.pathname === "/__state") return send(200, { events: [...events.values()], revoked, log });
    if (url.pathname.startsWith("/__delete/")) {
      events.delete(decodeURIComponent(url.pathname.slice(10)));
      return send(200, {});
    }
    if (url.pathname.startsWith("/events")) {
      if (!authOk) return send(401, { error: { message: "Invalid Credentials" } });
      const id = decodeURIComponent(url.pathname.slice(8));
      if (req.method === "POST" && !id) {
        const ev = JSON.parse(body);
        if (events.has(ev.id)) return send(409, { error: { message: "The requested identifier already exists." } });
        const stored = { ...ev, status: "confirmed", htmlLink: `https://calendar.example/event?eid=${ev.id}` };
        events.set(ev.id, stored);
        return send(200, stored);
      }
      if (!events.has(id)) return send(404, { error: { message: "Not Found" } });
      if (req.method === "GET") return send(200, events.get(id));
      if (req.method === "PUT") {
        const stored = { ...JSON.parse(body), id, status: "confirmed", htmlLink: events.get(id).htmlLink };
        events.set(id, stored);
        return send(200, stored);
      }
    }
    if (url.pathname === "/ac-redirect") {
      // Imite une redirection de suivi des clics d'un outil d'emailing.
      res.writeHead(302, { location: url.searchParams.get("u") });
      return res.end();
    }
    send(404, { error: "unknown" });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, events })));
}
