"""AIX-07..13 deterministic intelligence backed by inspectable evidence.

This module deliberately stores public references, hashes and short quotes only.
It never persists prompts, chain-of-thought, contact data, or full downloaded HTML.
"""

from collections import deque
from datetime import datetime, time as datetime_time
from hashlib import sha256
from html.parser import HTMLParser
import ipaddress
import json
import re
import socket
from urllib.parse import urljoin, urlparse

import requests
from django.db import transaction
from django.utils import timezone

from .models import (
    AgentRun,
    AgentWorkflowRun,
    Capability,
    CollaborationMatch,
    EvidenceClaim,
    EvidenceRelation,
    EvidenceSource,
    Opportunity,
    Proposal,
    UniversityEvent,
    WebResearchDocument,
)


MAX_RESEARCH_BYTES = 1_000_000
MAX_REDIRECTS = 3
INJECTION_PATTERNS = {
    'instruction_override': re.compile(r'ignore\s+(?:all\s+)?previous|忽略(?:以上|之前|系统)', re.I),
    'secret_exfiltration': re.compile(r'(?:reveal|print|输出|泄露).{0,24}(?:secret|api.?key|system prompt|密钥|提示词)', re.I),
    'tool_coercion': re.compile(r'(?:call|invoke|execute|调用|执行).{0,24}(?:tool|shell|function|工具|命令)', re.I),
}


def _digest(value):
    return sha256(str(value).encode('utf-8')).hexdigest()


def _source_data(source):
    return {
        'sourceId': source.source_id,
        'type': source.source_type,
        'title': source.title,
        'url': source.url,
        'domain': source.domain,
        'official': source.is_official,
        'authorityScore': source.authority_score,
        'contentHash': source.content_hash,
        'retrievedAt': source.retrieved_at.isoformat(),
    }


def _claim_data(claim):
    return {
        'claimId': claim.claim_id,
        'subject': {'type': claim.subject_type, 'id': claim.subject_id},
        'predicate': claim.predicate,
        'value': claim.value,
        'quote': claim.quote,
        'status': claim.status,
        'checkedAt': claim.checked_at.isoformat(),
        'validFrom': claim.valid_from.isoformat() if claim.valid_from else None,
        'validUntil': claim.valid_until.isoformat() if claim.valid_until else None,
        'source': _source_data(claim.source),
    }


def _upsert_source(workspace, source_id, source_type, title, url, content, **extra):
    defaults = {
        'source_type': source_type,
        'title': title[:500],
        'url': url or '',
        'domain': (urlparse(url).hostname or '').lower() if url else '',
        'content_hash': _digest(content),
        'retrieved_at': timezone.now(),
        **extra,
    }
    source, _ = EvidenceSource.objects.update_or_create(
        workspace=workspace, source_id=source_id, defaults=defaults,
    )
    return source


def _upsert_claim(workspace, claim_id, subject_type, subject_id, predicate, value, source, quote, **extra):
    claim, _ = EvidenceClaim.objects.update_or_create(
        workspace=workspace,
        claim_id=claim_id,
        defaults={
            'subject_type': subject_type,
            'subject_id': str(subject_id),
            'predicate': predicate,
            'value': value,
            'source': source,
            'quote': str(quote)[:2000],
            'checked_at': timezone.now(),
            **extra,
        },
    )
    return claim


def _edge(workspace, from_kind, from_id, relation_type, to_kind, to_id, claim, metadata=None):
    return EvidenceRelation.objects.get_or_create(
        workspace=workspace,
        from_kind=from_kind,
        from_id=str(from_id),
        relation_type=relation_type,
        to_kind=to_kind,
        to_id=str(to_id),
        via_claim=claim,
        defaults={'metadata': metadata or {}},
    )[0]


