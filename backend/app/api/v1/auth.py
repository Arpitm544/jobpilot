import time
import uuid
from typing import Dict, Tuple
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.preference import JobPreference
from app.models.profile import QuestionBank
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
    AuthResponse,
)
from app.services.security import hash_password, verify_password
from app.services.auth_service import generate_tokens, decode_token, create_access_token
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory rate limiting for login: (failed_attempts_count, last_failure_timestamp)
_login_failures: Dict[str, Tuple[int, float]] = {}
RATE_LIMIT_WINDOW_SECONDS = 300  # 5 minutes
MAX_FAILED_ATTEMPTS = 5


def _check_rate_limit(client_id: str):
    """Checks if client has exceeded maximum allowed failed login attempts"""
    now = time.time()
    record = _login_failures.get(client_id)
    if record:
        count, first_time = record
        if now - first_time < RATE_LIMIT_WINDOW_SECONDS:
            if count >= MAX_FAILED_ATTEMPTS:
                retry_after = int(RATE_LIMIT_WINDOW_SECONDS - (now - first_time))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many failed login attempts. Please try again in {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)}
                )
        else:
            # Window expired, reset
            _login_failures.pop(client_id, None)


def _record_failed_attempt(client_id: str):
    now = time.time()
    record = _login_failures.get(client_id)
    if record and (now - record[1] < RATE_LIMIT_WINDOW_SECONDS):
        _login_failures[client_id] = (record[0] + 1, record[1])
    else:
        _login_failures[client_id] = (1, now)


def _clear_failed_attempts(client_id: str):
    _login_failures.pop(client_id, None)


def set_auth_cookie(response: Response, token: str) -> None:
    """Sets the HTTP-only access_token cookie with secure defaults"""
    secure = settings.COOKIE_SECURE if settings.COOKIE_SECURE is not None else (settings.ENVIRONMENT == "production")
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure,
        samesite=settings.COOKIE_SAMESITE.lower(),
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        domain=settings.COOKIE_DOMAIN,
    )


def clear_auth_cookie(response: Response) -> None:
    """Removes the access_token cookie by invalidating it"""
    secure = settings.COOKIE_SECURE if settings.COOKIE_SECURE is not None else (settings.ENVIRONMENT == "production")
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        path="/",
        domain=settings.COOKIE_DOMAIN,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE.lower(),
        secure=secure,
    )
    # Defense in depth: also explicitly set max_age=0
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value="",
        max_age=0,
        path="/",
        domain=settings.COOKIE_DOMAIN,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE.lower(),
        secure=secure,
    )


async def _handle_registration(
    user_in: UserRegisterRequest,
    response: Response,
    db: AsyncSession
) -> AuthResponse:
    # Check if user already exists
    existing = await db.execute(select(User).where(User.email == user_in.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Create new user
    new_user = User(
        id=uuid.uuid4(),
        email=user_in.email.lower(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name or user_in.email.split("@")[0].title(),
        role="user",
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    # Create default job preferences for user
    default_prefs = JobPreference(
        id=uuid.uuid4(),
        user_id=new_user.id,
        target_roles=["Full-Stack Developer", "Frontend Developer", "Backend Developer"],
        locations=["Remote"],
        apply_mode="review_then_apply",
        daily_cap=20,
    )
    db.add(default_prefs)

    # Create default question bank for user
    default_qb = QuestionBank(
        id=uuid.uuid4(),
        user_id=new_user.id,
    )
    db.add(default_qb)

    await db.commit()
    await db.refresh(new_user)

    # Generate 7-day token & set HTTP-only cookie
    token = create_access_token(new_user.id, new_user.email, new_user.role)
    set_auth_cookie(response, token)

    return AuthResponse(
        user=UserResponse.model_validate(new_user),
        message="Account created successfully"
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    return await _handle_registration(user_in, response, db)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def signup(
    user_in: UserRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Alias for /register"""
    return await _handle_registration(user_in, response, db)


@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: UserLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"{client_ip}:{credentials.email.lower()}"
    _check_rate_limit(rate_limit_key)

    result = await db.execute(select(User).where(User.email == credentials.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        _record_failed_attempt(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # Success: clear failed rate-limit attempts
    _clear_failed_attempts(rate_limit_key)

    # Generate 7-day token and set HTTP-only cookie
    token = create_access_token(user.id, user.email, user.role)
    set_auth_cookie(response, token)

    return AuthResponse(
        user=UserResponse.model_validate(user),
        message="Logged in successfully"
    )


@router.post("/logout")
async def logout(response: Response):
    """Deletes access_token cookie and ends current session"""
    clear_auth_cookie(response)
    return {"message": "Logged out successfully"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshTokenRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = uuid.UUID(payload.get("sub"))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer active or exists",
        )

    tokens = generate_tokens(user.id, user.email, user.role)
    set_auth_cookie(response, tokens.access_token)
    return tokens


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user details from the session"""
    return UserResponse.model_validate(current_user)
