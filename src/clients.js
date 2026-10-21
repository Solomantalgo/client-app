export function servicesFor(client, legacyService) {
  return Array.isArray(client?.services)
    ? client.services
    : [legacyService(client)];
}

export const itemsTotal = (service) =>
  (service?.items || []).reduce(
    (total, item) => total + (Number(item.price) || 0),
    0,
  );

export function serviceTotal(service, client) {
  const items = itemsTotal(service);
  if (items > 0) return items;
  return (
    Number(service?.agreedPrice) ||
    (client?.services?.length === 1 ? Number(client.totalAgreedPrice) || 0 : 0)
  );
}

export function applyServicePricing(mode, lump, items) {
  if (mode === "lump") {
    return {
      items: items.map((item) => ({ ...item, price: 0 })),
      agreedPrice: Number(lump) || 0,
    };
  }
  const pricedItems = items.map((item) => ({
    ...item,
    price: Number(item.price) || 0,
  }));
  return {
    items: pricedItems,
    agreedPrice: itemsTotal({ items: pricedItems }),
  };
}

export function outstandingBalances(clients) {
  return Object.entries(clients || {}).flatMap(([date, group]) =>
    group
      .filter((client) => client.status === "ongoing" && !client.paused)
      .flatMap((client) => {
        const services = Array.isArray(client.services)
          ? client.services
          : [
              {
                id: "default",
                title: client.package || "Client service",
                agreedPrice: client.totalAgreedPrice,
              },
            ];
        return services
          .map((service) => {
            const total = serviceTotal(service, client);
            const payments = paymentsForService(client, service.id);
            const paid = payments.reduce(
              (sum, payment) => sum + (Number(payment.amount) || 0),
              0,
            );
            return {
              id: `${date}:${client.id}:${service.id}`,
              date,
              clientId: client.id,
              name: client.business || client.name,
              service: service.title,
              total,
              paid,
              balance: Math.max(0, total - paid),
              payments,
            };
          })
          .filter((item) => item.balance > 0);
      }),
  );
}

export function pausedBalances(clients) {
  return Object.entries(clients || {}).flatMap(([date, group]) =>
    group
      .filter((client) => client.status === "ongoing" && client.paused)
      .flatMap((client) => {
        const services = Array.isArray(client.services)
          ? client.services
          : [{ id: "default", title: client.package || "Client service", agreedPrice: client.totalAgreedPrice }];
        return services.map((service) => {
          const total = serviceTotal(service, client);
          const payments = paymentsForService(client, service.id);
          const paid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
          return {
            id: `${date}:${client.id}:${service.id}`,
            date,
            clientId: client.id,
            name: client.business || client.name,
            service: service.title,
            total,
            paid,
            balance: Math.max(0, total - paid),
            payments,
          };
        }).filter((item) => item.balance > 0);
      }),
  );
}

export function normalizeServices(client, legacyService) {
  return servicesFor(client, legacyService);
}

export function upsertService(client, draft) {
  const services = Array.isArray(client.services) ? [...client.services] : [];
  const index = services.findIndex((service) => service.id === draft.id);
  const service = {
    ...draft,
    id:
      draft.id || `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  if (index < 0) services.push(service);
  else services[index] = { ...services[index], ...service };
  return recomputeClient({ ...client, services });
}

export function paymentsForService(client, serviceId) {
  const firstId = client.services?.[0]?.id;
  return (client.payments || []).filter(
    (payment) =>
      payment.serviceId === serviceId ||
      (!payment.serviceId && serviceId === firstId),
  );
}

export function removeService(client, serviceId) {
  const services = (client.services || []).filter(
    (service) => service.id !== serviceId,
  );
  const removedPayments = paymentsForService(client, serviceId);
  const removed = new Set(removedPayments.map((payment) => payment.id));
  return recomputeClient({
    ...client,
    services,
    payments: (client.payments || []).filter(
      (payment) => !removed.has(payment.id),
    ),
  });
}

export function mergeServices(client, serviceIds, title) {
  const ids = [...new Set(serviceIds || [])];
  if (ids.length < 2) throw new Error("Choose at least two services.");
  const selected = ids.map((id) => client.services?.find((service) => service.id === id));
  if (selected.some((service) => !service)) throw new Error("A selected service no longer exists.");
  if (selected.some((service) => service.mergedFrom?.length)) {
    throw new Error("Unmerge selected services before merging them again.");
  }
  const id = `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const selectedIds = new Set(ids);
  const mergedFrom = selected.map((service) => ({ ...service }));
  const items = selected.flatMap((service) =>
    itemsTotal(service) > 0
      ? service.items.map((item) => ({ ...item }))
      : [{ id: `item-${service.id}`, title: service.title, price: serviceTotal(service) }],
  );
  const paymentMap = {};
  const payments = (client.payments || []).map((payment) => {
    const assigned = payment.serviceId || client.services?.[0]?.id;
    if (!selectedIds.has(assigned)) return payment;
    paymentMap[payment.id] = assigned;
    return { ...payment, serviceId: id };
  });
  const createdAt = selected.map((service) => service.createdAt).filter(Boolean).sort()[0] || "";
  const dueDate = selected.map((service) => service.dueDate).filter(Boolean).sort()[0] || "";
  const merged = {
    id,
    title: title?.trim() || selected.map((service) => service.title).join(" + "),
    status: "active",
    createdAt,
    dueDate,
    items,
    agreedPrice: selected.reduce((sum, service) => sum + serviceTotal(service), 0),
    mergedFrom,
    paymentMap,
    invoiceNo: "",
  };
  return recomputeClient({
    ...client,
    services: [...(client.services || []).filter((service) => !selectedIds.has(service.id)), merged],
    payments,
  });
}

export function unmergeService(client, mergedId) {
  const merged = client.services?.find((service) => service.id === mergedId);
  if (!merged?.mergedFrom?.length) throw new Error("This service is not merged.");
  const restored = merged.mergedFrom.map((service) => ({ ...service }));
  const firstId = restored[0].id;
  const payments = (client.payments || []).map((payment) => {
    if (payment.serviceId !== mergedId) return payment;
    return { ...payment, serviceId: merged.paymentMap?.[payment.id] || firstId };
  });
  return recomputeClient({
    ...client,
    services: [...client.services.filter((service) => service.id !== mergedId), ...restored],
    payments,
  });
}

function recomputeClient(client) {
  const totalAgreedPrice = (client.services || []).reduce(
    (sum, service) =>
      sum +
      (Number(service.agreedPrice) ||
        (service.items || []).reduce(
          (n, item) => n + (Number(item.price) || 0),
          0,
        )),
    0,
  );
  const amountPaid = (client.payments || []).reduce(
    (sum, payment) => sum + (Number(payment.amount) || 0),
    0,
  );
  return { ...client, totalAgreedPrice, amountPaid };
}

export function removeClientFromData(data, date, id) {
  const clients = { ...data.clients };
  const client = (clients[date] || []).find((item) => item.id === id);
  clients[date] = (clients[date] || []).filter((item) => item.id !== id);
  if (!clients[date].length) delete clients[date];
  const paymentSnapshots = { ...(data.finance?.paymentSnapshots || {}) };
  for (const payment of client?.payments || [])
    delete paymentSnapshots[payment.id];
  return { ...data, clients, finance: { ...data.finance, paymentSnapshots } };
}

export function findClient(data, id) {
  for (const [date, clients] of Object.entries(data?.clients || {})) {
    const client = clients.find((item) => item.id === id);
    if (client) return { date, client };
  }
  return null;
}