@transaction.atomic
def ensure_event_evidence_graph(workspace, event, capabilities=(), proposal=None):
    """Create the minimum connected graph for one event and its proposal."""
    event_text = ' | '.join(filter(None, [
        event.title, event.university, event.description, event.category, event.event_type,
        event.location, str(event.event_date or ''), event.registration_status,
    ]))
    event_source = _upsert_source(
        workspace, f'event:{event.id}', 'event', event.title, event.source_url, event_text,
        is_official=True, authority_score=90,
        metadata={'recordType': 'UniversityEvent', 'recordId': event.id},
    )
    event_topic = _upsert_claim(
        workspace, f'event:{event.id}:topic', 'event', event.id, 'topic',
        {'title': event.title, 'category': event.category, 'eventType': event.event_type},
        event_source, ' — '.join(filter(None, [event.title, event.description[:500]])),
    )
    university = _upsert_claim(
        workspace, f'event:{event.id}:university', 'event', event.id, 'hostUniversity',
        event.university, event_source, f'{event.university}｜{event.title}',
    )
    registration = _upsert_claim(
        workspace, f'event:{event.id}:registration', 'event', event.id, 'registrationStatus',
        event.registration_status, event_source,
        f'registration_status={event.registration_status}; registration_url={event.registration_url or "unknown"}',
        status='verified' if event.registration_status != 'unknown' else 'unknown',
    )
    _edge(workspace, 'organization', event.university, 'hosts', 'event', event.id, university)
    _edge(workspace, 'event', event.id, 'has_topic', 'claim', event_topic.claim_id, event_topic)
    _edge(workspace, 'event', event.id, 'has_registration_status', 'claim', registration.claim_id, registration)

    capability_claims = []
    for capability in capabilities:
        capability_text = ' | '.join(filter(None, [
            capability.title, capability.title_en, capability.boundary, capability.boundary_en,
            *capability.source_ids,
        ]))
        capability_source = _upsert_source(
            workspace, f'capability:{capability.id}', 'capability', capability.title, '', capability_text,
            is_official=True, authority_score=95,
            metadata={'recordType': 'Capability', 'recordId': capability.id, 'approved': capability.approved},
        )
        capability_claim = _upsert_claim(
            workspace, f'capability:{capability.id}:scope', 'capability', capability.id, 'approvedScope',
            {'title': capability.title, 'boundary': capability.boundary}, capability_source,
            '；'.join(filter(None, [capability.title, capability.boundary or '具体资源需人工确认'])),
            valid_until=timezone.make_aware(datetime.combine(capability.valid_until, datetime_time.max)),
            status='verified' if capability.approved and capability.valid_until >= timezone.localdate() else 'expired',
        )
        capability_claims.append(capability_claim)
        _edge(workspace, 'workspace', workspace.id, 'has_capability', 'capability', capability.id, capability_claim)
        _edge(workspace, 'capability', capability.id, 'can_support', 'event', event.id, capability_claim)

    if proposal:
        referenced_ids = set(proposal.source_refs or [])
        linked_claims = [event_topic, university, registration, *capability_claims]
        for claim in linked_claims:
            if claim.source.source_id in referenced_ids:
                _edge(workspace, 'proposal', proposal.id, 'justified_by', 'claim', claim.claim_id, claim)
        if proposal.status in {'awaiting_approval', 'approved', 'rejected'}:
            approval_claim = _upsert_claim(
                workspace, f'proposal:{proposal.id}:approval', 'proposal', proposal.id, 'approvalStatus',
                proposal.status, event_source,
                f'proposal_status={proposal.status}; named_human_review={bool(proposal.edited_by or proposal.approved_at)}',
                status='verified',
            )
            _edge(workspace, 'proposal', proposal.id, 'has_approval', 'approval', proposal.status, approval_claim)

    return {
        'event': event_topic,
        'university': university,
        'registration': registration,
        'capabilities': capability_claims,
    }


