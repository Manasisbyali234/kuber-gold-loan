import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Share, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { C, Btn, Field, Card, Header, Row, Chip, Empty } from './ui';
import { uid, today, inr, dmy, addMonths, calc, notify, confirm } from './utils';

const pick = async () => {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.25, base64: true });
  if (r.canceled) return null;
  const a = r.assets[0];
  return a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
};
const Photo = ({ label, value, onChange }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 5 }}>{label}</Text>
    <TouchableOpacity onPress={async () => { const p = await pick(); if (p) onChange(p); }}
      style={{ height: 90, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: C.gold, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {value ? <Image source={{ uri: value }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ color: C.gold, fontWeight: '600' }}>Tap to add</Text>}
    </TouchableOpacity>
  </View>
);
const Page = ({ children }) => <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
const Stat = ({ label, value, color }) => (
  <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.line, margin: 4, minWidth: 140 }}>
    <Text style={{ color: C.mute, fontSize: 12 }}>{label}</Text>
    <Text style={{ color: color || C.navy, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{value}</Text>
  </View>
);

/* ---------- Login (PIN, stored on device) ---------- */
export function Login({ db, update, onOk }) {
  const [pin, setPin] = useState(''); const [pin2, setPin2] = useState('');
  const first = !db.pin;
  const go = async () => {
    if (!/^\d{4}$/.test(pin)) return notify('PIN must be 4 digits');
    if (first) { if (pin !== pin2) return notify('PINs do not match'); await update((d) => ({ ...d, pin })); onOk(); }
    else if (pin === db.pin) onOk(); else notify('Wrong PIN');
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.navy, justifyContent: 'center', padding: 28 }}>
      <Text style={{ color: C.gold, fontSize: 32, fontWeight: '800' }}>Kuber Jewellery</Text>
      <Text style={{ color: '#B9C6D3', marginBottom: 30 }}>Gold loan manager</Text>
      <Text style={{ color: '#fff', marginBottom: 8 }}>{first ? 'Create a 4-digit PIN' : 'Enter your PIN'}</Text>
      <Field label="" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" />
      {first ? <Field label="" value={pin2} onChangeText={setPin2} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="Confirm PIN" /> : null}
      <Btn title={first ? 'Save PIN and continue' : 'Unlock'} onPress={go} style={{ backgroundColor: C.gold }} />
    </View>
  );
}

/* ---------- Dashboard ---------- */
export function Dashboard({ db, go }) {
  const rows = db.loans.map((l) => ({ l, c: calc(l, db.payments) }));
  const active = rows.filter((r) => r.l.status === 'active');
  const outstanding = active.reduce((s, r) => s + r.c.outstanding, 0);
  const overdue = active.filter((r) => r.c.overdue);
  const todayCol = db.payments.filter((p) => p.date === today()).reduce((s, p) => s + p.amount, 0);
  const soon = active.filter((r) => !r.c.overdue && r.l.dueDate <= addMonths(today(), 0).slice(0, 8) + '99' && new Date(r.l.dueDate) - new Date() < 3 * 86400000);
  return (
    <Page>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -4 }}>
        <Stat label="Active loans" value={active.length} />
        <Stat label="Outstanding" value={inr(outstanding)} />
        <Stat label="Today's collections" value={inr(todayCol)} color={C.green} />
        <Stat label="Overdue" value={overdue.length} color={overdue.length ? C.red : C.navy} />
      </View>
      <Text style={{ fontWeight: '700', fontSize: 16, marginTop: 18, marginBottom: 8, color: C.text }}>Reminders</Text>
      {overdue.length + soon.length === 0 ? <Text style={{ color: C.mute }}>Nothing is due right now.</Text> : null}
      {overdue.concat(soon).map(({ l, c }) => (
        <Card key={l.id} onPress={() => go('loan', { id: l.id })}>
          <Row a={cname(db, l.customerId)} b={inr(c.outstanding)} bold />
          <Row a={c.overdue ? 'Overdue since' : 'Due on'} b={dmy(l.dueDate)} color={c.overdue ? C.red : C.gold} />
        </Card>
      ))}
      <Btn title="New loan" onPress={() => go('loanForm')} style={{ marginTop: 12 }} />
      <Btn title="Add customer" kind="ghost" onPress={() => go('customerForm')} />
    </Page>
  );
}
const cname = (db, id) => (db.customers.find((c) => c.id === id) || {}).name || 'Unknown';

/* ---------- Customers ---------- */
export function Customers({ db, go }) {
  const [q, setQ] = useState('');
  const list = db.customers.filter((c) => (c.name + c.phone).toLowerCase().includes(q.toLowerCase()));
  return (
    <Page>
      <Field label="" value={q} onChangeText={setQ} placeholder="Search by name or phone" />
      <Btn title="Add customer" onPress={() => go('customerForm')} />
      {list.length === 0 ? <Empty text="No customers yet. Add your first customer." /> : null}
      {list.map((c) => (
        <Card key={c.id} onPress={() => go('statement', { id: c.id })} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {c.photo ? <Image source={{ uri: c.photo }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} /> : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.goldSoft, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.gold, fontWeight: '800' }}>{c.name[0]}</Text></View>}
          <View><Text style={{ fontWeight: '700', color: C.text }}>{c.name}</Text><Text style={{ color: C.mute }}>{c.phone}</Text></View>
        </Card>
      ))}
    </Page>
  );
}
export function CustomerForm({ update, back }) {
  const [f, setF] = useState({ name: '', phone: '', address: '', idType: 'Aadhaar', idNo: '', photo: null, idPhoto: null });
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const submit = async () => {
    if (!f.name.trim() || !f.phone.trim()) return notify('Name and phone are required');
    await update((d) => ({ ...d, customers: [{ ...f, id: uid(), createdAt: today() }, ...d.customers] }));
    back();
  };
  return (<><Header title="Add customer" onBack={back} /><Page>
    <Photo label="Customer photo" value={f.photo} onChange={set('photo')} />
    <Field label="Full name" value={f.name} onChangeText={set('name')} />
    <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
    <Field label="Address" value={f.address} onChangeText={set('address')} multiline />
    <Field label="ID proof type (Aadhaar, PAN, Voter ID...)" value={f.idType} onChangeText={set('idType')} />
    <Field label="ID number" value={f.idNo} onChangeText={set('idNo')} />
    <Photo label="ID proof photo" value={f.idPhoto} onChange={set('idPhoto')} />
    <Text style={{ color: C.mute, fontSize: 12, marginBottom: 8 }}>Aadhaar eKYC verification needs the online service and is not part of this offline build.</Text>
    <Btn title="Save customer" onPress={submit} />
  </Page></>);
}

