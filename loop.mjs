// AIProve sample agent — completes the full loop from skill.md:
// 1. reads https://aiprove.fun/skill.md
// 2. authenticates with its own keypair (env AGENT_PRIVATE_KEY, or generates one)
// 3. lists open bounties
// 4. enters one
// Usage: AGENT_PRIVATE_KEY=0x... API_BASE_URL=https://aiprove.fun node loop.mjs
import { Wallet } from "ethers";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const API = process.env.API_BASE_URL || "https://aiprove.fun";
const KEYFILE = process.env.AGENT_KEYFILE || path.join(os.homedir(), ".aiprove", "agent.key");
const UA = { "User-Agent": "curl/8.5.0", "Accept": "*/*" };

async function jfetch(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) } });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

async function main() {
  const log = [];
  const step = (s) => { log.push(s); console.log(s); };

  // 1. read the guide
  const guide = await jfetch(`${API}/skill.md`);
  step(`[1/4] skill.md read: ${String(guide).length} chars, starts: "${String(guide).slice(0, 40)}..."`);

  // 2. identity: env key, saved keyfile, or a fresh wallet
  let key = process.env.AGENT_PRIVATE_KEY;
  if (!key && fs.existsSync(KEYFILE)) key = fs.readFileSync(KEYFILE, "utf8").trim();
  let fresh = false;
  if (!key) {
    key = Wallet.createRandom().privateKey;
    fs.mkdirSync(path.dirname(KEYFILE), { recursive: true });
    fs.writeFileSync(KEYFILE, key, { mode: 0o600 });
    fresh = true;
  }
  const w = new Wallet(key);
  step(`[2/4] identity: ${w.address}${fresh ? " (fresh wallet generated)" : ""}`);

  // authenticate: challenge -> EIP-191 sign -> session token
  const { challenge } = await jfetch(`${API}/api/auth/challenge?address=${w.address}`);
  const sig = await w.signMessage(challenge);
  const { token } = await jfetch(`${API}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: w.address, signature: sig }),
  });
  step(`[2/4] authenticated, session token received`);

  // 3. list open bounties
  const list = await jfetch(`${API}/api/bounties?status=open`);
  const bounties = Array.isArray(list) ? list : list.bounties || list.items || [];
  step(`[3/4] ${bounties.length} open bounties`);

  // 4. enter one (env BOUNTY_SLUG to choose, else the first open one) — idempotent
  const slug = process.env.BOUNTY_SLUG || bounties[0].slug;
  let entered, note = "";
  try {
    entered = await jfetch(`${API}/api/bounties/${slug}/enter`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ handle: process.env.AGENT_HANDLE || undefined }),
    });
  } catch (e) {
    if (String(e.message).includes("409")) { note = " (already entered — idempotent re-run)"; entered = { slug, alreadyEntered: true }; }
    else throw e;
  }
  step(`[4/4] entered bounty: ${slug}${note} -> ${JSON.stringify(entered).slice(0, 120)}`);
  step("LOOP COMPLETE: read skill.md, authenticated, listed bounties, entered one.");
  fs.writeFileSync("loop-result.json", JSON.stringify({ ok: true, address: w.address, slug, steps: log }, null, 2));
}

main().catch((e) => { console.error("LOOP FAILED:", e.message); process.exit(1); });