def graph_for_workspace(workspace, *, root_kind=None, root_id=None, max_depth=4):
    relations = list(EvidenceRelation.objects.filter(workspace=workspace).select_related(
        'via_claim', 'via_claim__source',
    ))
    if root_kind is None or root_id is None:
        chosen = relations
    else:
        root = (str(root_kind), str(root_id))
        queue = deque([(root, 0)])
        visited = {root}
        chosen = []
        while queue:
            node, depth = queue.popleft()
            if depth >= max_depth:
                continue
            for relation in relations:
                left = (relation.from_kind, relation.from_id)
                right = (relation.to_kind, relation.to_id)
                if node not in {left, right}:
                    continue
                chosen.append(relation)
                neighbour = right if node == left else left
                if neighbour not in visited:
                    visited.add(neighbour)
                    queue.append((neighbour, depth + 1))
        chosen = list({item.id: item for item in chosen}.values())
    claims = {item.via_claim_id: item.via_claim for item in chosen}
    nodes = set()
    for item in chosen:
        nodes.add((item.from_kind, item.from_id))
        nodes.add((item.to_kind, item.to_id))
    return {
        'root': {'kind': root_kind, 'id': str(root_id)} if root_kind is not None and root_id is not None else None,
        'nodes': [{'kind': kind, 'id': identifier} for kind, identifier in sorted(nodes)],
        'edges': [{
            'from': {'kind': item.from_kind, 'id': item.from_id},
            'type': item.relation_type,
            'to': {'kind': item.to_kind, 'id': item.to_id},
            'claimId': item.via_claim.claim_id,
        } for item in chosen],
        'claims': [_claim_data(claim) for claim in claims.values()],
        'orphanClaimCount': EvidenceClaim.objects.filter(workspace=workspace, relations__isnull=True).count(),
    }


@transaction.atomic
def compose_opportunity(workspace, event, capabilities):
    graph = ensure_event_evidence_graph(workspace, event, capabilities)
    supports = [graph['event'], *graph['capabilities']]
    if len(supports) < 2:
        supports.append(graph['university'])
    counter = next(
        (claim for claim in graph['capabilities'] if (claim.value or {}).get('boundary')),
        graph['registration'],
    )
    missing = []
    if not event.event_date:
        missing.append('What is the confirmed event date? / 活动日期是否最终确认？')
    if not event.location:
        missing.append('Is the event online or onsite? / 活动线上还是线下？')
    if event.registration_status == 'unknown':
        missing.append('Is registration currently open on the official page? / 官方报名是否仍开放？')
    if not missing:
        missing.append('Which resources and decision owners are formally approved? / 哪些资源和决策人已正式确认？')
    opportunity, _ = Opportunity.objects.get_or_create(
        workspace=workspace,
        event=event,
        schema_version='opportunity-v1',
        defaults={
            'hypothesis': f'围绕“{event.title}”与 {event.university} 设计分阶段合作，可将已审核能力转化为可验证的活动与内容成果。',
            'target_audiences': [f'{event.university} 学生与组织者', 'AI / Web3 ecosystem partners'],
            'missing_facts': missing,
            'success_metrics': [{
                'name': 'human_accepted_proposal',
                'target': '>=1 approved tier',
                'measurement': 'Proposal reaches approved status after named human review.',
            }],
        },
    )
    opportunity.supporting_claims.set(supports[:max(2, len(supports))])
    opportunity.counter_claims.set([counter])
    return opportunity


def opportunity_data(opportunity):
    return {
        'opportunityId': str(opportunity.opportunity_id),
        'schemaVersion': opportunity.schema_version,
        'eventId': opportunity.event_id,
        'hypothesis': opportunity.hypothesis,
        'targetAudiences': opportunity.target_audiences,
        'supportingEvidence': [_claim_data(item) for item in opportunity.supporting_claims.select_related('source')],
        'counterEvidence': [_claim_data(item) for item in opportunity.counter_claims.select_related('source')],
        'missingFacts': opportunity.missing_facts,
        'successMetrics': opportunity.success_metrics,
        'status': opportunity.status,
        'modelVersion': opportunity.model_version,
    }


