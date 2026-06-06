"""Stats + leaderboard queries over GameResult."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import GameResult, User


def _streaks(won_dates: list[date]) -> tuple[int, int]:
    """Return (current_streak, max_streak) from daily-win dates."""
    days = sorted({d for d in won_dates if d}, reverse=True)
    if not days:
        return 0, 0

    # current: consecutive days ending today or yesterday
    current = 0
    today = date.today()
    if days[0] in (today, today - timedelta(days=1)):
        current = 1
        prev = days[0]
        for d in days[1:]:
            if d == prev - timedelta(days=1):
                current += 1
                prev = d
            else:
                break

    # max: longest consecutive run
    best = run = 1
    asc = sorted(days)
    for i in range(1, len(asc)):
        if asc[i] == asc[i - 1] + timedelta(days=1):
            run += 1
        else:
            run = 1
        best = max(best, run)
    return current, best


async def user_stats(session: AsyncSession, user_id: str) -> dict[str, Any]:
    daily = (GameResult.mode == "daily")

    played = await session.scalar(
        select(func.count(GameResult.id)).where(GameResult.user_id == user_id, daily)
    )
    wins = await session.scalar(
        select(func.count(GameResult.id)).where(
            GameResult.user_id == user_id, daily, GameResult.won.is_(True)
        )
    )
    played = played or 0
    wins = wins or 0

    dist_rows = await session.execute(
        select(GameResult.guesses, func.count(GameResult.id))
        .where(GameResult.user_id == user_id, daily, GameResult.won.is_(True))
        .group_by(GameResult.guesses)
    )
    distribution = {int(g): int(c) for g, c in dist_rows.all()}

    date_rows = await session.execute(
        select(GameResult.puzzle_date).where(
            GameResult.user_id == user_id, daily, GameResult.won.is_(True)
        )
    )
    current_streak, max_streak = _streaks([d for (d,) in date_rows.all()])

    multi_played = await session.scalar(
        select(func.count(GameResult.id)).where(
            GameResult.user_id == user_id, GameResult.mode == "multi"
        )
    )
    multi_wins = await session.scalar(
        select(func.count(GameResult.id)).where(
            GameResult.user_id == user_id,
            GameResult.mode == "multi",
            GameResult.won.is_(True),
        )
    )

    return {
        "played": played,
        "wins": wins,
        "winPct": round(100 * wins / played) if played else 0,
        "currentStreak": current_streak,
        "maxStreak": max_streak,
        "distribution": distribution,
        "multiPlayed": multi_played or 0,
        "multiWins": multi_wins or 0,
    }


async def leaderboard(session: AsyncSession, limit: int = 20) -> list[dict[str, Any]]:
    wins = func.sum(case((GameResult.won.is_(True), 1), else_=0))
    played = func.count(GameResult.id)
    rows = await session.execute(
        select(User.name, User.picture, played.label("played"), wins.label("wins"))
        .join(GameResult, GameResult.user_id == User.id)
        .where(GameResult.mode == "daily")
        .group_by(User.id)
        .order_by(wins.desc(), played.asc())
        .limit(limit)
    )
    out = []
    for name, picture, p, w in rows.all():
        p = int(p or 0)
        w = int(w or 0)
        out.append(
            {
                "name": name,
                "picture": picture,
                "played": p,
                "wins": w,
                "winPct": round(100 * w / p) if p else 0,
            }
        )
    return out
