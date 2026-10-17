import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeServices, upsertService, removeService, paymentsForService, removeClientFromData } from '../src/clients.js';

const legacy = client => ({ id: 'legacy', title: client.package || 'Client Service', agreedPrice: Number(client.totalAgreedPrice) || 0, items: [] });

test('deleting the last service stays empty after normalization', () => {
  const client = { id: 'c1', status: 'ongoing', services: [{ id: 's1', agreedPrice: 100 }] };
  const deleted = removeService(client, 's1');
  assert.deepEqual(normalizeServices(deleted, legacy), []);
});

test('legacy records without a services array still synthesize their historical service', () => {
  assert.equal(normalizeServices({ status: 'ongoing', totalAgreedPrice: 90 }, legacy).length, 1);
});

test('legacy shaped saved service data is retained without edits', () => {
  const sample = { status: 'ongoing', package: 'Website', totalAgreedPrice: 120, services: [{ id: 'legacy-svc', title: 'Website', categories: 'Landing page', items: [{ id: 'legacy-item', title: 'Landing page', price: 120 }], agreedPrice: 120, dueDate: '2026-12-01', status: 'active', createdAt: '2026-01-01' }] };
  assert.deepEqual(normalizeServices(sample, legacy), sample.services);
});

test('adding keeps services separate and editing updates only its service', () => {
  const one = upsertService({ services: [] }, { id: 'one', title: 'One', agreedPrice: 50, items: [] });
  const added = upsertService(one, { id: 'two', title: 'Two', agreedPrice: 75, items: [] });
  const edited = upsertService(added, { id: 'one', title: 'Updated', agreedPrice: 60, items: [] });
  assert.deepEqual(edited.services.map(s => s.title), ['Updated', 'Two']);
  assert.equal(edited.totalAgreedPrice, 135);
});

test('deleting a service removes linked payments and recomputes totals', () => {
  const client = { services: [{ id: 'a', agreedPrice: 100 }, { id: 'b', agreedPrice: 200 }], payments: [{ id: 'p1', serviceId: 'a', amount: 30 }, { id: 'p2', serviceId: 'b', amount: 20 }] };
  assert.equal(paymentsForService(client, 'a').length, 1);
  const result = removeService(client, 'a');
  assert.deepEqual(result.payments.map(p => p.id), ['p2']);
  assert.equal(result.totalAgreedPrice, 200);
  assert.equal(result.amountPaid, 20);
  assert.equal(removeService(client, 'b').amountPaid, 30);
});

test('removing a client clears snapshots and an empty date key', () => {
  const data = { clients: { '2026-01-01': [{ id: 'c', payments: [{ id: 'p', amount: 10 }] }] }, finance: { paymentSnapshots: { p: { unallocated: 10 }, other: {} } } };
  const result = removeClientFromData(data, '2026-01-01', 'c');
  assert.equal('2026-01-01' in result.clients, false);
  assert.deepEqual(result.finance.paymentSnapshots, { other: {} });
});