def rank_events(workspace, events, capabilities, top_k=5):
    terms = ('ai', '人工智能', 'web3', '区块链', '机器人', '财经', 'hackathon', '黑客松')
    capability_text = ' '.join(
        f'{item.title} {item.title_en} {item.boundary} {item.boundary_en}'.lower() for item in capabilities
    )
    ranked = []
    for event in events:
        graph = ensure_event_evidence_graph(workspace, event, capabilities)
        event_text = f'{event.title} {event.description} {event.category} {event.event_type}'.lower()
        overlap = sum(term in event_text and term in capability_text for term in terms)
        scores = {
            'theme': min(100, 50 + overlap * 12) if capabilities else 20,
            'audience': 85 if event.university else 20,
            'timing': 85 if event.event_date else 30,
            'city': 80 if event.location else 35,
            'resources': min(100, 35 + len(capabilities) * 15) if capabilities else 15,
            'information': round(100 * sum(bool(v) for v in (
                event.title, event.university, event.description, event.source_url, event.event_date, event.location,
            )) / 6),
        }
        overall = round(sum(scores.values()) / len(scores))
        base_refs = [graph['event'].claim_id, *[item.claim_id for item in graph['capabilities']]]
        ranked.append({
            'eventId': event.id,
            'eventTitle': event.title,
            'university': event.university,
            'overallScore': overall,
            'dimensions': {
                key: {'score': value, 'claimIds': base_refs if key in {'theme', 'resources'} else [graph['event'].claim_id]}
                for key, value in scores.items()
            },
            'whyThis': f'{overlap} 个主题信号与 {len(capabilities)} 项已审核能力共同支持该候选。',
            'riskClaimIds': [graph['registration'].claim_id],
        })
    ranked.sort(key=lambda item: (-item['overallScore'], item['eventId']))
    selected = ranked[:max(1, min(int(top_k), 20))]
    for index, item in enumerate(selected):
        alternative = next((candidate for candidate in ranked if candidate['eventId'] != item['eventId']), None)
        item['rank'] = index + 1
        item['alternative'] = ({
            'eventId': alternative['eventId'],
            'eventTitle': alternative['eventTitle'],
            'scoreDelta': item['overallScore'] - alternative['overallScore'],
            'whyNot': '六维总分较低；请展开各分项引用核验差距。',
        } if alternative else None)
    return selected


@transaction.atomic
def simulate_proposal(proposal):
    """Upgrade existing tiers in-place to the AIX-10 versioned simulation schema."""
    source_refs = list(proposal.source_refs)
    tier_specs = {
        'light': {'cost': 'USD 0–500 estimate', 'deliverable': '公开信息核验与活动回顾框架', 'target': '1 reviewed recap'},
        'medium': {'cost': 'USD 500–2,000 estimate', 'deliverable': '议题共创与线上内容联动方案', 'target': '1 approved session plan'},
        'deep': {'cost': 'USD 2,000–10,000 estimate', 'deliverable': '联合活动/黑客松执行蓝图', 'target': '1 human-approved execution plan'},
    }
    enriched = []
    for package in proposal.packages:
        spec = tier_specs[package['name']]
        enriched.append({
            **package,
            'workspaceResources': list(package.get('resources') or []),
            'partnerResources': ['Named decision owner', 'Official event facts', 'Approved venue/channel'],
            'estimatedCost': spec['cost'],
            'costStatus': 'estimate_requires_human_confirmation',
            'risks': list(proposal.risks) or ['Resource availability is not confirmed.'],
            'deliverables': [spec['deliverable']],
            'kpis': [{'name': 'tier_delivery', 'target': spec['target'], 'measurement': 'Human-reviewed delivery record'}],
            'resourceGaps': list(proposal.pending_questions) or ['Named resource owners are not confirmed.'],
            'nonCommitments': ['No guaranteed prize, exposure, investment, speaker, venue, or organizer status.'],
            'citations': source_refs,
        })
    proposal.packages = enriched
    proposal.guardrail_checks = {
        **proposal.guardrail_checks,
        'resourceGapsDeclared': True,
        'nonCommitmentsDeclared': True,
        'citationCoverage': all(item['citations'] == source_refs and bool(source_refs) for item in enriched),
    }
    proposal.edit_summary = 'AIX-10 simulator added cost, resources, risks, deliverables, KPI, gaps and non-commitments.'
    proposal.save(update_fields=['packages', 'guardrail_checks', 'edit_summary', 'updated_at'])
    capabilities = list(proposal.match.workspace.capabilities.filter(approved=True))
    ensure_event_evidence_graph(proposal.match.workspace, proposal.match.event, capabilities, proposal=proposal)
    return proposal


