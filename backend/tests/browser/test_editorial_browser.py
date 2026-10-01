"""Rendered editorial journey over HTTP and PostgreSQL, not mocked API responses."""

import os
import signal
import socket
import subprocess
import threading
import time
from pathlib import Path

import pytest
import uvicorn
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes import admin_automation, admin_point_translations, admin_routes
from app.core.db import get_db
from app.models.entities import AudioGenerationJob, Route, Translation
from tests.test_admin_content import auth_header
from tests.test_route_readiness import StubProvider


class ForbiddenProvider:
    def __getattr__(self, name):
        raise AssertionError(f"Rendered journey must not call external provider: {name}")


@pytest.mark.parametrize(
    "browser", os.environ.get("LISBOA_EDITORIAL_BROWSERS", "chromium,firefox,webkit").split(",")
)
@pytest.mark.parametrize("width", [390, 1366])
def test_rendered_editorial_journey(browser, width, client, db_session, monkeypatch):
    assert browser in {"chromium", "firefox", "webkit"}
    # The only seed is a disposable administrator; content must originate in the UI.
    auth_header(client, db_session)
    monkeypatch.setattr(admin_routes, "directions_provider_factory", lambda: StubProvider())
    monkeypatch.setattr(admin_automation, "elevenlabs_service", ForbiddenProvider())
    monkeypatch.setattr(admin_automation, "translation_service", ForbiddenProvider())
    monkeypatch.setattr(admin_point_translations, "translation_service", ForbiddenProvider())

    def independent_session():
        # Browser queries are concurrent: never share the TestClient fixture's Session.
        with Session(db_session.get_bind(), autoflush=False) as session:
            yield session

    client.app.dependency_overrides[get_db] = independent_session
    with socket.socket() as frontend_socket, socket.socket() as api_socket:
        frontend_socket.bind(("127.0.0.1", 0))
        frontend_port = frontend_socket.getsockname()[1]
        frontend_socket.close()
        api_socket.bind(("127.0.0.1", 0))
        api_port = api_socket.getsockname()[1]
        # CORS uses the actual ephemeral frontend origin, not a production hostname.
        for middleware in client.app.user_middleware:
            if middleware.cls.__name__ == "CORSMiddleware":
                middleware.kwargs["allow_origins"] = [f"http://127.0.0.1:{frontend_port}"]
        client.app.middleware_stack = None
        server = uvicorn.Server(uvicorn.Config(client.app, log_level="warning"))
        thread = threading.Thread(target=server.run, kwargs={"sockets": [api_socket]}, daemon=True)
        thread.start()
        try:
            deadline = time.monotonic() + 10
            while not server.started and thread.is_alive() and time.monotonic() < deadline:
                time.sleep(0.01)
            assert server.started, "Isolated API did not start"
            env = os.environ | {
                "LISBOA_EDITORIAL_API": f"http://127.0.0.1:{api_port}",
                "LISBOA_EDITORIAL_FRONTEND_PORT": str(frontend_port),
                "LISBOA_EDITORIAL_BROWSER": browser,
                "LISBOA_EDITORIAL_WIDTH": str(width),
            }
            with subprocess.Popen(
                [
                    "npm",
                    "run",
                    "e2e",
                    "--",
                    "--config=playwright.editorial.config.ts",
                    f"--project=editorial-{browser}",
                ],
                cwd=Path(__file__).resolve().parents[3],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                start_new_session=True,
            ) as process:
                try:
                    stdout, stderr = process.communicate(timeout=240)
                    assert process.returncode == 0, stdout + stderr
                finally:
                    if process.poll() is None:
                        os.killpg(process.pid, signal.SIGTERM)
                        try:
                            process.wait(timeout=10)
                        except subprocess.TimeoutExpired:
                            os.killpg(process.pid, signal.SIGKILL)
                            process.wait(timeout=10)
            db_session.expire_all()
            route = db_session.scalar(select(Route))
            assert route is not None and route.is_published
            versions = db_session.scalars(select(Translation)).all()
            assert len(versions) == 2
            assert all(version.reviewed_by == "admin@example.com" for version in versions)
            assert db_session.scalars(select(AudioGenerationJob)).all() == []
        finally:
            server.should_exit = True
            thread.join(timeout=10)
            assert not thread.is_alive(), "Isolated API failed to stop"
