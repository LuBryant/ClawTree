import claimBundle from '../../data/assistant-claims.json' with { type: 'json' };

export function resolveEntityClaims(entityId, now = new Date(), bundle = claimBundle) {
  const instant = now.toISOString();
  const instantMs = now.getTime();
  const claims = bundle.claims.filter((claim) => claim.entityId === entityId);
  const fields = {};
  for (const claim of claims) {
    const validFromMs = Date.parse(claim.validFrom);
    const validUntilMs = Date.parse(claim.validUntil);
    const current = claim.status === 'verified'
      && Number.isFinite(validFromMs) && Number.isFinite(validUntilMs)
      && validFromMs <= instantMs && validUntilMs >= instantMs;
    const state = claim.status === 'conflicted' || claim.conflictSet
      ? 'conflicted'
      : current ? 'current' : Number.isFinite(validUntilMs) && instantMs > validUntilMs ? 'expired' : 'not_yet_valid';
    const prior = fields[claim.field];
    if (!prior || (prior.state !== 'current' && state === 'current')) fields[claim.field] = { ...claim, state };
  }
  return { entityId, asOf: instant, fields };
}

export function registrationLifecycle(entityId, now = new Date(), bundle = claimBundle) {
  const resolved = resolveEntityClaims(entityId, now, bundle);
  const status = resolved.fields.registrationStatus;
  const deadline = resolved.fields.registrationDeadline;
  const url = resolved.fields.registrationUrl;
  if (status?.state === 'conflicted' || deadline?.state === 'conflicted' || url?.state === 'conflicted') {
    return { state: 'unknown', reason: 'conflicting_claims', resolved };
  }
  const deadlineMs = deadline ? Date.parse(deadline.value) : Number.NaN;
  if (Number.isFinite(deadlineMs) && now.getTime() > deadlineMs) {
    return { state: 'closed', reason: 'deadline_passed', resolved };
  }
  if (status?.state === 'current' && status.value === 'open' && deadline?.state === 'current' && url?.state === 'current') {
    return { state: 'open', reason: null, registrationUrl: url.value, deadline: deadline.value, resolved };
  }
  return { state: 'unknown', reason: 'insufficient_current_claims', resolved };
}

export { claimBundle };
