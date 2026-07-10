"""Campus Opportunity Radar source adapters and extraction contracts."""

from .extractor import extract_event
from .schema import EventEvidence, OpportunityEvent, SourceCandidate

__all__ = ['EventEvidence', 'OpportunityEvent', 'SourceCandidate', 'extract_event']
