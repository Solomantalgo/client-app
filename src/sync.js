import { DEFAULT_FINANCE } from './money.js';

const countClients = data => Object.values(data?.clients || {}).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);

export function hasSavedContent(data) {
  if (!data) return false;
  const finance = data.finance || DEFAULT_FINANCE;
  const outreach = data.outreach || {};
  const hasCustomSetup = JSON.stringify(finance.buckets || []) !== JSON.stringify(DEFAULT_FINANCE.buckets)
    || JSON.stringify(finance.accounts || []) !== JSON.stringify(DEFAULT_FINANCE.accounts)
    || JSON.stringify(finance.sources || []) !== JSON.stringify(DEFAULT_FINANCE.sources);
  return countClients(data) > 0
    || (data.expenses || []).length > 0
    || (finance.manualIncome || []).length > 0
    || (outreach.logs || []).length > 0
    || Number(outreach.laps) > 0
    || Number(outreach.remotePointer || 1) !== 1
    || Number(outreach.physicalPointer || 120) !== 120
    || Number(data.target ?? 5) !== 5
    || hasCustomSetup;
}

export function chooseSnapshot(local, remote, localExists = true) {
  if (!remote) return 'local';
  if (!localExists) return 'remote';
  const localHasContent = hasSavedContent(local);
  const remoteHasContent = hasSavedContent(remote);
  const localTime = new Date(local?.meta?.updatedAt || 0).getTime();
  const remoteTime = new Date(remote?.meta?.updatedAt || 0).getTime();
  const localResetTime = new Date(local?.meta?.emptyStateResetAt || 0).getTime();
  const remoteResetTime = new Date(remote?.meta?.emptyStateResetAt || 0).getTime();
  if (!localHasContent && remoteHasContent) return localResetTime > remoteTime ? 'local' : 'remote';
  if (localHasContent && !remoteHasContent) return remoteResetTime > localTime ? 'remote' : 'local';
  return remoteTime > localTime ? 'remote' : 'local';
}
