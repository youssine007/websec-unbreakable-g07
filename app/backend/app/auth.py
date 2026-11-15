from __future__ import annotations

import os

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

OIDC_ISSUER = os.environ["OIDC_ISSUER"]
OIDC_AUDIENCE = os.environ["OIDC_AUDIENCE"]
OIDC_JWKS_URL = os.environ["OIDC_JWKS_URL"]
USER_CLAIM = os.environ.get("OIDC_USER_CLAIM", "preferred_username")

_jwks = jwt.PyJWKClient(OIDC_JWKS_URL)
_bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def verify_token(token: str) -> str:
    try:
        signing_key = _jwks.get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=OIDC_AUDIENCE,
            issuer=OIDC_ISSUER,
            leeway=30,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError:
        raise _unauthorized("invalid token")

    user = claims.get(USER_CLAIM)
    if not user:
        raise _unauthorized(f"token has no {USER_CLAIM} claim")
    return user


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    if creds is None or creds.scheme.lower() != "bearer":
        raise _unauthorized("missing bearer token")
    return verify_token(creds.credentials)
