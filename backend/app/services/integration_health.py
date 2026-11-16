import asyncio
import json
import math
import os
from datetime import UTC, datetime
from pathlib import Path
from time import monotonic
from urllib.parse import quote

import httpx

from app.core.config import Settings
from app.services.http_client import build_ssl_context
from app.services.routing import parse_openrouteservice_response

HEALTH_CACHE_SECONDS = 300
PROBE_TIMEOUT_SECONDS = 5


def check(service: str, status: str, message: str) -> dict[str, str]:
    return {"service": service, "status": status, "message": message}


def configuration(service: str, configured: bool, missing: str, limitation: str) -> dict[str, str]:
    return check(
        service,
        "configuration_only" if configured else "missing_config",
        limitation if configured else missing,
    )


async def probe(
    client: httpx.AsyncClient,
    service: str,
    method: str,
    url: str,
    headers: dict[str, str],
    *,
    coordinates: list[list[float]] | None = None,
) -> dict[str, str]:
    try:
        async with asyncio.timeout(PROBE_TIMEOUT_SECONDS):
            async with client.stream(
                method,
                url,
                headers=headers,
                **({"json": {"coordinates": coordinates}} if coordinates else {}),
            ) as response:
                status = response.status_code
                if status in {401, 403}:
                    return check(service, "error", "O fornecedor recusou a chave ou a permissão.")
                if status == 429:
                    return check(service, "error", "O fornecedor atingiu o limite de pedidos.")
                if not response.is_success:
                    return check(service, "error", f"O fornecedor respondeu HTTP {status}.")
                if coordinates:
                    content = bytearray()
                    async for chunk in response.aiter_bytes():
                        content.extend(chunk)
                        if len(content) > 64_000:
                            raise ValueError("Unexpected response size")
                    route = parse_openrouteservice_response(json.loads(content))
                    if (
                        not math.isfinite(route.distance_m)
                        or route.distance_m <= 0
                        or len(route.geometry["coordinates"]) < 2
                    ):
                        raise ValueError("Invalid test route")
    except (TimeoutError, httpx.TimeoutException):
        return check(service, "error", "O fornecedor demorou a responder.")
    except (httpx.HTTPError, httpx.InvalidURL, OSError, ValueError, OverflowError):
        return check(service, "error", "Falha de ligação ou resposta inválida do fornecedor.")
    return check(
        service,
        "ok",
        "Trajeto de referência calculado; nada foi guardado."
        if coordinates
        else "Consulta ao fornecedor respondeu; geração não testada.",
    )


async def scan(settings: Settings) -> list[dict[str, str]]:
    storage = Path(settings.audio_storage_dir)
    available = storage.is_dir() and os.access(storage, os.R_OK | os.W_OK | os.X_OK)
    checks = [
        check("database", "ok", "A consulta ao banco para autenticar esta sessão respondeu."),
        check(
            "media",
            "configuration_only" if available else "error",
            "Diretório acessível; nenhuma gravação foi testada."
            if available
            else "O diretório de áudio está indisponível ou sem permissão.",
        ),
        configuration(
            "email",
            bool(settings.resend_api_key and settings.resend_from_email),
            "Configure RESEND_API_KEY e RESEND_FROM_EMAIL.",
            "Chave e remetente presentes; nenhum e-mail foi enviado.",
        ),
        configuration(
            "maps",
            bool(settings.maptiler_api_key),
            "Configure MAPTILER_API_KEY.",
            "Chave do mapa de revisão presente; carregamento do mapa não testado.",
        ),
        configuration(
            "geocoding",
            bool(settings.geocoding_base_url)
            and (
                settings.geocoding_provider in {"", "nominatim"}
                or (settings.geocoding_provider == "mapbox" and bool(settings.geocoding_api_key))
            ),
            "Verifique o fornecedor, o endereço e a chave de geocodificação.",
            "Configuração presente; nenhuma busca de endereço foi feita.",
        ),
        check(
            "workers",
            "configuration_only" if settings.audio_worker_enabled else "disabled",
            "Fila habilitada na configuração; execução dos trabalhos não testada."
            if settings.audio_worker_enabled
            else "Trabalhos de áudio e tradução em lote desativados.",
        ),
    ]

    async with httpx.AsyncClient(
        verify=build_ssl_context() or True, follow_redirects=False
    ) as client:
        requests = []
        if settings.routing_provider != "openrouteservice":
            checks.append(
                check(
                    "routing", "missing_config", "Configure ROUTING_PROVIDER para openrouteservice."
                )
            )
        elif not (settings.openrouteservice_api_key or "").strip():
            checks.append(check("routing", "missing_config", "Configure OPENROUTESERVICE_API_KEY."))
        else:
            requests.append(
                probe(
                    client,
                    "routing",
                    "POST",
                    f"{settings.openrouteservice_base_url.rstrip('/')}/v2/directions/foot-walking/geojson",
                    {"Authorization": settings.openrouteservice_api_key},
                    coordinates=[[-9.1375, 38.7105], [-9.1406, 38.7125]],
                )
            )
        llm_key = settings.translation_llm_api_key or settings.anthropic_api_key
        if settings.translation_llm_provider.lower() not in {"claude", "anthropic"} or not llm_key:
            checks.append(
                check(
                    "translation",
                    "missing_config",
                    "Verifique o fornecedor Claude e a chave de tradução.",
                )
            )
        else:
            base = settings.translation_llm_base_url or settings.anthropic_base_url
            model = quote(settings.translation_llm_model, safe="")
            requests.append(
                probe(
                    client,
                    "translation",
                    "GET",
                    f"{base.rstrip('/')}/models/{model}",
                    {"x-api-key": llm_key, "anthropic-version": settings.anthropic_version},
                )
            )
        if not settings.elevenlabs_api_key:
            checks.append(check("voice", "missing_config", "Configure ELEVENLABS_API_KEY."))
        else:
            requests.append(
                probe(
                    client,
                    "voice",
                    "GET",
                    f"{settings.elevenlabs_base_url.rstrip('/')}/voices",
                    {"xi-api-key": settings.elevenlabs_api_key},
                )
            )
        checks.extend(await asyncio.gather(*requests))
    return checks


class IntegrationHealth:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._expires_at = 0.0
        self._snapshot: dict[str, object] = {}

    async def report(self, settings: Settings) -> dict[str, object]:
        async with self._lock:
            if monotonic() >= self._expires_at:
                checks = await scan(settings)
                self._snapshot = {"checked_at": datetime.now(UTC).isoformat(), "checks": checks}
                self._expires_at = monotonic() + HEALTH_CACHE_SECONDS
            return self._snapshot
