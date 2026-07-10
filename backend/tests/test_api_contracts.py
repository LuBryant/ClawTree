from types import SimpleNamespace

from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIRequestFactory

from home.api_contracts import (
    claim_idempotency,
    mutation_meta,
    require_mutation_contract,
)


@override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
class ApiContractTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def _request(self, body=None, **headers):
        request = self.factory.post('/api/test/', body or {}, format='json', **headers)
        request.data = body or {}
        request.user = SimpleNamespace(is_authenticated=False)
        return request

    def test_mutation_requires_idempotency_and_input_version(self):
        response = require_mutation_contract(self._request(), 'proposal-generate')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error']['code'], 'mutation_contract_required')
        self.assertEqual(response.data['externalSideEffect'], False)

    def test_audit_id_is_stable_for_same_action_and_key(self):
        request = self._request(
            {'input_version': 'v1'},
            HTTP_IDEMPOTENCY_KEY='same-key',
            HTTP_X_CLAWTREE_OPERATOR='ops@example',
        )
        first = mutation_meta(request, 'proposal-generate')
        second = mutation_meta(request, 'proposal-generate')
        self.assertEqual(first['audit_id'], second['audit_id'])
        self.assertEqual(first['operator'], 'ops@example')

    def test_reusing_key_with_different_body_is_conflict(self):
        first = self._request({'input_version': 'v1', 'value': 1}, HTTP_IDEMPOTENCY_KEY='collision')
        second = self._request({'input_version': 'v1', 'value': 2}, HTTP_IDEMPOTENCY_KEY='collision')
        self.assertIsNone(claim_idempotency(first, 'batch-approve'))
        response = claim_idempotency(second, 'batch-approve')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['error']['code'], 'idempotency_key_conflict')
