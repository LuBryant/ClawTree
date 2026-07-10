import json
import re
from html import unescape
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .schema import EventEvidence, OpportunityEvent, SourceCandidate


UNIVERSITY_PATTERN = re.compile(
    r'([\u4e00-\u9fffA-Za-z· ]{2,40}(?:大学|学院|University|College))',
    re.IGNORECASE,
)
DATE_PATTERN = re.compile(r'(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})日?')


def _json_ld_events(soup):
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            payload = json.loads(script.string or script.get_text())
        except (TypeError, json.JSONDecodeError):
            continue
        nodes = payload if isinstance(payload, list) else [payload]
        while nodes:
            node = nodes.pop(0)
            if not isinstance(node, dict):
                continue
            graph = node.get('@graph')
            if isinstance(graph, list):
                nodes.extend(graph)
            node_type = node.get('@type', '')
            types = node_type if isinstance(node_type, list) else [node_type]
            event_types = {'Hackathon', 'Festival', 'EducationEvent', 'BusinessEvent', 'SocialEvent'}
            if any('Event' in str(value) or str(value) in event_types for value in types):
                yield node


def _name(value):
    if isinstance(value, dict):
        return str(value.get('name') or value.get('legalName') or '').strip()
    if isinstance(value, list):
        return ' / '.join(filter(None, (_name(item) for item in value)))
    return str(value or '').strip()


def _location(value):
    if isinstance(value, list):
        return ' / '.join(filter(None, (_location(item) for item in value)))
    if isinstance(value, dict):
        name = _name(value)
        address = value.get('address', '')
        if isinstance(address, dict):
            address = ' '.join(str(address.get(key, '')).strip() for key in (
                'addressRegion', 'addressLocality', 'streetAddress',
            )).strip()
        return ' '.join(part for part in (name, str(address).strip()) if part)
    return str(value or '').strip()


def _registration_url(event, source_url):
    direct = event.get('registrationUrl') or event.get('url')
    offers = event.get('offers')
    if not direct and isinstance(offers, dict):
        direct = offers.get('url')
    if not direct and isinstance(offers, list):
        direct = next((item.get('url') for item in offers if isinstance(item, dict) and item.get('url')), '')
    return urljoin(source_url, str(direct or '').strip()) if direct else ''


def _topic(*values):
    text = ' '.join(str(value or '') for value in values).lower()
    has_ai = any(word in text for word in (' ai ', '人工智能', '机器学习', '大模型', '机器人', 'artificial intelligence'))
    has_web3 = any(word in text for word in ('web3', '区块链', 'blockchain', '智能合约', 'defi', 'dao'))
    if has_ai and has_web3:
        return 'AI+Web3'
    if has_web3:
        return 'Web3'
    if has_ai:
        return 'AI'
    return 'other'


def _format(attendance_mode, text):
    value = str(attendance_mode or '').lower()
    combined = f'{value} {text}'.lower()
    if 'mixed' in value or 'hybrid' in combined or '线上+线下' in combined or '线上线下' in combined:
        return 'hybrid'
    if 'online' in value or any(word in combined for word in ('线上', '直播', '腾讯会议', 'zoom')):
        return 'online'
    if 'offline' in value or any(word in combined for word in ('线下', '会场', '报告厅', '礼堂')):
        return 'offline'
    return 'unknown'


def _event_type(text):
    types = ('黑客松', '分享会', '讲座', '竞赛', '研讨会', '论坛', '工作坊', '夏令营')
    lowered = text.lower()
    aliases = {'hackathon': '黑客松', 'workshop': '工作坊', 'forum': '论坛'}
    for candidate in types:
        if candidate in text:
            return candidate
    return next((canonical for alias, canonical in aliases.items() if alias in lowered), '其他')


def _iso_date(value):
    value = str(value or '').strip()
    if not value:
        return None
    match = DATE_PATTERN.search(value)
    if match:
        return f'{int(match.group(1)):04d}-{int(match.group(2)):02d}-{int(match.group(3)):02d}'
    iso_match = re.match(r'^(20\d{2}-\d{2}-\d{2})', value)
    return iso_match.group(1) if iso_match else None


def _quote(field, value, source_url, raw_json, page_text):
    if value in (None, ''):
        return None
    rendered = str(value)
    if rendered in page_text:
        index = page_text.index(rendered)
        quote = page_text[max(0, index - 40):index + len(rendered) + 80]
    else:
        quote = raw_json[:500]
    return EventEvidence(field=field, url=source_url, quote=quote.strip())


def extract_event(candidate: SourceCandidate, html: str) -> OpportunityEvent:
    """Extract an event without requiring an API key or model provider.

    JSON-LD is preferred because it preserves page-authored facts. Text and
    discovery metadata are only fallbacks, and every populated field carries a
    source-page quote in ``evidence``.
    """
    soup = BeautifulSoup(html or '', 'lxml')
    event = next(_json_ld_events(soup), {})
    for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
        tag.decompose()
    page_text = unescape(' '.join(soup.stripped_strings))
    raw_json = json.dumps(event, ensure_ascii=False, sort_keys=True)

    title = _name(event.get('name')) or candidate.title
    organizer = event.get('organizer') or event.get('sponsor')
    university = _name(organizer)
    if not university:
        match = UNIVERSITY_PATTERN.search(f'{title} {candidate.summary} {page_text}')
        university = match.group(1).strip() if match else ''
    description = str(event.get('description') or candidate.summary or '').strip()
    keywords = event.get('keywords', '')
    topic = _topic(title, description, keywords, page_text[:1000])
    location = _location(event.get('location'))
    attendance_format = _format(event.get('eventAttendanceMode'), f'{location} {page_text[:1000]}')
    starts_at = _iso_date(event.get('startDate'))
    ends_at = _iso_date(event.get('endDate'))
    registration_url = _registration_url(event, candidate.url)

    extracted = {
        'title': title,
        'university': university,
        'topic': topic,
        'format': attendance_format,
        'location': location,
        'starts_at': starts_at,
        'ends_at': ends_at,
        'registration_url': registration_url,
    }
    evidence = tuple(filter(None, (
        _quote(field, value, candidate.url, raw_json, page_text)
        for field, value in extracted.items()
    )))
    raw_evidence = json.dumps({
        'discovery': candidate.to_dict(),
        'structured_data': event,
        'page_text': page_text[:4000],
    }, ensure_ascii=False, sort_keys=True)

    return OpportunityEvent(
        source_id=candidate.source_id,
        source_name=candidate.source_name,
        source_kind=candidate.source_kind,
        source_url=candidate.url,
        title=title,
        university=university,
        topic=topic,
        format=attendance_format,
        location=location,
        starts_at=starts_at,
        ends_at=ends_at,
        registration_url=registration_url,
        description=description,
        event_type=_event_type(f'{title} {description}'),
        evidence=evidence,
        raw_evidence=raw_evidence,
    )
