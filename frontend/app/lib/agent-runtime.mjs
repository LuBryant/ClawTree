import { randomUUID } from 'node:crypto';

export class AgentBudgetLedger {
  #reservations = new Map();

  constructor({ limitMicrousd = 150_000, now = Date.now } = {}) {
    this.limitMicrousd = Math.max(0, limitMicrousd);
    this.now = now;
    this.spentMicrousd = 0;
    this.reservedMicrousd = 0;
    this.date = this.#dateKey();
  }

  #dateKey() {
    return new Date(this.now()).toISOString().slice(0, 10);
  }

  #rollover() {
    const current = this.#dateKey();
    if (current === this.date) return;
    this.#reservations.clear();
    this.spentMicrousd = 0;
    this.reservedMicrousd = 0;
    this.date = current;
  }

  reserve(amountMicrousd, metadata = {}) {
    this.#rollover();
    const amount = Math.max(0, Math.ceil(amountMicrousd));
    if (this.spentMicrousd + this.reservedMicrousd + amount > this.limitMicrousd) return null;
    const reservation = { id: randomUUID(), amountMicrousd: amount, metadata, reservedAt: this.now() };
    this.#reservations.set(reservation.id, reservation);
    this.reservedMicrousd += amount;
    return reservation;
  }

  reconcile(reservation, actualMicrousd) {
    this.#rollover();
    if (!reservation || !this.#reservations.has(reservation.id)) return false;
    this.#reservations.delete(reservation.id);
    this.reservedMicrousd -= reservation.amountMicrousd;
    this.spentMicrousd += Math.max(0, Math.ceil(actualMicrousd));
    return true;
  }

  release(reservation) {
    this.#rollover();
    if (!reservation || !this.#reservations.has(reservation.id)) return false;
    this.#reservations.delete(reservation.id);
    this.reservedMicrousd -= reservation.amountMicrousd;
    return true;
  }

  snapshot() {
    this.#rollover();
    return {
      date: this.date,
      limitMicrousd: this.limitMicrousd,
      spentMicrousd: this.spentMicrousd,
      reservedMicrousd: this.reservedMicrousd,
      remainingMicrousd: Math.max(0, this.limitMicrousd - this.spentMicrousd - this.reservedMicrousd),
    };
  }
}

const globalBudgetKey = Symbol.for('clawtree.agent-budget-ledger.v1');

export function globalAgentBudgetLedger(limitMicrousd = 150_000) {
  if (!globalThis[globalBudgetKey]) globalThis[globalBudgetKey] = new AgentBudgetLedger({ limitMicrousd });
  return globalThis[globalBudgetKey];
}

export function resetGlobalAgentBudgetForTests(limitMicrousd = 150_000) {
  globalThis[globalBudgetKey] = new AgentBudgetLedger({ limitMicrousd });
  return globalThis[globalBudgetKey];
}
