export function servicesFor(client, legacyService) {
  return Array.isArray(client?.services) ? client.services : [legacyService(client)];
}

export function normalizeServices(client, legacyService) {
  return servicesFor(client, legacyService);
}

export function upsertService(client, draft) {
  const services = Array.isArray(client.services) ? [...client.services] : [];
  const index = services.findIndex(service => service.id === draft.id);
  const service = { ...draft, id: draft.id || `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  if (index < 0) services.push(service);
  else services[index] = { ...services[index], ...service };
  return recomputeClient({ ...client, services });
}

export function paymentsForService(client, serviceId) {
  const firstId = client.services?.[0]?.id;
  return (client.payments || []).filter(payment => payment.serviceId === serviceId || (!payment.serviceId && serviceId === firstId));
}

export function removeService(client, serviceId) {
  const services = (client.services || []).filter(service => service.id !== serviceId);
  const removedPayments = paymentsForService(client, serviceId);
  const removed = new Set(removedPayments.map(payment => payment.id));
  return recomputeClient({ ...client, services, payments: (client.payments || []).filter(payment => !removed.has(payment.id)) });
}

function recomputeClient(client) {
  const totalAgreedPrice = (client.services || []).reduce((sum, service) => sum + (Number(service.agreedPrice) || (service.items || []).reduce((n, item) => n + (Number(item.price) || 0), 0)), 0);
  const amountPaid = (client.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  return { ...client, totalAgreedPrice, amountPaid };
}

export function removeClientFromData(data, date, id) {
  const clients = { ...data.clients };
  const client = (clients[date] || []).find(item => item.id === id);
  clients[date] = (clients[date] || []).filter(item => item.id !== id);
  if (!clients[date].length) delete clients[date];
  const paymentSnapshots = { ...(data.finance?.paymentSnapshots || {}) };
  for (const payment of client?.payments || []) delete paymentSnapshots[payment.id];
  return { ...data, clients, finance: { ...data.finance, paymentSnapshots } };
}
