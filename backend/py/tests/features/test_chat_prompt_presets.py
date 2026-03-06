from __future__ import annotations

import json

import pytest

from crystalith.shared.db import Chunk, Source
from crystalith.shared.types import SourceStatus


async def _read_sse_events(response) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    current_event: str | None = None
    async for line in response.aiter_lines():
        if not line:
            continue
        if line.startswith('event: '):
            current_event = line.removeprefix('event: ').strip()
            continue
        if current_event and line.startswith('data: '):
            events.append((current_event, json.loads(line.removeprefix('data: ').strip() or '{}')))
            current_event = None
    return events


async def _create_ready_source(db_session, app, *, notebook_id: int, filename: str, text: str) -> Source:
    source = Source(
        notebook_id=notebook_id,
        filename=filename,
        status=SourceStatus.READY,
    )
    db_session.add(source)
    await db_session.flush()

    chunk = Chunk(source_id=source.id, chunk_index=0, text=text)
    db_session.add(chunk)
    await db_session.commit()

    await app.state.vector_store.add(
        notebook_id=notebook_id,
        source_id=source.id,
        chunk_ids=[chunk.id],
        vectors=[[1.0, 0.0, 0.0]],
    )
    return source


@pytest.mark.asyncio
async def test_prompt_directive_returns_400_when_presets_disabled(client):
    create_resp = await client.post('/v1/notebooks', json={'name': 'Preset Disabled'})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()['id']

    qa_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/qa',
        json={'question': '/prompt:stats hello'},
    )
    assert qa_resp.status_code == 400
    assert qa_resp.json()['message'] == 'Prompt presets are disabled'


@pytest.mark.asyncio
async def test_prompt_directive_empty_query_returns_usage(client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True

    create_resp = await client.post('/v1/notebooks', json={'name': 'Preset Empty Query'})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()['id']

    qa_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/qa',
        json={'question': '/prompt:stats'},
    )
    assert qa_resp.status_code == 400
    assert 'Usage: /prompt:<preset> <query>' in qa_resp.json()['message']


@pytest.mark.asyncio
async def test_prompt_directive_unknown_preset_returns_400(client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True

    create_resp = await client.post('/v1/notebooks', json={'name': 'Preset Unknown'})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()['id']

    qa_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/qa',
        json={'question': '/prompt:unknown hello'},
    )
    assert qa_resp.status_code == 400
    assert 'Unknown preset: unknown' in qa_resp.json()['message']


@pytest.mark.asyncio
async def test_stats_preset_returns_shared_state_ui_when_session_persisted(db_session, client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True

    create_resp = await client.post('/v1/notebooks', json={'name': 'Preset Stats Shared State'})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()['id']

    session_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/sessions',
        json={'title': 'Stats Session'},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()['id']

    source = await _create_ready_source(
        db_session,
        app,
        notebook_id=notebook_id,
        filename='Doc.csv',
        text='Test chunk for stats preset.',
    )

    qa_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/qa',
        json={
            'question': '/prompt:stats show chart',
            'source_ids': [source.id],
            'session_id': session_id,
        },
    )
    assert qa_resp.status_code == 200
    payload = qa_resp.json()

    assert payload['answer'].startswith('Test stats answer')
    assert '[[crystalith-ui:v1]]' not in payload['answer']
    assert payload['citations']
    assert payload['message_id'] > 0
    assert payload['shared_state_revision'] == 1

    components = payload['shared_state']['ui']['components']
    assert set(components.keys()) == {
        f"qa:{payload['message_id']}:summary",
        f"qa:{payload['message_id']}:chart",
        f"qa:{payload['message_id']}:table",
    }
    summary_mounts = components[f"qa:{payload['message_id']}:summary"]['mounts']
    chart_mounts = components[f"qa:{payload['message_id']}:chart"]['mounts']
    table_mounts = components[f"qa:{payload['message_id']}:table"]['mounts']
    assert len(summary_mounts) == 1
    assert len(chart_mounts) == 1
    assert len(table_mounts) == 1
    assert summary_mounts[0]['messageId'] == str(payload['message_id'])
    assert summary_mounts[0]['slot'] == 'inline'


@pytest.mark.asyncio
async def test_stats_preset_invalid_output_falls_back_to_text_qa(db_session, client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True

    create_resp = await client.post('/v1/notebooks', json={'name': 'Preset Stats Fallback'})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()['id']

    source = await _create_ready_source(
        db_session,
        app,
        notebook_id=notebook_id,
        filename='Doc.md',
        text='Test chunk for fallback.',
    )

    qa_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/qa',
        json={'question': '/prompt:stats invalid_json', 'source_ids': [source.id]},
    )
    assert qa_resp.status_code == 200
    payload = qa_resp.json()
    assert payload['answer'] == 'Test answer [1]'
    assert '[[crystalith-ui:v1]]' not in payload['answer']
    assert payload['shared_state']['ui']['components'] == {}


@pytest.mark.asyncio
async def test_stream_prompt_errors_use_error_event(client):
    create_resp = await client.post('/v1/notebooks', json={'name': 'Preset Stream Errors'})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()['id']

    async with client.stream(
        'POST',
        f'/v1/notebooks/{notebook_id}/qa/stream',
        json={'question': '/prompt:stats hello'},
        headers={'Accept': 'text/event-stream'},
    ) as response:
        assert response.status_code == 200
        events = await _read_sse_events(response)

    assert ('error', {'message': 'Prompt presets are disabled'}) in events


