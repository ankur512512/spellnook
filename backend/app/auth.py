"""Authentication: verify Google ID tokens, issue/verify our own JWTs.

Flow: frontend gets a Google ID token (Google Identity Services) -> POST to
/api/auth/google -> we verify it against Google, upsert the user, and return
our own JWT bearer token used for subsequent API calls.
"""
from __future__ import annotations

import os
import time

import jwt
from fastapi import Depends, Header, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .models import User

JWT_ALG = "HS256"
JWT_TTL = 60 * 60 * 24 * 30  # 30 days
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

JWT_SECRET = os.environ.get("SPELLNOOK_JWT_SECRET")
if not JWT_SECRET:
    JWT_SECRET = "dev-insecure-secret-change-me"
    print("WARN: SPELLNOOK_JWT_SECRET not set — using an insecure dev secret.")


def auth_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID)


def issue_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": int(time.time()) + JWT_TTL}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_user_id(token: str) -> str | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG]).get("sub")
    except Exception:  # noqa: BLE001 - any decode failure => anonymous
        return None


def verify_google_credential(credential: str) -> dict:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="google_auth_not_configured")
    try:
        return google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except Exception:  # noqa: BLE001 - invalid/expired/wrong-audience token
        raise HTTPException(status_code=401, detail="invalid_google_token")


async def current_user(
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="not_authenticated")
    user_id = decode_user_id(authorization.split(" ", 1)[1])
    if not user_id:
        raise HTTPException(status_code=401, detail="invalid_token")
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="user_not_found")
    return user
