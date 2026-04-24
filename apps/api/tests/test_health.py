import pytest


@pytest.mark.asyncio
async def test_health(client):
    """GET /api/health returns service status."""

    response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "0.1.0"}

