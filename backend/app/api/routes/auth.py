from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token, get_current_user
)
from app.core.config import settings
from app.models.user import User, UserRole
from app.schemas import Token, UserCreate, UserOut
from app.services.audit_service import log_action

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive account")

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    log_action(
        db, action="USER_LOGIN", user_id=user.id,
        description=f"{user.email} logged in",
        ip_address=request.client.host,
    )
    return Token(access_token=access_token, token_type="bearer", user=UserOut.from_orm(user))


@router.post("/register", response_model=UserOut, status_code=201)
async def register(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Only ADMINs can create new users."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, action="USER_CREATED", user_id=current_user.id,
               description=f"Created user {payload.email} with role {payload.role}")
    return user


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/seed-admin", response_model=UserOut, status_code=201)
async def seed_admin(db: Session = Depends(get_db)):
    """One-time admin seeding — disable after first use."""
    if db.query(User).filter(User.role == UserRole.ADMIN).first():
        raise HTTPException(status_code=400, detail="Admin already exists")
    admin = User(
        email="admin@leadwayhealth.com",
        full_name="System Administrator",
        hashed_password=get_password_hash("Admin@2024!"),
        role=UserRole.ADMIN,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin
