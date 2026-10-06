import { useMemo, useState } from 'react';
import { DEFAULT_FINANCE, allocateAmount, getBalances, getTransactions } from './money.js';

const money = n => `UGX ${Math.round(n || 0).toLocaleString('en-UG')}`;
const uid = () => `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function MoneyView({ data, onSave, onUpdateClient, onAddExpense, onUpdateExpense, onDeleteExpense }) {
  const finance = data.finance || DEFAULT_FINANCE;
  const [tab, setTab] = useState('Overview');
  const [form, setForm] = useState('');
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('All');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState({ date: today(), amount: '', description: '', note: '', sourceType: 'Freelance / Contract', accountId: '', bucketId: '' });
  const activeBuckets = finance.buckets.filter(b => b.status !== 'archived').sort((a,b) => a.sortOrder - b.sortOrder);
  const transactions = useMemo(() => getTransactions(data), [data]);
  const totals = useMemo(() => getBalances(transactions, finance), [transactions, finance]);
  const allocationTotal = activeBuckets.reduce((n,b) => n + (Number(b.percentage) || 0), 0);
  const startForm = (type, item = null) => {
    setEditing(item);
    setForm(type);
    setMessage('');
    setDraft(item ? { ...draft, ...item, custom: item.allocationMode === 'custom', customAllocations: item.allocationMode === 'custom' ? (item.allocations || []).map(a=>({id:a.bucketId,percentage:a.percentage})) : null, amount: item.amount ?? '', description: item.description || item.note || '', date: item.date ?? '' } : { date: today(), amount: '', description: '', note: '', sourceType: finance.sources[0] || 'Other', accountId: '', bucketId: '', custom:false, customAllocations:null });
  };
  const closeForm = () => { setForm(''); setEditing(null); setMessage(''); };
  const submit = () => {
    const amount = Math.round(Number(draft.amount));
    if ((form === 'income' || form === 'expense') && !(amount > 0)) return setMessage('Enter an amount greater than zero.');
    if ((form === 'income' || form === 'expense') && !draft.description?.trim()) return setMessage('Add a description.');
    if (form === 'income') {
      try {
        const savedRules = editing && !draft.custom ? (editing.allocations || []).map(a=>({id:a.bucketId,percentage:a.percentage})) : undefined;
        const override = draft.custom ? draft.customAllocations : savedRules;
        const split = override ? allocateAmount(amount, finance.buckets, override) : allocateAmount(amount, finance.buckets);
        if (editing) {
          const updated = { ...editing, amount, date: draft.date, description: draft.description.trim(), note: draft.note || '', sourceType: draft.sourceType, accountId: draft.accountId, allocationMode: draft.custom ? 'custom' : editing.allocationMode || 'default', allocations: split.allocations, unallocated: split.unallocated };
          onSave({ ...data, finance: { ...finance, manualIncome: finance.manualIncome.map(x => x.id === editing.id ? updated : x) } });
        } else {
          const income = { id: uid(), amount, date: draft.date, description: draft.description.trim(), note: draft.note || '', sourceType: draft.sourceType, accountId: draft.accountId, allocationMode: draft.custom ? 'custom' : 'default', allocations: split.allocations, unallocated: split.unallocated };
          onSave({ ...data, finance: { ...finance, manualIncome: [...finance.manualIncome, income] } });
        }
        closeForm();
      } catch (e) { setMessage(e.message); }
    } else if (form === 'expense') {
      const fields = { amount, date: draft.date, note: draft.description.trim(), description: draft.description.trim(), bucketId: draft.bucketId, accountId: draft.accountId, notes: draft.note || '' };
      if (editing) onUpdateExpense(editing.rawId, fields); else onAddExpense(fields);
      closeForm();
    } else if (form === 'bucket') {
      if (!draft.name?.trim()) return setMessage('Enter a bucket name.');
      const percentage = Math.max(0, Number(draft.percentage) || 0);
      const next = finance.buckets.map(b => b.id === editing?.id ? { ...b, name: draft.name.trim(), icon: draft.icon || b.icon || '◇', percentage, target: Math.max(0, Number(draft.target) || 0) } : b);
      if (!editing) next.push({ id: uid(), name: draft.name.trim(), icon: draft.icon || '◇', percentage, target: Math.max(0, Number(draft.target) || 0), status: 'active', sortOrder: next.length, createdAt:new Date().toISOString() });
      onSave({ ...data, finance: { ...finance, buckets: next } }); closeForm();
    } else if (form === 'account') {
      if (!draft.name?.trim()) return setMessage('Enter an account name.');
      const next = finance.accounts.map(a => a.id === editing?.id ? { ...a, name: draft.name.trim(), type: draft.accountType || editing?.type || 'Other' } : a);
      if (!editing) next.push({ id: uid(), name: draft.name.trim(), type: draft.accountType || 'Other', status: 'active', createdAt:new Date().toISOString() });
      onSave({ ...data, finance: { ...finance, accounts: next } }); closeForm();
    } else if (form === 'source') {
      if (!draft.name?.trim()) return setMessage('Enter a source type.');
      if (finance.sources.some(x => x.toLocaleLowerCase() === draft.name.trim().toLocaleLowerCase())) return setMessage('That source type already exists.');
      onSave({ ...data, finance: { ...finance, sources: [...finance.sources, draft.name.trim()] } }); closeForm();
    }
  };
  const archiveBucket = bucket => onSave({ ...data, finance: { ...finance, buckets: finance.buckets.map(b => b.id === bucket.id ? { ...b, status: 'archived', archivedAt:new Date().toISOString() } : b) } });
  const restoreBucket = bucket => onSave({ ...data, finance: { ...finance, buckets: finance.buckets.map(b => b.id === bucket.id ? { ...b, status: 'active', archivedAt:null } : b) } });
  const reorderBucket = (bucket, direction) => {
    const ordered=activeBuckets.slice(); const index=ordered.findIndex(b=>b.id===bucket.id); const target=index+direction;
    if(target<0||target>=ordered.length)return;
    const current=ordered[index]; const next=ordered[target];
    onSave({ ...data, finance:{ ...finance, buckets:finance.buckets.map(b=>b.id===current.id?{...b,sortOrder:next.sortOrder}:b.id===next.id?{...b,sortOrder:current.sortOrder}:b) } });
  };
  const archiveAccount = account => onSave({ ...data, finance: { ...finance, accounts: finance.accounts.map(a => a.id === account.id ? { ...a, status: 'archived', archivedAt:new Date().toISOString() } : a) } });
  const setPaymentAccount = (transaction, accountId) => {
    const entry = Object.entries(data.clients).find(([, clients]) => clients.some(c => c.id === transaction.clientId));
    if (!entry) return;
    const [date, clients] = entry;
    const client = clients.find(c => c.id === transaction.clientId);
    onUpdateClient(date, client.id, { payments: (client.payments || []).map(p => p.id === transaction.paymentId ? { ...p, accountId } : p) });
  };
  const archiveTransaction = t => {
    if (t.type === 'income' && t.sourceType !== 'client_payment') onSave({ ...data, finance: { ...finance, manualIncome: finance.manualIncome.filter(x => x.id !== t.id.replace('income:', '')) } });
    if (t.type === 'expense') onDeleteExpense(t.id.replace('expense:', ''));
  };
  const visible = transactions.filter(t => filter === 'All' || (filter === 'Income' ? t.type === 'income' : t.type === 'expense'));
  const createManualIncome = () => startForm('income');

  return <main className="money-app">
    <header className="money-header"><div><div className="money-eyebrow">PERSONAL FINANCE</div><h1>Money</h1><p>Your income, spending and plans in one place.</p></div><button className="m-primary" onClick={createManualIncome}>＋ Log income</button></header>
    <nav className="money-nav" aria-label="Money sections">{['Overview','Income','Expenses','Allocations','Accounts','Client balances'].map(item => <button key={item} className={tab===item?'selected':''} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {message && !form && <p className="m-notice">{message}</p>}
    <section className="money-content">
      {tab === 'Overview' && <>
        <div className="m-stats"><Metric title="Total received" value={money(totals.income)} detail={`${money(totals.clientIncome)} from clients · ${money(totals.otherIncome)} other`} /><Metric title="Available money" value={money(totals.available)} detail="Income received less expenses" /><Metric title="Total expenses" value={money(totals.expenses)} detail={`${transactions.filter(t=>t.type==='expense').length} recorded expenses`} /><Metric title="Outstanding client money" value={money(getOutstanding(data.clients))} detail="Agreed client balances · not cash" /></div>
        <div className="m-panel"><div className="m-section-head"><div><h2>Money by purpose</h2><p>Current balances from allocations and expenses</p></div><button className="m-quiet" onClick={()=>setTab('Allocations')}>Manage allocations →</button></div>
          {activeBuckets.length ? <div className="m-bucket-grid">{activeBuckets.map(b=>{const v=totals.buckets[b.id]||{allocated:0,spent:0};const available=v.allocated-v.spent;return <article className="m-bucket" key={b.id}><div className="m-bucket-name"><span className="m-icon">{b.icon||'◇'}</span><span>{b.name}</span></div><strong>{money(available)}</strong><span className="m-muted">available</span><div className="m-progress"><i style={{width:`${b.target?Math.min(100,Math.max(0,available/b.target*100)):0}%`}} /></div><div className="m-detail-row"><span>{b.percentage}% default</span><span>{money(v.allocated)} allocated</span></div><div className="m-detail-row"><span>{money(v.spent)} spent</span><span>{b.target?`${Math.min(100,Math.round(available/b.target*100))}% of goal`:'No target'}</span></div></article>})}</div> : <Empty title="No buckets yet" text="Add a bucket to decide what your money is for." action={()=>setTab('Allocations')} label="Set up buckets"/>}
        </div>
        <div className="m-two-col"><div className="m-panel"><div className="m-section-head"><div><h2>Where money is</h2><p>Balances derive from recorded activity</p></div><button className="m-quiet" onClick={()=>setTab('Accounts')}>Accounts →</button></div>{finance.accounts.filter(a=>a.status!=='archived').map(a=><div className="m-list-row" key={a.id}><span>{a.name}</span><strong>{money(totals.accounts[a.id]||0)}</strong></div>)}</div><div className="m-panel"><div className="m-section-head"><div><h2>Recent activity</h2><p>Latest income and expenses</p></div><button className="m-quiet" onClick={()=>setTab('Income')}>Full history →</button></div><TransactionList rows={transactions.slice(0,5)} finance={finance} onEdit={t=>editTransaction(t,startForm)} onSetAccount={setPaymentAccount} /></div></div>
      </>}
      {tab === 'Income' && <div className="m-panel"><div className="m-section-head"><div><h2>Income</h2><p>Client payments appear automatically. Other income is recorded here.</p></div><div className="m-actions"><button className="m-secondary" onClick={()=>startForm('source')}>＋ Source type</button><button className="m-primary" onClick={createManualIncome}>＋ Log income</button></div></div><FilterBar filter={filter} setFilter={setFilter}/><TransactionList rows={visible.filter(t=>t.type==='income')} finance={finance} onEdit={t=>editTransaction(t,startForm)} onDelete={archiveTransaction} onSetAccount={setPaymentAccount}/></div>}
      {tab === 'Expenses' && <div className="m-panel"><div className="m-section-head"><div><h2>Expenses</h2><p>Assign each expense to its purpose and payment account.</p></div><button className="m-primary" onClick={()=>startForm('expense')}>＋ Log expense</button></div><FilterBar filter={filter} setFilter={setFilter}/><TransactionList rows={transactions.filter(t=>t.type==='expense')} finance={finance} onEdit={t=>editTransaction(t,startForm)} onDelete={archiveTransaction}/></div>}
      {tab === 'Allocations' && <div className="m-panel"><div className="m-section-head"><div><h2>Allocation rules</h2><p>Changes apply only to future income. Past allocations stay unchanged.</p></div><button className="m-primary" onClick={()=>startForm('bucket')}>＋ Add bucket</button></div><div className={`m-allocation-total ${allocationTotal>100?'invalid':''}`}><b>{allocationTotal}%</b><span>{allocationTotal>100?`Over-allocated by ${allocationTotal-100}%`:allocationTotal===100?'Allocation complete':`${100-allocationTotal}% will stay unallocated`}</span></div>{finance.buckets.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(b=>{const index=activeBuckets.findIndex(x=>x.id===b.id);return <div className={`m-rule ${b.status==='archived'?'archived':''}`} key={b.id}><span className="m-icon">{b.icon||'◇'}</span><div className="m-rule-main"><strong>{b.name}</strong><div className="m-muted">{money((totals.buckets[b.id]?.allocated||0)-(totals.buckets[b.id]?.spent||0))} available{b.target?` · Goal ${money(b.target)}`:''}</div></div><b>{b.percentage}%</b>{b.status==='archived'?<button className="m-quiet" onClick={()=>restoreBucket(b)}>Restore</button>:<><button className="m-quiet m-order" aria-label={`Move ${b.name} up`} disabled={index===0} onClick={()=>reorderBucket(b,-1)}>↑</button><button className="m-quiet m-order" aria-label={`Move ${b.name} down`} disabled={index===activeBuckets.length-1} onClick={()=>reorderBucket(b,1)}>↓</button><button className="m-quiet" onClick={()=>startForm('bucket',b)}>Edit</button><button className="m-quiet" onClick={()=>archiveBucket(b)}>Archive</button></>}</div>})}{allocationTotal>100&&<p className="m-error">New income cannot be saved while active bucket percentages exceed 100%.</p>}</div>}
      {tab === 'Accounts' && <div className="m-panel"><div className="m-section-head"><div><h2>Accounts</h2><p>Where money physically exists. Balances use recorded transactions.</p></div><button className="m-primary" onClick={()=>startForm('account')}>＋ Add account</button></div>{finance.accounts.map(a=><div className={`m-rule ${a.status==='archived'?'archived':''}`} key={a.id}><span className="m-icon">⌁</span><div className="m-rule-main"><strong>{a.name}</strong><div className="m-muted">{a.type} · {a.status==='archived'?'Archived':'Active'}</div></div><b>{money(totals.accounts[a.id]||0)}</b>{a.status!=='archived'&&<><button className="m-quiet" onClick={()=>startForm('account',a)}>Edit</button><button className="m-quiet" onClick={()=>archiveAccount(a)}>Archive</button></>}</div>)}<p className="m-hint">Legacy expenses with no account remain marked as unknown and are excluded from account balances.</p></div>}
      {tab === 'Client balances' && <div className="m-panel"><h2>Outstanding client balances</h2><p className="m-muted">Unpaid agreements are not included in available money.</p>{clientBalances(data.clients).map(x=><div className="m-list-row" key={x.id}><div><strong>{x.name}</strong><div className="m-muted">{x.service} · {money(x.paid)} received of {money(x.total)}</div></div><strong className="m-warm">{money(x.balance)}</strong></div>)}{!clientBalances(data.clients).length&&<Empty title="No outstanding balances" text="Client balances will appear here when payments are due."/>}</div>}
    </section>
    {form && <div className="m-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeForm()}><form className="m-dialog" onSubmit={e=>{e.preventDefault();submit()}}><div className="m-section-head"><div><div className="money-eyebrow">{editing?'UPDATE':'NEW'} {form.toUpperCase()}</div><h2>{form==='income'?'Log income':form==='expense'?'Log expense':form==='bucket'?(editing?'Edit bucket':'Add bucket'):form==='source'?'Add source type':(editing?'Edit account':'Add account')}</h2></div><button type="button" className="m-close" onClick={closeForm}>×</button></div>
      {(form==='income'||form==='expense')&&<><label>Amount (UGX)<input required min="1" type="number" inputMode="numeric" value={draft.amount} onChange={e=>setDraft({...draft,amount:e.target.value})} placeholder="e.g. 250000"/></label><label>{form==='income'?'Source / description':'Expense description'}<input required value={draft.description||''} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder={form==='income'?'What was this income for?':'What did you spend on?'}/></label><div className="m-form-grid"><label>Date<input type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>{form==='income'?<label>Source type<select value={draft.sourceType} onChange={e=>setDraft({...draft,sourceType:e.target.value})}>{finance.sources.map(s=><option key={s}>{s}</option>)}</select></label>:<label>Bucket<select value={draft.bucketId||''} onChange={e=>setDraft({...draft,bucketId:e.target.value})}><option value="">Uncategorized</option>{finance.buckets.filter(b=>b.status!=='archived'||draft.bucketId===b.id).map(b=><option key={b.id} value={b.id}>{b.name}{b.status==='archived'?' (archived)':''}</option>)}</select></label>}</div><label>Account<select value={draft.accountId||''} onChange={e=>setDraft({...draft,accountId:e.target.value})}><option value="">Unknown / not selected</option>{finance.accounts.filter(a=>a.status!=='archived'||draft.accountId===a.id).map(a=><option key={a.id} value={a.id}>{a.name}{a.status==='archived'?' (archived)':''}</option>)}</select></label>{form==='income'&&<details className="m-custom"><summary>Customize this income allocation</summary><p className="m-hint">Defaults are applied automatically. Set a one-off split below; remaining funds stay unallocated.</p>{activeBuckets.map(b=><label className="m-split" key={b.id}>{b.name}<span><input type="number" min="0" max="100" value={draft.customAllocations?.find(x=>x.id===b.id)?.percentage??b.percentage} onChange={e=>{const cur=draft.customAllocations||activeBuckets.map(x=>({id:x.id,percentage:x.percentage}));setDraft({...draft,custom:true,customAllocations:cur.map(x=>x.id===b.id?{...x,percentage:Number(e.target.value)}:x)})}}/> %</span></label>)}</details>}<label>Notes (optional)<textarea rows="2" value={draft.note||''} onChange={e=>setDraft({...draft,note:e.target.value})}/></label></>}
      {form==='bucket'&&<><label>Name<input value={draft.name||''} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Icon or symbol<input maxLength="4" value={draft.icon||editing?.icon||'◇'} onChange={e=>setDraft({...draft,icon:e.target.value})}/></label><div className="m-form-grid"><label>Default percentage<input type="number" min="0" max="100" value={draft.percentage??0} onChange={e=>setDraft({...draft,percentage:e.target.value})}/></label><label>Optional target (UGX)<input type="number" min="0" value={draft.target??0} onChange={e=>setDraft({...draft,target:e.target.value})}/></label></div></>}
      {form==='account'&&<><label>Name<input value={draft.name||''} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Type<input value={draft.accountType||editing?.type||''} onChange={e=>setDraft({...draft,accountType:e.target.value})} placeholder="Bank, Mobile money, Cash…"/></label></>}
      {form==='source'&&<label>Source type name<input value={draft.name||''} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="e.g. Royalties" autoFocus/></label>}
      {message&&<p className="m-error">{message}</p>}<div className="m-dialog-actions"><button type="button" className="m-secondary" onClick={closeForm}>Cancel</button><button className="m-primary" type="submit">Save</button></div></form></div>}
  </main>;
}

function Metric({title,value,detail}){return <article className="m-stat"><span>{title}</span><strong>{value}</strong><small>{detail}</small></article>}
function Empty({title,text,action,label}){return <div className="m-empty"><strong>{title}</strong><p>{text}</p>{action&&<button className="m-quiet" onClick={action}>{label}</button>}</div>}
function FilterBar({filter,setFilter}){return <div className="m-filters">{['All','Income','Expenses'].map(x=><button className={filter===x?'selected':''} key={x} onClick={()=>setFilter(x)}>{x}</button>)}</div>}
function TransactionList({rows,finance,onEdit,onDelete,onSetAccount}){if(!rows.length)return <Empty title="No transactions yet" text="Income and expenses will show here as they are recorded."/>;return <div className="m-transactions">{rows.map(t=><article className="m-transaction" key={t.id}><span className={`m-amount ${t.type==='income'?'positive':'negative'}`}>{t.type==='income'?'+':'−'}{money(t.amount)}</span><div className="m-transaction-main"><strong>{t.clientName||t.description}</strong><span>{t.type==='expense'?`${finance.buckets.find(b=>b.id===t.bucketId)?.name||'Uncategorized'} · `:t.sourceType==='client_payment'?`Client payment · ${t.serviceName}`:`${t.sourceType} · ${t.description}`}{t.accountId?` · ${finance.accounts.find(a=>a.id===t.accountId)?.name||'Archived account'}`:' · Unknown account'}</span><small>{t.date||'Date unknown'}{t.type==='income'&&t.unallocated?` · ${money(t.unallocated)} unallocated`:''}</small></div>{t.type==='income'&&t.sourceType==='client_payment'&&onSetAccount&&<select className="m-account-inline" aria-label={`Account for ${t.clientName} payment`} value={t.accountId||''} onChange={e=>onSetAccount(t,e.target.value)}><option value="">Unknown</option>{finance.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>}{t.type==='income'&&t.sourceType!=='client_payment'&&<><button className="m-quiet" onClick={()=>onEdit?.(t)}>Edit</button>{onDelete&&<button className="m-quiet" onClick={()=>onDelete(t)}>Delete</button>}</>}{t.type==='expense'&&<><button className="m-quiet" onClick={()=>onEdit?.(t)}>Edit</button>{onDelete&&<button className="m-quiet" onClick={()=>onDelete(t)}>Delete</button>}</>}</article>)}</div>}
function editTransaction(t,start){if(t.type==='income'&&t.sourceType!=='client_payment')start('income',{...t,id:t.id.replace('income:','')});if(t.type==='expense')start('expense',{...t,rawId:t.id.replace('expense:','')})}
function clientBalances(clients){return Object.values(clients||{}).flat().flatMap(c=>(c.services?.length?c.services:[{id:'default',title:c.package||'Client service',agreedPrice:Number(c.totalAgreedPrice)||Number(String(c.quotedPrice||'').replace(/\D/g,''))||0}]).map(s=>{const total=Number(s.agreedPrice)||0;const firstServiceId=c.services?.[0]?.id||'default';const paid=(c.payments||[]).filter(p=>p.serviceId===s.id||(!p.serviceId&&s.id===firstServiceId)).reduce((n,p)=>n+(Number(p.amount)||0),0);return {id:`${c.id}:${s.id}`,name:c.business||c.name,service:s.title,total,paid,balance:Math.max(0,total-paid)}}).filter(x=>x.balance>0))}
function getOutstanding(clients){return clientBalances(clients).reduce((n,x)=>n+x.balance,0)}
