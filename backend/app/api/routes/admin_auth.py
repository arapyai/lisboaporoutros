from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.entities import AdminPasswordReset, AdminUser
from app.schemas.common import EnvelopeMeta, envelope
from app.services.password_recovery import private_digest, reset_link, send_password_recovery

router = APIRouter(prefix="/api/v1/admin/auth", tags=["admin-auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=32, max_length=200)
    password: str = Field(min_length=12, max_length=128)


@router.post("/forgot-password", status_code=202)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    settings = get_settings()
    if not settings.resend_api_key or not settings.resend_from_email:
        raise HTTPException(status_code=503, detail="Password recovery unavailable")
    token = token_urlsafe(32)
    try:
        reset_link(token)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Password recovery unavailable") from exc
    now = datetime.now(UTC)
    email = str(payload.email).strip().lower()
    email_hash = private_digest("email:" + email)
    client_hash = private_digest("client:" + (request.client.host if request.client else "unknown"))
    recent = AdminPasswordReset.created_at > now - timedelta(minutes=15)
    email_count = (
        db.scalar(
            select(func.count())
            .select_from(AdminPasswordReset)
            .where(recent, AdminPasswordReset.email_hash == email_hash)
        )
        or 0
    )
    client_count = (
        db.scalar(
            select(func.count())
            .select_from(AdminPasswordReset)
            .where(recent, AdminPasswordReset.client_hash == client_hash)
        )
        or 0
    )
    result = envelope(
        {"message": "Se o e-mail estiver cadastrado, receberá um link para redefinir a senha."},
        EnvelopeMeta(),
    )
    if email_count >= 3 or client_count >= 30:
        return result
    admin = db.scalar(
        select(AdminUser).where(func.lower(AdminUser.email) == email, AdminUser.is_active.is_(True))
    )
    reset = AdminPasswordReset(
        email_hash=email_hash,
        client_hash=client_hash,
        admin_id=admin.id if admin else None,
        auth_version=admin.auth_version if admin else None,
        token_hash=private_digest("token:" + token) if admin else None,
        expires_at=now + timedelta(minutes=30),
    )
    db.execute(
        delete(AdminPasswordReset)
        .where(AdminPasswordReset.created_at < now - timedelta(days=1))
        .execution_options(synchronize_session=False)
    )
    db.add(reset)
    db.commit()
    if admin:
        background_tasks.add_task(send_password_recovery, admin.email, token, str(reset.id))
    return result


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest, db: Annotated[Session, Depends(get_db)]
) -> dict[str, object]:
    now = datetime.now(UTC)
    reset = db.execute(
        update(AdminPasswordReset)
        .where(
            AdminPasswordReset.token_hash == private_digest("token:" + payload.token),
            AdminPasswordReset.expires_at > now,
            AdminPasswordReset.used_at.is_(None),
        )
        .values(used_at=now)
        .execution_options(synchronize_session=False)
        .returning(AdminPasswordReset.admin_id, AdminPasswordReset.auth_version)
    ).first()
    if reset:
        changed = db.execute(
            update(AdminUser)
            .where(
                AdminUser.id == reset.admin_id,
                AdminUser.is_active.is_(True),
                AdminUser.auth_version == reset.auth_version,
            )
            .values(
                password_hash=hash_password(payload.password),
                auth_version=AdminUser.auth_version + 1,
            )
        ).rowcount
        if changed:
            db.commit()
            return envelope(
                {"message": "Senha redefinida. Entre com a nova senha."}, EnvelopeMeta()
            )
    db.rollback()
    raise HTTPException(status_code=400, detail="Invalid or expired recovery link")


@router.post("/login")
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    admin = db.scalar(
        select(AdminUser).where(
            func.lower(AdminUser.email) == str(payload.email).strip().lower(),
            AdminUser.is_active.is_(True),
        )
    )
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(admin.id, auth_version=admin.auth_version)
    return envelope({"access_token": token, "token_type": "bearer"}, EnvelopeMeta())


@router.get("/me")
def me(current_admin: Annotated[AdminUser, Depends(get_current_admin)]) -> dict[str, object]:
    return envelope(
        {
            "id": str(current_admin.id),
            "email": current_admin.email,
            "is_active": current_admin.is_active,
        },
        EnvelopeMeta(),
    )
