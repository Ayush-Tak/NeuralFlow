from uuid import UUID

import pytest
from fastapi import HTTPException

from db.database import get_db
from models.flow import Flow
from routers import flows as flows_router
from routers.auth import get_current_user


def _override_auth(test_user):
    """Return the fake authenticated user."""

    return test_user["object"]


def _configure_flow_overrides(app, mock_db, monkeypatch, test_user) -> None:
    """Install auth, database, and flow lookup overrides."""

    async def override_db():
        """Yield the in-memory mock database."""

        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: _override_auth(test_user)
    app.dependency_overrides[get_db] = override_db

    async def fake_get_user_flow(db, flow_id: UUID, user_id: UUID) -> Flow:
        flow = mock_db.flows.get(str(flow_id))
        if flow is None or flow.user_id != user_id:
            raise HTTPException(status_code=404, detail="Flow not found")
        return flow

    monkeypatch.setattr(flows_router, "_get_user_flow", fake_get_user_flow)


@pytest.mark.asyncio
async def test_flow_endpoints_require_auth(client):
    """Flow CRUD endpoints reject unauthenticated requests."""

    flow_id = "00000000-0000-0000-0000-000000000001"

    responses = [
        await client.post("/flows", json={"name": "No Auth"}),
        await client.get("/flows"),
        await client.get(f"/flows/{flow_id}"),
        await client.put(f"/flows/{flow_id}", json={"name": "Updated"}),
        await client.delete(f"/flows/{flow_id}"),
    ]

    assert all(response.status_code == 401 for response in responses)


@pytest.mark.asyncio
async def test_flow_crud_operations(app, client, mock_db, monkeypatch, test_user):
    """Authenticated users can create, list, read, update, and delete flows."""

    _configure_flow_overrides(app, mock_db, monkeypatch, test_user)
    headers = {"Authorization": f"Bearer {test_user['token']}"}

    create_response = await client.post(
        "/flows",
        headers=headers,
        json={
            "name": "Morning Briefing",
            "description": "Daily automation",
            "nodes": [],
            "edges": [],
        },
    )
    assert create_response.status_code == 201
    created_flow = create_response.json()
    flow_id = created_flow["id"]
    assert created_flow["name"] == "Morning Briefing"

    list_response = await client.get("/flows", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = await client.get(f"/flows/{flow_id}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["id"] == flow_id

    update_response = await client.put(
        f"/flows/{flow_id}",
        headers=headers,
        json={"name": "Updated Briefing", "status": "active"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated Briefing"
    assert update_response.json()["status"] == "active"

    delete_response = await client.delete(f"/flows/{flow_id}", headers=headers)
    assert delete_response.status_code == 204
    assert flow_id not in mock_db.flows
