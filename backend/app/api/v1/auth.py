import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
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

    tokens = generate_tokens(new_user.id, new_user.email, new_user.role)
    return AuthResponse(
        user=UserResponse.model_validate(new_user),
        tokens=tokens
    )


@router.post("/login", response_model=AuthResponse)
async def login(credentials: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    tokens = generate_tokens(user.id, user.email, user.role)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
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

    return generate_tokens(user.id, user.email, user.role)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
