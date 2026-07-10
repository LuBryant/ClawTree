"""Shared mutation contract helpers for ClawTree APIs.

The helpers deliberately keep audit metadata out of business payloads while
making every state-changing response traceable and safe to retry.
"""
import hashlib
import json
import uuid

from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


CONTRACT_VERSION = '2026-07-11'
IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60


def request_operator(request):
    user = getattr(request, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        return user.get_username()
    return (
        request.headers.get('X-ClawTree-Operator')
        or request.data.get('operator')
        or request.data.get('reviewer')
        or 'anonymous'
    )


def input_version(request):
    return request.headers.get('X-Input-Version') or request.data.get('input_version') or CONTRACT_VERSION


def idempotency_key(request):
    return request.headers.get('Idempotency-Key') or request.data.get('idempotency_key') or ''


def audit_id(request, action):
    key = idempotency_key(request)
    if key:
        digest = hashlib.sha256(f'{action}:{key}'.encode()).hexdigest()[:20]
        return f'audit_{digest}'
    return f'audit_{uuid.uuid4().hex}'


def mutation_meta(request, action, *, external_side_effect=False):
    return {
        'audit_id': audit_id(request, action),
        'operator': request_operator(request),
        'input_version': input_version(request),
        'idempotency_key': idempotency_key(request),
        'contract_version': CONTRACT_VERSION,
        'externalSideEffect': external_side_effect,
    }


def error_response(request, action, code, detail, *, http_status=status.HTTP_400_BAD_REQUEST, fields=None):
    payload = mutation_meta(request, action)
    payload['error'] = {
        'code': code,
        'detail': detail,
        'fields': fields or {},
    }
    return Response(payload, status=http_status)


def success_response(request, action, data=None, *, http_status=status.HTTP_200_OK, external_side_effect=False):
    payload = mutation_meta(request, action, external_side_effect=external_side_effect)
    payload['data'] = data or {}
    return Response(payload, status=http_status)


def require_mutation_contract(request, action):
    """Require explicit retry and schema semantics for new mutation APIs."""
    missing = []
    if not idempotency_key(request):
        missing.append('Idempotency-Key')
    if not (request.headers.get('X-Input-Version') or request.data.get('input_version')):
        missing.append('X-Input-Version')
    if missing:
        return error_response(
            request,
            action,
            'mutation_contract_required',
            'State-changing requests require idempotency and input-version metadata.',
            fields={'missing': missing},
        )
    return None


def idempotency_fingerprint(request, action):
    body = json.dumps(request.data, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(f'{action}:{body}'.encode()).hexdigest()


def claim_idempotency(request, action):
    """Return an error when one key is reused for a different mutation body."""
    key = idempotency_key(request)
    if not key:
        return None
    cache_key = f'clawtree:idempotency:{action}:{key}'
    fingerprint = idempotency_fingerprint(request, action)
    existing = cache.get(cache_key)
    if existing and existing != fingerprint:
        return error_response(
            request,
            action,
            'idempotency_key_conflict',
            'The idempotency key was already used with a different request body.',
            http_status=status.HTTP_409_CONFLICT,
        )
    cache.set(cache_key, fingerprint, IDEMPOTENCY_TTL_SECONDS)
    return None


def clawtree_exception_handler(exc, context):
    """Normalize DRF errors without exposing tracebacks or provider secrets."""
    response = exception_handler(exc, context)
    if response is None:
        return None
    request = context.get('request')
    detail = response.data
    response.data = {
        'error': {
            'code': getattr(exc, 'default_code', 'request_error'),
            'detail': detail,
            'fields': detail if isinstance(detail, dict) else {},
        },
        'audit_id': audit_id(request, 'drf-exception') if request else f'audit_{uuid.uuid4().hex}',
        'externalSideEffect': False,
        'contract_version': CONTRACT_VERSION,
    }
    return response