def judge_replay(workflow):
    """Strict allowlist replay: versions and receipts, never prompts/CoT/raw inputs."""
    runs = AgentRun.objects.filter(
        workspace=workflow.workspace,
        input_snapshot__traceId=str(workflow.run_id),
    ).order_by('created_at')
    run_data = []
    for run in runs:
        verifier_summary = None
        if run.task_type in {'verifier', 'proposal_verifier'}:
            output = run.structured_output or {}
            verifier_summary = {
                key: output.get(key) for key in (
                    'passed', 'decisionStatus', 'reasonCodes', 'repairAttempts',
                    'initialReasonCodes', 'needsReview',
                ) if key in output
            }
        run_data.append({
            'runId': str(run.run_id),
            'task': run.task_type,
            'status': run.status,
            'schema': {'name': run.schema_name, 'version': run.schema_version},
            'model': {'provider': run.model_provider, 'name': run.model_name, 'version': run.model_version},
            'sourceIds': list(run.input_references),
            'citations': list(run.citations),
            'latencyMs': run.latency_ms,
            'usage': {
                'inputTokens': run.input_tokens,
                'outputTokens': run.output_tokens,
                'cachedInputTokens': run.cached_input_tokens,
                'costMicrousd': run.cost_microusd,
            },
            'fallback': run.status == 'fallback',
            'errorCode': run.error_code,
            'verifierSummary': verifier_summary,
            'humanFeedback': {
                'reasonCodes': list((run.human_feedback or {}).get('reasonCodes') or []),
                'reviewed': bool(run.feedback_at),
                'reviewedAt': run.feedback_at.isoformat() if run.feedback_at else None,
            },
        })
    proposal = workflow.proposal
    return {
        'workflow': {
            'runId': str(workflow.run_id),
            'status': workflow.status,
            'checkpoint': workflow.checkpoint,
            'schemaVersion': workflow.schema_version,
            'promptVersion': workflow.prompt_version,
            'provider': workflow.provider_name,
            'sourceIds': list(workflow.source_ids),
            'verifier': workflow.verifier,
            'externalSideEffect': False,
        },
        'runs': run_data,
        'humanReview': {
            'matchStatus': workflow.match.status if workflow.match else None,
            'matchReviewed': bool(workflow.match and workflow.match.reviewed_at),
            'proposalStatus': proposal.status if proposal else None,
            'editSummary': proposal.edit_summary if proposal else '',
            'proposalApproved': bool(proposal and proposal.approved_at),
        },
        'containsPrompt': False,
        'containsChainOfThought': False,
        'containsPII': False,
    }


