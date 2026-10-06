import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateAmount, DEFAULT_BUCKETS, DEFAULT_FINANCE, getBalances, getTransactions } from '../src/money.js';
import { chooseSnapshot, hasSavedContent } from '../src/sync.js';

test('reference allocation splits UGX 1,000,000 as configured', () => {
  const { allocations, unallocated } = allocateAmount(1_000_000, DEFAULT_BUCKETS);
  assert.deepEqual(allocations.map(x => x.amount), [300_000, 250_000, 200_000, 100_000, 100_000, 50_000]);
  assert.equal(unallocated, 0);
  assert.equal(allocations.reduce((n, x) => n + x.amount, unallocated), 1_000_000);
});

test('allocation snapshots keep historical rules while future income uses new rules', () => {
  const oldRules = [{ id: 'living', percentage: 25 }];
  const snapshot = allocateAmount(1_000_000, [], oldRules);
  const future = allocateAmount(1_000_000, [], [{ id: 'living', percentage: 30 }]);
  assert.equal(snapshot.allocations[0].amount, 250_000);
  assert.equal(future.allocations[0].amount, 300_000);
  assert.equal(snapshot.allocations[0].amount, 250_000);
});

test('amount rounding always reconciles and over-allocation is rejected', () => {
  const split = allocateAmount(101, [{ id: 'a', percentage: 33 }, { id: 'b', percentage: 33 }, { id: 'c', percentage: 34 }]);
  assert.equal(split.allocations.reduce((n, x) => n + x.amount, split.unallocated), 101);
  assert.throws(() => allocateAmount(100, [{ id: 'a', percentage: 101 }]), /exceed 100/);
  assert.equal(allocateAmount(100, [{ id: 'a', percentage: 75 }]).unallocated, 25);
});

test('client payment ID appears once, alongside independent manual income and expense', () => {
  const finance = { ...DEFAULT_FINANCE, manualIncome: [{ id: 'other-1', amount: 30_000, date: '2026-10-06', description: 'Contract', sourceType: 'Freelance', allocations: [], accountId: 'bank' }], paymentSnapshots: { p1: { allocations: [{ bucketId: 'living', percentage: 100, amount: 80_000 }], unallocated: 0 } } };
  const data = { finance, expenses: [{ id: 'e1', amount: 10_000, date: '2026-10-06', note: 'Travel', bucketId: 'living', accountId: 'bank' }], clients: { '2026-10-06': [{ id: 'c1', name: 'Client', payments: [{ id: 'p1', amount: 80_000, date: '2026-10-06' }] }] } };
  const ledger = getTransactions(data);
  assert.equal(ledger.filter(t => t.paymentId === 'p1').length, 1);
  const totals = getBalances(ledger, finance);
  assert.equal(totals.clientIncome, 80_000);
  assert.equal(totals.otherIncome, 30_000);
  assert.equal(totals.expenses, 10_000);
  assert.equal(totals.buckets.living.allocated, 80_000);
  assert.equal(totals.buckets.living.spent, 10_000);
  assert.equal(totals.accounts.bank, 20_000);
});

test('repeated client payment IDs never duplicate a ledger income entry', () => {
  const payment = { id: 'same-id', amount: 12_000 };
  const data = { finance: DEFAULT_FINANCE, expenses: [], clients: { one: [{ id: 'c1', payments: [payment] }], two: [{ id: 'c2', payments: [payment] }] } };
  assert.equal(getTransactions(data).filter(t => t.paymentId === 'same-id').length, 1);
});

test('a fresh device loads existing remote state despite its new local timestamp', () => {
  const localDefaults = { clients: {}, expenses: [], finance: DEFAULT_FINANCE, meta: { updatedAt: '2026-10-06T12:00:00Z' } };
  const remote = { clients: { old: [{ id: 'client-1' }] }, expenses: [], finance: DEFAULT_FINANCE, meta: { updatedAt: '2026-10-01T12:00:00Z' } };
  assert.equal(chooseSnapshot(localDefaults, remote, false), 'remote');
});

test('money-only and settings-only local data count as saved content', () => {
  const manual = { clients: {}, expenses: [], finance: { ...DEFAULT_FINANCE, manualIncome: [{ id: 'i1', amount: 100 }] } };
  const expense = { clients: {}, expenses: [{ id: 'e1', amount: 50 }], finance: DEFAULT_FINANCE };
  const custom = { clients: {}, expenses: [], finance: { ...DEFAULT_FINANCE, buckets: [...DEFAULT_FINANCE.buckets, { id: 'laptop', name: 'Laptop', percentage: 0 }] } };
  assert.ok(hasSavedContent(manual));
  assert.ok(hasSavedContent(expense));
  assert.ok(hasSavedContent(custom));
  assert.equal(chooseSnapshot({ ...manual, meta:{updatedAt:'2026-10-06T12:00:00Z'} }, { clients: {}, expenses: [], finance: DEFAULT_FINANCE, meta: { updatedAt: '1970-01-01' } }), 'local');
});

test('a newer empty remote state is kept from hiding local data unless marked as an intentional reset', () => {
  const local = { clients: { old: [{ id: 'client-1' }] }, expenses: [], finance: DEFAULT_FINANCE, meta: { updatedAt: '2026-10-01T12:00:00Z' } };
  const remote = { clients: {}, expenses: [], finance: DEFAULT_FINANCE, meta: { updatedAt: '2026-10-06T12:00:00Z' } };
  assert.equal(chooseSnapshot(local, remote), 'local');
  remote.meta.emptyStateResetAt = '2026-10-07T12:00:00Z';
  assert.equal(chooseSnapshot(local, remote), 'remote');
});
