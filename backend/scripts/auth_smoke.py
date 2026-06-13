"""Smoke test for the DB + stats + auth-token layer (run inside backend container).

Bypasses Google (which needs a real token) by inserting a user directly, then
exercises GameResult recording, stats, leaderboard, and prints a bearer token
for that user so the HTTP endpoints can be curled.
"""
import asyncio
import uuid
from datetime import date, timedelta

from app import auth, stats
from app.db import SessionLocal, init_db
from app.models import GameResult, User


async def main():
    await init_db()
    async with SessionLocal() as s:
        user = User(google_sub=f"test-{uuid.uuid4().hex}", email="t@example.com", name="Tester")
        s.add(user)
        await s.commit()
        await s.refresh(user)

        today = date.today()
        # 3 consecutive daily wins (streak) + 1 loss.
        for i, won in [(0, True), (1, True), (2, True), (3, False)]:
            s.add(
                GameResult(
                    user_id=user.id,
                    mode="daily",
                    length=5,
                    won=won,
                    guesses=3 + i,
                    puzzle_date=today - timedelta(days=i),
                )
            )
        s.add(GameResult(user_id=user.id, mode="multi", length=5, won=True, guesses=4))
        await s.commit()

        st = await stats.user_stats(s, user.id)
        print("stats:", st)
        assert st["played"] == 4 and st["wins"] == 3
        assert st["currentStreak"] == 3 and st["maxStreak"] == 3
        assert st["multiWins"] == 1

        lb = await stats.leaderboard(s)
        print("leaderboard top:", lb[0] if lb else None)
        assert lb and lb[0]["wins"] == 3

        print("TOKEN:", auth.issue_token(user.id))
    print("AUTH/STATS SMOKE OK")


asyncio.run(main())
