from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Optional


SCHEMA_VERSION = 'campus-opportunity.v1'
VALID_SOURCE_KINDS = {'search', 'academic_society', 'event_platform'}
VALID_TOPICS = {'AI', 'Web3', 'AI+Web3', 'other'}
VALID_FORMATS = {'online', 'offline', 'hybrid', 'unknown'}


def _required(value: str, field_name: str) -> str:
    value = str(value or '').strip()
    if not value:
        raise ValueError(f'{field_name} is required')
    return value


@dataclass(frozen=True)
class EventEvidence:
    field: str
    url: str
    quote: str

    def __post_init__(self):
        _required(self.field, 'evidence.field')
        _required(self.url, 'evidence.url')
        _required(self.quote, 'evidence.quote')


@dataclass(frozen=True)
class SourceCandidate:
    """The exact output contract shared by all discovery adapters."""

    source_id: str
    source_name: str
    source_kind: str
    title: str
    url: str
    summary: str = ''
    discovered_from: str = ''
    raw_evidence: str = ''

    def __post_init__(self):
        _required(self.source_id, 'source_id')
        _required(self.source_name, 'source_name')
        if self.source_kind not in VALID_SOURCE_KINDS:
            raise ValueError(f'unsupported source_kind: {self.source_kind}')
        _required(self.title, 'title')
        _required(self.url, 'url')

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class OpportunityEvent:
    """Strict, source-independent result of extracting one event page."""

    source_id: str
    source_name: str
    source_kind: str
    source_url: str
    title: str
    university: str
    topic: str
    format: str
    location: str
    starts_at: Optional[str]
    ends_at: Optional[str]
    registration_url: str
    description: str = ''
    event_type: str = '其他'
    evidence: tuple[EventEvidence, ...] = field(default_factory=tuple)
    raw_evidence: str = ''
    schema_version: str = SCHEMA_VERSION

    def __post_init__(self):
        _required(self.source_id, 'source_id')
        _required(self.source_name, 'source_name')
        if self.source_kind not in VALID_SOURCE_KINDS:
            raise ValueError(f'unsupported source_kind: {self.source_kind}')
        _required(self.source_url, 'source_url')
        _required(self.title, 'title')
        if self.topic not in VALID_TOPICS:
            raise ValueError(f'unsupported topic: {self.topic}')
        if self.format not in VALID_FORMATS:
            raise ValueError(f'unsupported format: {self.format}')

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data['evidence'] = [asdict(item) for item in self.evidence]
        return data

    def to_storage_dict(self) -> dict[str, Any]:
        """Return the legacy UniversityEvent/save_events-compatible shape."""
        return {
            'schema_version': self.schema_version,
            'title': self.title[:500],
            'university': self.university[:200],
            'topic': self.topic,
            'format': self.format,
            'event_date': self.starts_at,
            'event_end_date': self.ends_at,
            'location': self.location[:300],
            'description': self.description[:1000],
            'source_url': self.source_url,
            'source_name': self.source_name[:100],
            'source_kind': self.source_kind,
            'category': self.topic if self.topic != 'other' else 'AI',
            'event_type': self.event_type,
            'registration_url': self.registration_url[:500],
            'evidence': [asdict(item) for item in self.evidence],
            'raw_evidence': self.raw_evidence,
        }
