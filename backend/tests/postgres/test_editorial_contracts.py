"""Reuse API contracts against migrated PostgreSQL, including real uniqueness/FKs."""

import pytest

from tests import test_editorial_journey as journey
from tests import test_route_segment_identity as identity


def test_editorial_journey_on_migrated_postgres(client, db_session, monkeypatch):
    journey.test_import_review_manual_audio_route_readiness_and_publication_journey(
        client, db_session, monkeypatch
    )


@pytest.mark.parametrize(
    "contract",
    [
        identity.test_edit_and_reorder_preserve_bridge_review_and_manual_audio,
        identity.test_route_rejects_foreign_segment_without_mutating_title,
        identity.test_legacy_edit_cannot_silently_delete_manual_audio,
        identity.test_reorder_and_remove_use_explicit_identity_without_position_collisions,
        identity.test_identity_mode_can_replace_all_segments_explicitly,
    ],
    ids=lambda contract: contract.__name__,
)
def test_segment_identity_on_migrated_postgres(contract, client, db_session):
    contract(client, db_session)