def grounded_copilot(workspace, question, limit=5):
    normalized = re.sub(r'\s+', ' ', str(question or '').strip().lower())
    if not normalized:
        return {'decisionStatus': 'unknown', 'answer': 'Please provide a question. / 请提供问题。', 'citations': []}
    stopwords = {
        'what', 'when', 'where', 'which', 'who', 'why', 'how', 'the', 'is', 'are', 'was', 'were',
        'does', 'did', 'can', 'could', 'would', 'about', 'this', 'that', 'please',
    }
    terms = {
        term for term in re.findall(r'[a-z0-9]{2,}|[\u4e00-\u9fff]{2,}', normalized)
        if term not in stopwords
    }
    required_matches = 1 if len(terms) <= 1 else 2
    scored = []
    now = timezone.now()
    for claim in EvidenceClaim.objects.filter(workspace=workspace).select_related('source'):
        if claim.status not in {'verified', 'conflict'} or (claim.valid_until and claim.valid_until < now):
            continue
        haystack = f'{claim.predicate} {json.dumps(claim.value, ensure_ascii=False)} {claim.quote}'.lower()
        score = sum(term in haystack for term in terms)
        if normalized in haystack:
            score += 3
        if score >= required_matches:
            scored.append((score, claim))
    scored.sort(key=lambda item: (-item[0], -item[1].source.authority_score, item[1].claim_id))
    selected = [item[1] for item in scored[:max(1, min(int(limit), 8))]]
    if not selected:
        return {
            'decisionStatus': 'unknown',
            'answer': '现有证据无法回答该问题，请查看官方来源或转人工核验。 / The available evidence cannot answer this question; please verify with an official source or a human reviewer.',
            'citations': [],
            'needsHumanReview': True,
        }
    answer = '；'.join(f'{claim.predicate}: {claim.quote}' for claim in selected)
    return {
        'decisionStatus': 'known',
        'answer': answer,
        'citations': [_claim_data(claim) for claim in selected],
        'needsHumanReview': any(claim.status == 'conflict' for claim in selected),
    }


class _VisibleTextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hidden = 0
        self.title_depth = 0
        self.title_parts = []
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'style', 'noscript', 'svg'}:
            self.hidden += 1
        if tag == 'title':
            self.title_depth += 1

    def handle_endtag(self, tag):
        if tag in {'script', 'style', 'noscript', 'svg'} and self.hidden:
            self.hidden -= 1
        if tag == 'title' and self.title_depth:
            self.title_depth -= 1

    def handle_data(self, data):
        if not self.hidden and data.strip():
            self.parts.append(data.strip())
            if self.title_depth:
                self.title_parts.append(data.strip())


def _validate_public_url(url):
    parsed = urlparse(str(url or ''))
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('unsafe_url')
    host = parsed.hostname.rstrip('.').lower()
    if host in {'localhost', 'localhost.localdomain'}:
        raise ValueError('private_network')
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(host, parsed.port or 443, type=socket.SOCK_STREAM)}
    except socket.gaierror as error:
        raise ValueError('dns_resolution_failed') from error
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            raise ValueError('private_network')
    return parsed


def _official_score(host):
    host = host.lower()
    if host.endswith(('.gov.cn', '.gov', '.edu.cn', '.edu')):
        return 100
    if host.endswith(('.org.cn', '.org')):
        return 65
    return 50


