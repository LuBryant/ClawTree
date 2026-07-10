"""Deterministic quality rules for Campus Opportunity Radar inputs.

External pages and model extraction output are untrusted data.  These helpers
therefore fail closed: a contact is importable only when its public-business
scope, evidence, purpose, and provenance are explicit.
"""

import re
from datetime import date, datetime
from urllib.parse import urlsplit, urlunsplit

from django.core.validators import validate_email
from django.core.exceptions import ValidationError


SOURCE_PRIORITY = {
    'university_official': 1,
    'official_university': 1,
    'faculty_department': 2,
    'official_department': 2,
    'innovation_center': 3,
    'public_student_org': 4,
    'public_organization': 4,
    'professional_society': 5,
    'academic_society': 5,
    'event_platform': 6,
}

OFFICIAL_SOURCE_TYPES = frozenset({
    'university_official',
    'official_university',
    'faculty_department',
    'official_department',
    'innovation_center',
    'public_student_org',
    'public_organization',
    'professional_society',
    'academic_society',
})

ALLOWED_CONTACT_PURPOSES = frozenset({'event', 'collaboration', 'media', 'general'})
ALLOWED_CONTACT_SCOPES = frozenset({
    'institution',
    'organization',
    'event',
    'department',
    'innovation_center',
    'public_student_org',
    'professional_society',
})
GUESSED_PROVENANCE = frozenset({'guessed', 'inferred', 'generated', 'pattern', 'predicted'})
PERSONAL_EMAIL_DOMAINS = frozenset({
    '126.com',
    '163.com',
    'foxmail.com',
    'gmail.com',
    'hotmail.com',
    'icloud.com',
    'outlook.com',
    'proton.me',
    'protonmail.com',
    'qq.com',
    'yahoo.com',
})


def _is_absolute_public_url(value):
    try:
        parsed = urlsplit(str(value or '').strip())
    except (TypeError, ValueError):
        return False
    return parsed.scheme in {'http', 'https'} and bool(parsed.netloc)


def canonical_source_url(value):
    """Strip tracking/query noise so repeated source URLs compare exactly."""
    if not _is_absolute_public_url(value):
        return ''
    parsed = urlsplit(value.strip())
    path = re.sub(r'/+$', '', parsed.path) or '/'
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), path, '', ''))


def canonical_event_key(event):
    source_url = canonical_source_url(event.get('source_url') or event.get('sourceUrl'))
    if source_url:
        return f'url:{source_url}'
    title = re.sub(r'\W+', '', str(event.get('title') or event.get('activity_name') or '')).lower()
    university = re.sub(r'\W+', '', str(event.get('university') or event.get('school') or '')).lower()
    event_date = event.get('event_date') or event.get('date') or event.get('startsAt') or ''
    return f'event:{university}:{title}:{str(event_date)[:10]}'


def validate_contact_candidate(candidate):
    """Return rejection reasons for one extracted contact candidate."""
    reasons = []
    channel = str(candidate.get('channel') or 'email').strip().lower()
    value = str(candidate.get('value') or '').strip()
    purpose = str(candidate.get('purpose') or '').strip().lower()
    evidence_url = str(candidate.get('evidence_url') or candidate.get('evidenceUrl') or '').strip()
    scope = str(candidate.get('contact_scope') or candidate.get('scope') or '').strip().lower()
    provenance = str(candidate.get('provenance') or '').strip().lower()

    if channel != 'email':
        reasons.append('unsupported_contact_channel')
    if not evidence_url:
        reasons.append('missing_evidence_url')
    elif not _is_absolute_public_url(evidence_url):
        reasons.append('invalid_evidence_url')
    if not purpose:
        reasons.append('missing_purpose')
    elif purpose not in ALLOWED_CONTACT_PURPOSES:
        reasons.append('invalid_purpose')
    if candidate.get('is_public_business_contact') is not True:
        reasons.append('not_public_business_contact')
    if scope not in ALLOWED_CONTACT_SCOPES:
        reasons.append('private_or_unspecified_scope')
    if candidate.get('is_guessed') is True or provenance in GUESSED_PROVENANCE:
        reasons.append('guessed_contact')

    try:
        validate_email(value)
    except ValidationError:
        reasons.append('invalid_email')
    else:
        domain = value.rsplit('@', 1)[-1].lower()
        if domain in PERSONAL_EMAIL_DOMAINS:
            reasons.append('personal_email_provider')

    # Stable ordering makes fixture reports and tests deterministic.
    return list(dict.fromkeys(reasons))