/* ---------- Loans ---------- */
export function Loans({ db, go }) {
  const [q, setQ] = useState(''); const [tab, setTab] = useState('active');
  const list = db.loans.filter((l) => l.status === tab && (cname(db, l.customerId) + l.no).toLowerCase().includes(q.toLowerCase()));
  return (
    <Page>
      <Field label="" value={q} onChangeText={setQ} placeholder="Search by customer or loan no." />
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {['active', 'closed'].map((t) => <Btn key={t} title={t === 'active' ? 'Active' : 'Closed'} kind={tab === t ? undefined : 'ghost'} onPress={() => setTab(t)} style={{ flex: 1, marginHorizontal: 3 }} />)}
      </View>
      <Btn title="New loan" onPress={() => go('loanForm')} />
      {list.length === 0 ? <Empty text="No loans here." /> : null}
      {list.map((l) => { const c = calc(l, db.payments); return (
        <Card key={l.id} onPress={() => go('loan', { id: l.id })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontWeight: '700' }}>{l.no} · {cname(db, l.customerId)}</Text>{c.overdue ? <Chip text="Overdue" color={C.red} /> : null}</View>
          <Row a="Principal" b={inr(l.principal)} /><Row a="Outstanding" b={inr(c.outstanding)} bold />
        </Card>); })}
    </Page>
  );
}
export function LoanForm({ db, update, back, go }) {
  const [f, setF] = useState({ customerId: db.customers[0]?.id || '', weight: '', purity: '22', principal: '', rate: '2', months: '6', photos: [null, null], signature: null });
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const submit = async () => {
    if (!f.customerId) return notify('Add a customer first');
    const principal = Number(f.principal), weight = Number(f.weight);
    if (!principal || !weight) return notify('Enter gold weight and loan amount');
    const loan = { id: uid(), no: 'GL' + String(db.loans.length + 1).padStart(4, '0'), customerId: f.customerId, weight, purity: f.purity, principal, rate: Number(f.rate) || 0, date: today(), dueDate: addMonths(today(), f.months), photos: f.photos.filter(Boolean), signature: f.signature, status: 'active' };
    await update((d) => ({ ...d, loans: [loan, ...d.loans] }));
    const msg = reportText(db, loan);
    confirm('Loan created. Send the loan report to the customer?', () => Share.share({ message: msg }).catch(() => {}), 'Send');
    back();
  };
  return (<><Header title="New loan" onBack={back} /><Page>
    <Text style={{ color: C.mute, fontWeight: '600', marginBottom: 6 }}>Customer</Text>
    {db.customers.length === 0 ? <Btn title="Add a customer first" kind="ghost" onPress={() => go('customerForm')} /> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
      {db.customers.map((c) => <TouchableOpacity key={c.id} onPress={() => set('customerId')(c.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, marginRight: 6, marginBottom: 6, backgroundColor: f.customerId === c.id ? C.navy : '#fff', borderWidth: 1, borderColor: C.line }}><Text style={{ color: f.customerId === c.id ? '#fff' : C.text }}>{c.name}</Text></TouchableOpacity>)}
    </View>
    <Field label="Gold weight (grams)" value={f.weight} onChangeText={set('weight')} keyboardType="decimal-pad" />
    <Field label="Purity (karat)" value={f.purity} onChangeText={set('purity')} keyboardType="decimal-pad" />
    <Field label="Loan amount (₹)" value={f.principal} onChangeText={set('principal')} keyboardType="number-pad" />
    <Field label="Interest rate (% per month)" value={f.rate} onChangeText={set('rate')} keyboardType="decimal-pad" />
    <Field label="Tenure (months)" value={f.months} onChangeText={set('months')} keyboardType="number-pad" />
    <Photo label="Gold photo 1" value={f.photos[0]} onChange={(p) => set('photos')([p, f.photos[1]])} />
    <Photo label="Gold photo 2" value={f.photos[1]} onChange={(p) => set('photos')([f.photos[0], p])} />
    <Photo label="Customer signature (upload)" value={f.signature} onChange={set('signature')} />
    <Btn title="Create loan" onPress={submit} />
  </Page></>);
}
const reportText = (db, l) => { const c = calc(l, db.payments); return `Kuber Jewellery – Loan ${l.no}\nCustomer: ${cname(db, l.customerId)}\nGold: ${l.weight} g, ${l.purity}K\nLoan: ${inr(l.principal)} @ ${l.rate}% per month\nDate: ${dmy(l.date)}   Due: ${dmy(l.dueDate)}\nOutstanding today: ${inr(c.outstanding)}`; };

export function LoanDetail({ db, update, id, back }) {
  const l = db.loans.find((x) => x.id === id); const [amt, setAmt] = useState(''); const [note, setNote] = useState('');
  if (!l) return null;
  const c = calc(l, db.payments); const pays = db.payments.filter((p) => p.loanId === id);
  const pay = async () => {
    const a = Number(amt); if (!a || a <= 0) return notify('Enter a valid amount');
    await update((d) => ({ ...d, payments: [{ id: uid(), loanId: id, amount: a, note, date: today() }, ...d.payments] }));
    setAmt(''); setNote('');
  };
  const close = () => confirm('Close this loan?', () => update((d) => ({ ...d, loans: d.loans.map((x) => (x.id === id ? { ...x, status: 'closed', closedOn: today() } : x)) })), 'Close loan');
  return (<><Header title={l.no} onBack={back} /><Page>
    <Card>
      <Row a="Customer" b={cname(db, l.customerId)} bold />
      <Row a="Gold" b={`${l.weight} g · ${l.purity}K`} />
      <Row a="Loan date / due" b={`${dmy(l.date)} → ${dmy(l.dueDate)}`} />
      <Row a="Principal" b={inr(l.principal)} />
      <Row a={`Interest (${l.rate}% / month, ${c.days} days)`} b={inr(c.interest)} />
      <Row a="Paid so far" b={inr(c.paid)} color={C.green} />
      <Row a="Outstanding" b={inr(c.outstanding)} bold color={c.overdue ? C.red : C.navy} />
    </Card>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[...(l.photos || []), l.signature].filter(Boolean).map((p, i) => <Image key={i} source={{ uri: p }} style={{ width: 90, height: 90, borderRadius: 8, marginRight: 8, marginBottom: 8 }} />)}</View>
    {l.status === 'active' ? (<>
      <Text style={{ fontWeight: '700', marginVertical: 8 }}>Record payment</Text>
      <Field label="Amount (₹)" value={amt} onChangeText={setAmt} keyboardType="number-pad" />
      <Field label="Note (optional)" value={note} onChangeText={setNote} />
      <Btn title="Save payment" onPress={pay} />
      <Btn title="Send loan report" kind="ghost" onPress={() => Share.share({ message: reportText(db, l) }).catch(() => {})} />
      <Btn title="Close loan" kind="danger" onPress={close} />
    </>) : <Chip text={`Closed on ${dmy(l.closedOn)}`} color={C.green} />}
    <Text style={{ fontWeight: '700', marginTop: 16, marginBottom: 6 }}>Payments</Text>
    {pays.length === 0 ? <Text style={{ color: C.mute }}>No payments recorded.</Text> : pays.map((p) => <Row key={p.id} a={`${dmy(p.date)} ${p.note || ''}`} b={inr(p.amount)} />)}
  </Page></>);
}

