from __future__ import annotations

import pytest

from crystalith.shared.db import Session
from crystalith.shared.ui_state import build_default_shared_state


@pytest.mark.asyncio
async def test_get_ui_state_returns_default_shared_state(client):
    notebook_resp = await client.post('/v1/notebooks', json={'name': 'UI State'})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()['id']

    session_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/sessions',
        json={'title': 'UI State Session'},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()['id']

    resp = await client.get(f'/v1/notebooks/{notebook_id}/sessions/{session_id}/ui/state')
    assert resp.status_code == 200
    payload = resp.json()
    assert payload == {
        'session_id': session_id,
        'shared_state': build_default_shared_state(),
        'shared_state_revision': 0,
    }


@pytest.mark.asyncio
async def test_post_ui_event_is_idempotent_and_checks_revision(db_session, client):
    notebook_resp = await client.post('/v1/notebooks', json={'name': 'UI Event'})
    assert notebook_resp.status_code == 201
    notebook_id = notebook_resp.json()['id']

    session_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/sessions',
        json={'title': 'UI Event Session'},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()['id']

    db_session_obj = await db_session.get(Session, session_id)
    assert db_session_obj is not None
    db_session_obj.shared_state = {
        'ui': {
            'v': 1,
            'components': {
                'confirm-1': {
                    'type': 'ConfirmCard',
                    'schemaVersion': 1,
                    'props': {'title': 'Confirm'},
                    'state': {'status': 'pending'},
                    'revision': 0,
                    'mounts': [{'messageId': '1', 'slot': 'inline', 'order': 0}],
                    'status': 'ready',
                },
            },
            'datasets': {},
        },
    }
    db_session_obj.shared_state_revision = 0
    await db_session.commit()

    payload = {
        'type': 'CUSTOM',
        'name': 'ui.v1.event',
        'value': {
            'componentId': 'confirm-1',
            'eventName': 'confirm',
            'payload': {},
            'clientRequestId': 'req-1',
            'baseRevision': 0,
        },
    }

    resp = await client.post(
        f'/v1/notebooks/{notebook_id}/sessions/{session_id}/ui/event',
        json=payload,
    )
    assert resp.status_code == 200
    first_payload = resp.json()
    assert first_payload['delta']
    assert first_payload['shared_state_revision'] == 1

    repeat_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/sessions/{session_id}/ui/event',
        json=payload,
    )
    assert repeat_resp.status_code == 200
    assert repeat_resp.json() == first_payload

    state_resp = await client.get(f'/v1/notebooks/{notebook_id}/sessions/{session_id}/ui/state')
    assert state_resp.status_code == 200
    state_payload = state_resp.json()
    component = state_payload['shared_state']['ui']['components']['confirm-1']
    assert component['state']['status'] == 'confirmed'
    assert component['revision'] == 1
    assert state_payload['shared_state_revision'] == 1

    conflict_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/sessions/{session_id}/ui/event',
        json={
            'type': 'CUSTOM',
            'name': 'ui.v1.event',
            'value': {
                'componentId': 'confirm-1',
                'eventName': 'cancel',
                'payload': {},
                'clientRequestId': 'req-2',
                'baseRevision': 0,
            },
        },
    )
    assert conflict_resp.status_code == 409
    assert 'revision conflict' in conflict_resp.json()['message']