def extract_contact_candidates(event):
    """Read the preferred schema plus an evidence-bound legacy email shape.

    Preferred input::

        contact_points: [{channel, value, purpose, evidence_url,
                          contact_scope, provenance,
                          is_public_business_contact}]

    Legacy values are considered only when the event/contact object also
    supplies the same explicit evidence and policy metadata. Phone/WeChat/QQ
    legacy fields are intentionally ignored.
    """
    explicit = event.get('contact_points')
    if isinstance(explicit, list):
        return [dict(item) for item in explicit if isinstance(item, dict)]

    contact = event.get('contact') if isinstance(event.get('contact'), dict) else {}
    common = {
        'purpose': event.get('contact_purpose') or contact.get('purpose'),
        'evidence_url': event.get('contact_evidence_url') or contact.get('evidence_url'),
        'contact_scope': event.get('contact_scope') or contact.get('scope'),
        'provenance': event.get('contact_provenance') or contact.get('provenance'),
        'is_public_business_contact': (
            event.get('contact_is_public_business_contact')
            if 'contact_is_public_business_contact' in event
            else contact.get('is_public_business_contact')
        ),
        'verification_status': event.get('contact_verification_status') or contact.get('verification_status'),
        'confidence': event.get('contact_confidence') or contact.get('confidence'),
    }
    candidates = []
    for value in (
        event.get('contact_email'),
        event.get('contact_ai_email'),
        contact.get('official_email'),
        contact.get('ai_dept_email'),
    ):
        if value:
            candidates.append({'channel': 'email', 'value': value, **common})
    return candidates


def _parse_eval_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).date()
    except ValueError:
        try:
            return date.fromisoformat(str(value)[:10])
        except ValueError:
            return None


def evaluate_quality_fixture(payload):
    """Evaluate OR-10 cases and return a deterministic JSON-serializable report."""
    meta = payload.get('meta') if isinstance(payload.get('meta'), dict) else {}
    as_of = _parse_eval_date(meta.get('as_of') or meta.get('asOf')) or date.today()
    seen = {}
    results = []
    issue_counts = {}

    for item in payload.get('cases', []):
        issues = []
        key = canonical_event_key(item)
        if key in seen:
            issues.append('duplicate')
        else:
            seen[key] = item.get('id')

        event_date = _parse_eval_date(item.get('event_date') or item.get('date') or item.get('startsAt'))
        if event_date and event_date < as_of:
            issues.append('expired')

        source_type = str(item.get('source_type') or item.get('sourceType') or '').strip()
        if source_type not in OFFICIAL_SOURCE_TYPES:
            issues.append('no_official_source')

        accepted_contacts = 0
        contact_rejections = []
        for index, candidate in enumerate(extract_contact_candidates(item)):
            reasons = validate_contact_candidate(candidate)
            if reasons:
                contact_rejections.append({'index': index, 'reasons': reasons})
                issues.extend(reasons)
            else:
                accepted_contacts += 1

        issues = list(dict.fromkeys(issues))
        for issue in issues:
            issue_counts[issue] = issue_counts.get(issue, 0) + 1
        expected = item.get('expected') if isinstance(item.get('expected'), dict) else {}
        expected_issues = expected.get('issues', [])
        passed = sorted(issues) == sorted(expected_issues) and accepted_contacts == expected.get('accepted_contacts', 0)
        results.append({
            'id': item.get('id'),
            'issues': issues,
            'accepted_contacts': accepted_contacts,
            'contact_rejections': contact_rejections,
            'expected_issues': expected_issues,
            'passed': passed,
        })

    return {
        'fixture_version': meta.get('version', 'unknown'),
        'as_of': as_of.isoformat(),
        'total': len(results),
        'passed': sum(1 for item in results if item['passed']),
        'failed': sum(1 for item in results if not item['passed']),
        'issue_counts': dict(sorted(issue_counts.items())),
        'results': results,
    }