@transaction.atomic
def research_official_page(workspace, url, *, session=None):
    """Fetch a bounded public page, validating every redirect before following it."""
    requested_url = str(url or '')[:1000]
    document = WebResearchDocument(workspace=workspace, requested_url=requested_url, status='rejected')
    session = session or requests.Session()
    current = requested_url
    try:
        for redirect_count in range(MAX_REDIRECTS + 1):
            parsed = _validate_public_url(current)
            response = session.get(
                current, timeout=(3, 8), allow_redirects=False, stream=True,
                headers={'User-Agent': 'ClawTreeEvidenceResearch/1.0'},
            )
            if response.status_code in {301, 302, 303, 307, 308}:
                if redirect_count >= MAX_REDIRECTS:
                    raise ValueError('too_many_redirects')
                location = response.headers.get('Location')
                if not location:
                    raise ValueError('redirect_without_location')
                current = urljoin(current, location)
                continue
            if response.status_code != 200:
                raise ValueError(f'http_status_{response.status_code}')
            content_type = response.headers.get('Content-Type', '').split(';')[0].strip().lower()
            if content_type not in {'text/html', 'text/plain'}:
                raise ValueError('unsupported_content_type')
            declared = response.headers.get('Content-Length')
            if declared and int(declared) > MAX_RESEARCH_BYTES:
                raise ValueError('response_too_large')
            body = bytearray()
            for chunk in response.iter_content(16384):
                body.extend(chunk)
                if len(body) > MAX_RESEARCH_BYTES:
                    raise ValueError('response_too_large')
            encoding = response.encoding or 'utf-8'
            text = bytes(body).decode(encoding, errors='replace')
            if content_type == 'text/html':
                parser = _VisibleTextParser()
                parser.feed(text)
                title = ' '.join(parser.title_parts)
                visible = ' '.join(parser.parts)
            else:
                title = parsed.hostname or ''
                visible = text
            visible = re.sub(r'\s+', ' ', visible).strip()
            flags = [code for code, pattern in INJECTION_PATTERNS.items() if pattern.search(visible)]
            if flags:
                document.injection_flags = flags
                raise ValueError('prompt_injection_detected')
            if not visible:
                raise ValueError('empty_body')
            final_parsed = _validate_public_url(current)
            score = _official_score(final_parsed.hostname)
            body_hash = _digest(visible)
            source_id = f'web:{body_hash[:24]}'
            source = _upsert_source(
                workspace, source_id, 'official_web' if score >= 75 else 'public_web',
                title or final_parsed.hostname, current, visible,
                is_official=score >= 75, authority_score=score,
                metadata={'contentType': content_type, 'contentBytes': len(body)},
            )
            document.source = source
            document.final_url = current
            document.domain = final_parsed.hostname.lower()
            document.status = 'verified'
            document.official_score = score
            document.content_type = content_type
            document.content_bytes = len(body)
            document.body_sha256 = body_hash
            document.title = (title or final_parsed.hostname)[:500]
            document.excerpt = visible[:2000]
            document.rejection_reason = ''
            document.save()
            critical_patterns = {
                'registration': re.compile(r'\bregister|registration|apply|报名|申请', re.I),
                'deadline': re.compile(r'\bdeadline|closes?|截止|结束日期', re.I),
                'organizer': re.compile(r'\borganizers?|hosted by|主办|承办', re.I),
            }
            sentences = [
                item.strip() for item in re.split(r'(?<=[.!?。！？；;])\s*', visible[:10000]) if item.strip()
            ]
            for index, sentence in enumerate(sentences):
                for predicate, pattern in critical_patterns.items():
                    if not pattern.search(sentence):
                        continue
                    claim = _upsert_claim(
                        workspace,
                        f'{source_id}:{predicate}:{index}',
                        'web_document',
                        document.id,
                        predicate,
                        sentence,
                        source,
                        sentence,
                        status='verified',
                    )
                    _edge(
                        workspace, 'web_document', document.id, f'asserts_{predicate}',
                        'source', source.source_id, claim,
                    )
            return document
        raise ValueError('too_many_redirects')
    except (ValueError, requests.RequestException) as error:
        document.rejection_reason = str(error)[:160] or type(error).__name__
        document.status = 'rejected'
        document.save()
        return document


def research_document_data(document):
    return {
        'id': document.id,
        'requestedUrl': document.requested_url,
        'finalUrl': document.final_url,
        'domain': document.domain,
        'status': document.status,
        'officialScore': document.official_score,
        'selectionReason': (
            'Official education/government domain is preferred.' if document.official_score >= 75
            else 'Public source; confirm against an official domain before using critical claims.'
        ),
        'contentType': document.content_type,
        'contentBytes': document.content_bytes,
        'bodySha256': document.body_sha256,
        'title': document.title,
        'excerpt': document.excerpt,
        'injectionFlags': document.injection_flags,
        'rejectionReason': document.rejection_reason,
        'source': _source_data(document.source) if document.source else None,
        'fetchedAt': document.fetched_at.isoformat(),
    }
