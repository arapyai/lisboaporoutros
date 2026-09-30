import hashlib
import hmac
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def private_digest(value: str) -> str:
    return hmac.new(
        get_settings().admin_secret_key.encode(), value.encode(), hashlib.sha256
    ).hexdigest()


def reset_link(token: str) -> str:
    url = urlsplit(get_settings().admin_password_reset_url)
    if (
        url.scheme != "https"
        or not url.netloc
        or url.username
        or url.password
        or url.query
        or url.fragment
    ):
        raise ValueError("Password recovery requires a trusted HTTPS admin URL")
    # Fragment tokens never appear in HTTP access logs or Referer headers.
    return urlunsplit((url.scheme, url.netloc, url.path or "/", "", f"reset-password={token}"))


def send_password_recovery(email: str, token: str, request_id: str) -> bool:
    settings = get_settings()
    payload = {
        "from": settings.resend_from_email,
        "to": [email],
        "subject": "Lisboa por Outros — redefinir senha",
        "text": (
            "Recebemos um pedido para redefinir a sua senha. O link expira em 30 minutos "
            "e só pode ser usado uma vez:\n\n"
            + reset_link(token)
            + "\n\nSe não fez este pedido, ignore este e-mail. A sua senha não foi alterada."
        ),
    }
    request = Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Lisboa-password-recovery/1.0",
            "Idempotency-Key": f"password-reset/{request_id}",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            return 200 <= response.status < 300
    except (HTTPError, URLError, TimeoutError):
        # Never log provider bodies, recipient addresses, keys or reset tokens.
        logger.warning("Password recovery delivery failed (request %s)", request_id)
        return False
