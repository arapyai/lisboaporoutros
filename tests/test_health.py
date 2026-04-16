def test_healthcheck_returns_envelope(client) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "data": {"status": "ok"},
        "meta": {"page": None, "per_page": None, "total": None, "extra": {}},
    }
