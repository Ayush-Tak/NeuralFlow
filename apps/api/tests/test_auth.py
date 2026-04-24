import pytest

from routers.auth import get_current_user


@pytest.mark.asyncio
async def test_google_login_redirects(client):
    """GET /auth/google/login redirects to Google OAuth."""

    response = await client.get("/auth/google/login", follow_redirects=False)

    assert response.status_code == 302
    assert "accounts.google.com" in response.headers["location"]


@pytest.mark.asyncio
async def test_me_without_token_returns_401(client):
    """GET /auth/me rejects requests without bearer tokens."""

    response = await client.get("/auth/me")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_with_valid_mock_jwt_returns_user(app, client, test_user):
    """GET /auth/me returns the mocked authenticated user."""

    app.dependency_overrides[get_current_user] = lambda: test_user["object"]

    response = await client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {test_user['token']}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == test_user["email"]
