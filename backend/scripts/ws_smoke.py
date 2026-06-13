"""Smoke test for the multiplayer WebSocket flow (run inside the backend container).

Multiplayer now requires sign-in, so we create two users + JWTs directly, then:
create room (authed) -> two players join -> host starts -> guesses scored ->
RECONNECT mid-round preserves progress -> finish -> ranks + revealed answer ->
post-finish guess rejected.
"""
import asyncio
import json
import os
import urllib.request
import uuid

import websockets

from app import auth
from app.db import SessionLocal, init_db
from app.models import User

BASE_HTTP = os.environ.get("SMOKE_HTTP", "http://localhost:8000")
BASE_WS = os.environ.get("SMOKE_WS", "ws://localhost:8000")

# Words from the committed curated answers.txt (valid offline, no fetch needed).
GUESSES = ["about", "above", "actor", "admit", "adopt", "adult"]


async def make_user(name: str) -> tuple[str, str]:
    async with SessionLocal() as s:
        u = User(google_sub=f"smoke-{uuid.uuid4().hex}", email=f"{name}@smoke.test", name=name)
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u.id, auth.issue_token(u.id)


def create_room(token: str) -> str:
    req = urllib.request.Request(
        f"{BASE_HTTP}/api/room", method="POST", headers={"Authorization": f"Bearer {token}"}
    )
    return json.load(urllib.request.urlopen(req))["code"]


def url(code: str, name: str, cid: str, token: str) -> str:
    return f"{BASE_WS}/ws/room/{code}?name={name}&cid={cid}&token={token}"


async def recv_until(ws, wanted, timeout=5, pred=None):
    while True:
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout))
        if msg.get("type") in wanted and (pred is None or pred(msg)):
            return msg


def player(state, cid):
    return next(p for p in state["room"]["players"] if p["id"] == cid)


async def main():
    await init_db()
    aid, atok = await make_user("Alice")
    bid, btok = await make_user("Bob")
    code = create_room(atok)
    print("room code:", code)

    a = await websockets.connect(url(code, "Alice", aid, atok))
    b = await websockets.connect(url(code, "Bob", bid, btok))
    await recv_until(a, {"welcome"})
    await recv_until(b, {"welcome"})

    await a.send(json.dumps({"type": "start", "length": 5}))
    await recv_until(a, {"state"}, pred=lambda m: m["room"]["phase"] == "playing")
    print("phase: playing")

    for g in GUESSES[:2]:
        for ws in (a, b):
            await ws.send(json.dumps({"type": "guess", "guess": g}))
            assert (await recv_until(ws, {"guess_result"}))["valid"]

    # Reconnection: drop Alice, reconnect with the same client id + token.
    await a.close()
    await asyncio.sleep(0.3)
    a = await websockets.connect(url(code, "Alice", aid, atok))
    await recv_until(a, {"welcome"})
    st = await recv_until(a, {"state"})
    preserved = len(player(st, aid)["rows"])
    print("rows preserved after reconnect:", preserved)
    assert preserved == 2, st

    for g in GUESSES[2:]:
        for ws in (a, b):
            await ws.send(json.dumps({"type": "guess", "guess": g}))
            assert (await recv_until(ws, {"guess_result"}))["valid"]

    final = await recv_until(a, {"state"}, pred=lambda m: m["room"]["phase"] == "finished")
    room = final["room"]
    print("final phase:", room["phase"], "answer:", room["answer"])
    for p in room["players"]:
        print(f"  {p['name']}: guesses={p['guessCount']} won={p['won']} rank={p['rank']}")
    assert room["answer"] and all(p["rank"] for p in room["players"])

    await a.send(json.dumps({"type": "guess", "guess": "ab"}))
    rej = await recv_until(a, {"guess_result"})
    assert not rej["valid"]
    print("rejected post-finish guess:", rej["reason"])

    await a.close()
    await b.close()
    print("\nSMOKE OK")


asyncio.run(main())
