from __future__ import annotations

from rivu_server_sdk import mount_component_v1, set_component_v1

from crystalith.shared.db import Session
from crystalith.shared.ui_state import apply_state_delta, build_default_shared_state, normalize_shared_state, remove_message_components


def test_remove_message_components_removes_only_target_message_mounts() -> None:
    db_session = Session(
        notebook_id=1,
        title='session',
        shared_state=build_default_shared_state(),
        shared_state_revision=0,
    )

    delta = []
    delta.extend(
        set_component_v1(
            component_id='qa:1:summary',
            component={
                'type': 'ReportSection',
                'schemaVersion': 1,
                'props': {'title': 'Summary', 'description': 'Hello'},
                'revision': 0,
                'mounts': [],
                'status': 'ready',
            },
        )
    )
    delta.extend(mount_component_v1(component_id='qa:1:summary', message_id='1', slot='inline', order=0))
    delta.extend(
        set_component_v1(
            component_id='qa:2:summary',
            component={
                'type': 'ReportSection',
                'schemaVersion': 1,
                'props': {'title': 'Other', 'description': 'World'},
                'revision': 0,
                'mounts': [],
                'status': 'ready',
            },
        )
    )
    delta.extend(mount_component_v1(component_id='qa:2:summary', message_id='2', slot='inline', order=0))

    shared_state, revision = apply_state_delta(db_session, delta=delta)
    assert revision == 1
    assert set(shared_state['ui']['components'].keys()) == {'qa:1:summary', 'qa:2:summary'}

    next_state, next_revision, removed_delta = remove_message_components(db_session, message_id=1)
    assert removed_delta
    assert next_revision == 2
    assert 'qa:1:summary' not in next_state['ui']['components']
    assert 'qa:2:summary' in next_state['ui']['components']


def test_normalize_shared_state_omits_none_component_fields() -> None:
    normalized = normalize_shared_state({
        'ui': {
            'v': 1,
            'components': {
                'qa:1:summary': {
                    'type': 'ReportSection',
                    'schemaVersion': 1,
                    'props': {'title': 'Summary'},
                    'state': None,
                    'revision': 0,
                    'mounts': [],
                    'status': 'ready',
                    'error': None,
                },
            },
            'datasets': {},
        },
    })

    component = normalized['ui']['components']['qa:1:summary']
    assert 'state' not in component
    assert 'error' not in component