/* ---------- Reports (on-screen only) ---------- */
export function Reports({ db, go }) {
  const [t, setT] = useState('loan');
  const tabs = [['loan', 'Loans'], ['pay', 'Collections'], ['out', 'Outstanding'], ['over', 'Overdue'], ['cust', 'Statements']];
  const rows = db.loans.map((l) => ({ l, c: calc(l, db.payments) }));
  let body;
  if (t === 'pay') body = db.payments.map((p) => { const l = db.loans.find((x) => x.id === p.loanId) || {}; return <Card key={p.id}><Row a={`${dmy(p.date)} · ${l.no}`} b={inr(p.amount)} bold /><Text style={{ color: C.mute }}>{cname(db, l.customerId)}</Text></Card>; });
  else if (t === 'cust') body = db.customers.map((c) => <Card key={c.id} onPress={() => go('statement', { id: c.id })}><Text style={{ fontWeight: '700' }}>{c.name}</Text></Card>);
  else {
    const f = t === 'out' ? rows.filter((r) => r.c.outstanding > 0) : t === 'over' ? rows.filter((r) => r.c.overdue) : rows;
    body = f.map(({ l, c }) => <Card key={l.id} onPress={() => go('loan', { id: l.id })}><Row a={`${l.no} · ${cname(db, l.customerId)}`} b={inr(t === 'loan' ? l.principal : c.outstanding)} bold /><Row a={`${dmy(l.date)} → ${dmy(l.dueDate)}`} b={l.status} /></Card>);
    if (t === 'out') body.push(<Row key="tot" a="Total outstanding" b={inr(f.reduce((s, r) => s + r.c.outstanding, 0))} bold />);
  }
  return (<Page>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      {tabs.map(([k, n]) => <TouchableOpacity key={k} onPress={() => setT(k)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, marginRight: 6, backgroundColor: t === k ? C.navy : '#fff', borderWidth: 1, borderColor: C.line }}><Text style={{ color: t === k ? '#fff' : C.text }}>{n}</Text></TouchableOpacity>)}
    </ScrollView>
    {body.length ? body : <Empty text="Nothing to show yet." />}
  </Page>);
}
export function Statement({ db, id, back, go }) {
  const c = db.customers.find((x) => x.id === id); if (!c) return null;
  const loans = db.loans.filter((l) => l.customerId === id);
  return (<><Header title="Customer statement" onBack={back} /><Page>
    <Card><Text style={{ fontWeight: '800', fontSize: 17 }}>{c.name}</Text><Text style={{ color: C.mute }}>{c.phone}{c.address ? ' · ' + c.address : ''}</Text><Text style={{ color: C.mute }}>{c.idType}: {c.idNo || '-'}</Text></Card>
    {loans.length === 0 ? <Empty text="No loans for this customer." /> : loans.map((l) => { const k = calc(l, db.payments); return (
      <Card key={l.id} onPress={() => go('loan', { id: l.id })}><Row a={l.no} b={l.status} bold /><Row a="Principal" b={inr(l.principal)} /><Row a="Paid" b={inr(k.paid)} /><Row a="Outstanding" b={inr(k.outstanding)} bold /></Card>); })}
  </Page></>);
}

/* ---------- Backup & restore ---------- */
export function Backup({ db, update, lock }) {
  const json = JSON.stringify({ ...db, pin: undefined });
  const [txt, setTxt] = useState('');
  const restore = () => { try { const d = JSON.parse(txt); if (!d.customers || !d.loans) throw 0; confirm('Replace all current data with this backup?', () => update((o) => ({ ...o, customers: d.customers, loans: d.loans, payments: d.payments || [] })).then(() => notify('Backup restored')), 'Restore'); } catch (e) { notify('That does not look like a valid backup'); } };
  return (<Page>
    <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 6 }}>Backup</Text>
    <Text style={{ color: C.mute, marginBottom: 8 }}>Share the backup to WhatsApp, Drive or email to keep a copy off this device.</Text>
    <Btn title="Share backup" onPress={() => Share.share({ message: json }).catch(() => {})} />
    <Text style={{ fontWeight: '700', fontSize: 16, marginTop: 18, marginBottom: 6 }}>Restore</Text>
    <Field label="Paste backup text" value={txt} onChangeText={setTxt} multiline />
    <Btn title="Restore from backup" kind="ghost" onPress={restore} />
    <Btn title="Lock app" kind="danger" onPress={lock} style={{ marginTop: 24 }} />
  </Page>);
}