@pytest.mark.asyncio
async def test_stats_preset_stream_persists_plain_answer_and_emits_state_events(db_session, client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True

    create_resp = await client.post('/v1/notebooks', json={'name': 'Preset Stats Stream'})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()['id']

    session_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/sessions',
        json={'title': 'Stream Session'},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()['id']

    source = await _create_ready_source(
        db_session,
        app,
        notebook_id=notebook_id,
        filename='Doc.md',
        text='Test chunk for stream stats.',
    )

    async with client.stream(
        'POST',
        f'/v1/notebooks/{notebook_id}/qa/stream',
        json={
            'question': '/prompt:stats stream please',
            'source_ids': [source.id],
            'session_id': session_id,
        },
        headers={'Accept': 'text/event-stream'},
    ) as response:
        assert response.status_code == 200
        events = await _read_sse_events(response)

    event_names = [event for event, _data in events]
    assert 'state_snapshot' in event_names
    assert 'state_delta' in event_names
    assert 'chunk' in event_names
    assert 'done' in event_names

    snapshot_payload = next(data for event, data in events if event == 'state_snapshot')
    assert snapshot_payload['shared_state']['ui']['components'] == {}
    assert snapshot_payload['message_id'] > 0

    state_delta_payload = next(data for event, data in events if event == 'state_delta')
    summary_add_op = next(
        op for op in state_delta_payload['delta']
        if op['path'] == f"/ui/components/qa:{snapshot_payload['message_id']}:summary"
    )
    assert summary_add_op['value']['mounts'] == []

    done_payload = next(data for event, data in events if event == 'done')
    assert done_payload['message_id'] == snapshot_payload['message_id']
    assert done_payload['shared_state_revision'] == 1

    messages_resp = await client.get(f'/v1/notebooks/{notebook_id}/sessions/{session_id}/messages')
    assert messages_resp.status_code == 200
    assistant = next((msg for msg in reversed(messages_resp.json()) if msg.get('role') == 'assistant'), None)
    assert assistant is not None
    assert assistant['id'] == done_payload['message_id']
    assert assistant['content'].startswith('Test stats answer')
    assert '[[crystalith-ui:v1]]' not in assistant['content']

    ui_state_resp = await client.get(
        f'/v1/notebooks/{notebook_id}/sessions/{session_id}/ui/state',
    )
    assert ui_state_resp.status_code == 200
    ui_state_payload = ui_state_resp.json()
    assert ui_state_payload['shared_state_revision'] == 1
    components = ui_state_payload['shared_state']['ui']['components']
    assert components
    for component in components.values():
        assert len(component['mounts']) == 1


@pytest.mark.asyncio
async def test_custom_prompt_preset_overrides_system_prompt(db_session, client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True

    preset_resp = await client.post(
        '/v1/prompt-presets',
        json={
            'trigger': 'demo',
            'description': 'Demo preset',
            'system_prompt': 'Answer using bullet points.',
            'enabled': True,
        },
    )
    assert preset_resp.status_code == 201

    create_resp = await client.post('/v1/notebooks', json={'name': 'Custom Preset QA'})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()['id']

    source = await _create_ready_source(
        db_session,
        app,
        notebook_id=notebook_id,
        filename='Doc.md',
        text='Test chunk for custom preset.',
    )

    qa_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/qa',
        json={'question': '/prompt:demo hello', 'source_ids': [source.id]},
    )
    assert qa_resp.status_code == 200
    payload = qa_resp.json()
    assert payload['answer'].startswith('- Test bullet 1')


@pytest.mark.asyncio
async def test_custom_prompt_preset_disabled_returns_400(client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True

    preset_resp = await client.post(
        '/v1/prompt-presets',
        json={
            'trigger': 'demo',
            'description': 'Disabled demo',
            'system_prompt': 'Answer using bullet points.',
            'enabled': False,
        },
    )
    assert preset_resp.status_code == 201

    create_resp = await client.post('/v1/notebooks', json={'name': 'Custom Preset Disabled'})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()['id']

    qa_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/qa',
        json={'question': '/prompt:demo hello'},
    )
    assert qa_resp.status_code == 400
    assert qa_resp.json()['message'] == 'Prompt preset is disabled'


@pytest.mark.asyncio
async def test_prompt_usage_includes_custom_presets(client, app):
    app.state.settings.app.features.chat_prompt_presets_enabled = True

    preset_resp = await client.post(
        '/v1/prompt-presets',
        json={
            'trigger': 'demo',
            'description': 'Demo preset',
            'system_prompt': 'Answer using bullet points.',
            'enabled': True,
        },
    )
    assert preset_resp.status_code == 201

    create_resp = await client.post('/v1/notebooks', json={'name': 'Custom Preset Usage'})
    assert create_resp.status_code == 201
    notebook_id = create_resp.json()['id']

    qa_resp = await client.post(
        f'/v1/notebooks/{notebook_id}/qa',
        json={'question': '/prompt:unknown hello'},
    )
    assert qa_resp.status_code == 400
    assert 'Available presets:' in qa_resp.json()['message']
    assert 'demo' in qa_resp.json()['message']
