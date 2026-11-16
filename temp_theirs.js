import React, { useState, useRef, forwardRef } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Share, TextInput, Platform, Switch, Modal, ActionSheetIOS } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as ImagePicker from 'expo-image-picker';
import { C, Btn, Field, Card, Header, Row, Chip, Empty, PasswordModal, SuggestField, SignaturePad, CalendarPicker, s } from './ui';
import { uid, today, inr, dmy, parseDmy, addMonths, calc, notify, confirm, nextSerial, nextCustomerSerial, monthsBetween } from './utils';
import { saveImage, LIMIT } from './storage';

const METALS = ['Gold', 'Silver', 'Others'];
const PAY_METHODS = ['Cash', 'UPI', 'Bank'];

const pickFromGallery = async () => {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: false });
  if (r.canceled) return null;
  return await saveImage(r.assets[0].uri);
};

const pickFromCamera = async () => {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) { notify('Camera permission denied'); return null; }
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, base64: false });
  if (r.canceled) return null;
  return await saveImage(r.assets[0].uri);
};

const Photo = ({ label, value, onChange }) => {
  const [sheet, setSheet] = useState(false);

  const handlePress = () => {
    if (Platform.OS === 'web') { pickFromGallery().then((p) => { if (p) onChange(p); }); return; }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', '📷 Camera', '🖼 Gallery'], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) pickFromCamera().then((p) => { if (p) onChange(p); });
          if (i === 2) pickFromGallery().then((p) => { if (p) onChange(p); });
        }
      );
    } else {
      setSheet(true);
    }
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 5 }}>{label}</Text>
      <TouchableOpacity onPress={handlePress}
        style={{ height: 90, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: C.gold, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {value ? <Image source={{ uri: value }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ color: C.gold, fontWeight: '600' }}>Tap to add</Text>}
      </TouchableOpacity>
      {/* Android bottom sheet */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: '#0006' }} activeOpacity={1} onPress={() => setSheet(false)} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
          <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 12, color: C.navy }}>Add photo</Text>
          {[['📷  Camera', pickFromCamera], ['🖼  Gallery', pickFromGallery]].map(([title, fn]) => (
            <TouchableOpacity key={title} onPress={async () => { setSheet(false); const p = await fn(); if (p) onChange(p); }}
              style={{ paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line }}>
              <Text style={{ fontSize: 16, color: C.text }}>{title}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setSheet(false)} style={{ paddingVertical: 14 }}>
            <Text style={{ fontSize: 16, color: C.red, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const Page = ({ children }) => (
  <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
);

const Stat = ({ label, value, color, onPress }) => (
  <TouchableOpacity onPress={onPress} disabled={!onPress}
    style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.line, margin: 4, minWidth: 140 }}>
    <Text style={{ color: C.mute, fontSize: 12 }}>{label}</Text>
    <Text style={{ color: color || C.navy, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{value}</Text>
  </TouchableOpacity>
);

const cname = (db, id) => (db.customers.find((c) => c.id === id) || {}).name || 'Unknown';

/* ---------- Login ---------- */
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
      <Text style={{ fontSize: 64, textAlign: 'center', marginBottom: 4 }}>💍</Text>
      <Text style={{ color: '#B9C6D3', marginBottom: 30, textAlign: 'center' }}>Gold loan manager</Text>
      <Text style={{ color: '#fff', marginBottom: 8 }}>{first ? 'Create a 4-digit PIN' : 'Enter your PIN'}</Text>
      <Field label="" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" />
      {first ? <Field label="" value={pin2} onChangeText={setPin2} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="Confirm PIN" /> : null}
      <Btn title={first ? 'Save PIN and continue' : 'Unlock'} onPress={go} style={{ backgroundColor: C.gold }} />
    </View>
  );
}

/* ---------- Dashboard ---------- */
export function Dashboard({ db, update, go }) {
  const rows = db.loans.map((l) => ({ l, c: calc(l, db.payments) }));
  const active = rows.filter((r) => r.l.status === 'active');
  const overdue = active.filter((r) => r.c.overdue);
  const todayCol = db.payments.filter((p) => p.date === today()).reduce((s, p) => s + p.amount, 0);
  const soon = active.filter((r) => !r.c.overdue && new Date(r.l.dueDate) - new Date() < 3 * 86400000);

  // Day entry state
  const [selLoan, setSelLoan] = useState(null);
  const [dayAmt, setDayAmt] = useState('');
  const [dayType, setDayType] = useState('interest');
  const [dayNote, setDayNote] = useState('');
  const [dayDate, setDayDate] = useState('');
  const [dayMethod, setDayMethod] = useState('Cash');
  const [loanQ, setLoanQ] = useState('');

  const cashInHand = db.cashInHand || 0;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const filteredLoans = active
    .filter(({ l }) => {
      const cust = db.customers.find((c) => c.id === l.customerId) || {};
      return (cust.name + l.no + (cust.custNo || '')).toLowerCase().includes(loanQ.toLowerCase());
    }).slice(0, 6);

  const saveEntry = async () => {
    if (!selLoan) return notify('Select a loan');
    if (dayType === 'close') {
      confirm(`Close loan ${selLoan.no}?`, () =>
        update((d) => ({ ...d, loans: d.loans.map((x) => x.id === selLoan.id ? { ...x, status: 'closed', closedOn: today() } : x) }))
          .then(() => { setSelLoan(null); setLoanQ(''); }), 'Close');
      return;
    }
    const a = Number(dayAmt);
    if (!a || a <= 0) return notify('Enter a valid amount');
    const cashDelta = dayMethod === 'Cash' ? a : 0;
    await update((d) => ({
      ...d,
      cashInHand: (d.cashInHand || 0) + cashDelta,
      payments: [{ id: uid(), loanId: selLoan.id, amount: a, note: dayNote || dayType, date: dayDate || today(), colType: dayType, method: dayMethod }, ...d.payments],
    }));
    setDayAmt(''); setDayNote(''); setDayDate(''); setSelLoan(null); setLoanQ('');
  };

  return (
    <Page>
      {/* Date */}
      <View style={{ backgroundColor: C.navy, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <Text style={{ color: C.gold, fontWeight: '800', fontSize: 16 }}>{dateStr}</Text>
        <Text style={{ color: '#B9C6D3', fontSize: 13, marginTop: 2 }}>Today's collections: {inr(todayCol)}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <Text style={{ color: '#B9C6D3', fontSize: 13 }}>Cash in hand: {inr(cashInHand)}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => update((d) => ({ ...d, cashInHand: (d.cashInHand || 0) + todayCol }))} style={{ backgroundColor: C.gold + '33', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: C.gold, fontSize: 12, fontWeight: '700' }}>+ Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => update((d) => ({ ...d, cashInHand: 0 }))} style={{ backgroundColor: '#ffffff22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: '#B9C6D3', fontSize: 12, fontWeight: '700' }}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Btn title="+ New Loan" onPress={() => go('loanForm')} style={{ flex: 1, marginVertical: 0 }} />
        <Btn title="+ Customer" onPress={() => go('customerForm')} style={{ flex: 1, marginVertical: 0 }} kind="ghost" />
      </View>

      {/* Day Entry */}
      <Card>
        <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 8, color: C.text }}>Day Entry</Text>
        <TextInput value={loanQ} onChangeText={setLoanQ} placeholder="Search loan / customer…"
          placeholderTextColor="#9AA7B4" style={[s.input, { marginBottom: 6 }]} />
        {loanQ.length > 0 && filteredLoans.map(({ l }) => {
          const cust = db.customers.find((c) => c.id === l.customerId) || {};
          const selected = selLoan?.id === l.id;
          return (
            <TouchableOpacity key={l.id} onPress={() => { setSelLoan(l); setLoanQ(cust.name + ' · ' + l.no); }}
              style={{ padding: 10, borderRadius: 8, marginBottom: 4, backgroundColor: selected ? C.navy : '#fff', borderWidth: 1, borderColor: C.line }}>
              <Text style={{ color: selected ? '#fff' : C.text, fontWeight: '600' }}>{cust.name || 'Unknown'} · {l.no}</Text>
              <Text style={{ color: selected ? '#ddd' : C.mute, fontSize: 12 }}>{cust.custNo || ''} · Outstanding: {inr(calc(l, db.payments).outstanding)}</Text>
            </TouchableOpacity>
          );
        })}
        {selLoan && (
          <View style={{ backgroundColor: C.goldSoft, borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <Text style={{ color: C.navy, fontWeight: '700', marginBottom: 6 }}>{selLoan.no} · {cname(db, selLoan.customerId)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              {[['interest', 'Interest'], ['capital', 'Capital'], ['close', 'Close Loan']].map(([k, label]) => (
                <TouchableOpacity key={k} onPress={() => setDayType(k)}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, marginRight: 6, marginBottom: 4,
                    backgroundColor: dayType === k ? (k === 'close' ? C.red : C.navy) : '#fff', borderWidth: 1, borderColor: k === 'close' ? C.red : C.line }}>
                  <Text style={{ color: dayType === k ? '#fff' : (k === 'close' ? C.red : C.text), fontSize: 13, fontWeight: '600' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {dayType !== 'close' && (
              <>
                <Field label="Amount (₹)" value={dayAmt} onChangeText={setDayAmt} keyboardType="number-pad" />
                <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Payment method</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                  {PAY_METHODS.map((m) => (
                    <TouchableOpacity key={m} onPress={() => setDayMethod(m)}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1,
                        borderColor: dayMethod === m ? C.navy : C.line, backgroundColor: dayMethod === m ? C.navy : '#fff' }}>
                      <Text style={{ color: dayMethod === m ? '#fff' : C.text, fontWeight: '600', fontSize: 13 }}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Date (blank = today)</Text>
                <CalendarPicker value={dayDate} onChange={setDayDate} label={dmy(today())} />
                <Field label="Note (optional)" value={dayNote} onChangeText={setDayNote} />
              </>
            )}
            <Btn title={dayType === 'close' ? 'Close Loan' : 'Save Entry'}
              onPress={saveEntry}
              style={{ marginVertical: 0, backgroundColor: dayType === 'close' ? C.red : C.navy }} />
          </View>
        )}
      </Card>

      {/* Reminders */}
      {overdue.length + soon.length > 0 && (
        <>
          <Text style={{ fontWeight: '700', fontSize: 15, marginTop: 8, marginBottom: 6, color: C.text }}>Reminders</Text>
          {overdue.concat(soon).map(({ l, c }) => (
            <Card key={l.id} onPress={() => go('loan', { id: l.id })}>
              <Row a={cname(db, l.customerId)} b={inr(c.outstanding)} bold />
              <Row a={c.overdue ? 'Overdue since' : 'Due on'} b={dmy(l.dueDate)} color={c.overdue ? C.red : C.gold} />
            </Card>
          ))}
        </>
      )}
    </Page>
  );
}

/* ---------- Dashboard Config ---------- */
export function DashboardConfig({ db, update, back }) {
  const cfg = db.dashboardConfig || {};
  const toggle = (key) => update((d) => ({ ...d, dashboardConfig: { ...d.dashboardConfig, [key]: !(d.dashboardConfig?.[key] !== false) } }));
  const items = [['activeLoans', 'Active Loans'], ['outstanding', 'Outstanding'], ['todayCollections', "Today's Collections"], ['overdue', 'Overdue']];
  return (
    <><Header title="Customise Dashboard" onBack={back} />
    <Page>
      {items.map(([key, label]) => (
        <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.text, fontSize: 15 }}>{label}</Text>
          <Switch value={cfg[key] !== false} onValueChange={() => toggle(key)} trackColor={{ true: C.gold }} />
        </View>
      ))}
    </Page></>
  );
}

/* ---------- Customers ---------- */
export function Customers({ db, go }) {
  const [q, setQ] = useState('');
  const list = db.customers.filter((c) => (c.name + c.phone).toLowerCase().includes(q.toLowerCase()));
  return (
    <Page>
      <Field label="" value={q} onChangeText={setQ} placeholder="Search by name or phone" autoFocus={Platform.OS === 'web'} />
      <Btn title={`Add customer (${db.customers.length})`} onPress={() => go('customerForm')} />
      {list.length === 0 ? <Empty text="No customers yet." /> : null}
      {list.map((c) => (
        <Card key={c.id} onPress={() => go('statement', { id: c.id })} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {c.photo
            ? <Image source={{ uri: c.photo }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
            : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.goldSoft, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.gold, fontWeight: '800' }}>{c.name[0]}</Text></View>}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: C.text }}>{c.name}</Text>
            <Text style={{ color: C.mute }}>{c.custNo ? c.custNo + ' · ' : ''}{c.phone}</Text>
          </View>
          <TouchableOpacity onPress={() => go('customerEdit', { id: c.id })} style={{ padding: 8 }}>
            <Text style={{ color: C.gold, fontWeight: '700' }}>Edit</Text>
          </TouchableOpacity>
        </Card>
      ))}
    </Page>
  );
}

const EMPTY_CUSTOMER = { name: '', phone: '', address: '', idType: 'Aadhaar', idNo: '', photo: null, idPhoto: null };

export function CustomerForm({ db, update, back, goNext }) {
  const [f, setF] = useState(EMPTY_CUSTOMER);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const refs = { phone: useRef(), address: useRef(), idType: useRef(), idNo: useRef() };
  const submit = async (andNext = false) => {
    if (!f.name.trim() || !f.phone.trim()) return notify('Name and phone are required');
    await update((d) => {
      if (d.customers.length >= LIMIT) { notify(`Limit reached`); return d; }
      const custNo = nextCustomerSerial(d.customers);
      return { ...d, customers: [{ ...f, id: uid(), custNo, createdAt: today() }, ...d.customers] };
    });
    if (andNext) { setF(EMPTY_CUSTOMER); } else back();
  };
  return (
    <><Header title="Add customer" onBack={back} />
    <Page>
      <Photo label="Customer photo" value={f.photo} onChange={set('photo')} />
      <Field label="Full name" value={f.name} onChangeText={set('name')} returnKeyType="next" onSubmitEditing={() => refs.phone.current?.focus()} />
      <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" ref={refs.phone} returnKeyType="next" onSubmitEditing={() => refs.address.current?.focus()} />
      <Field label="Address" value={f.address} onChangeText={set('address')} multiline ref={refs.address} />
      <Field label="ID proof type" value={f.idType} onChangeText={set('idType')} ref={refs.idType} returnKeyType="next" onSubmitEditing={() => refs.idNo.current?.focus()} />
      <Field label="ID number" value={f.idNo} onChangeText={set('idNo')} ref={refs.idNo} />
      <Photo label="ID proof photo" value={f.idPhoto} onChange={set('idPhoto')} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn title="Save" onPress={() => submit(false)} style={{ flex: 1 }} />
        <Btn title="Save & Next" onPress={() => submit(true)} style={{ flex: 1 }} kind="ghost" />
      </View>
    </Page></>
  );
}

export function CustomerEdit({ db, update, back, id }) {
  const [pwVisible, setPwVisible] = useState(!db.editPassword);
  const [unlocked, setUnlocked] = useState(!db.editPassword);
  const cust = db.customers.find((c) => c.id === id);
  const [f, setF] = useState(cust ? { ...cust } : EMPTY_CUSTOMER);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  if (!cust) return null;
  const submit = async () => {
    if (!f.name.trim() || !f.phone.trim()) return notify('Name and phone are required');
    await update((d) => ({ ...d, customers: d.customers.map((c) => c.id === id ? { ...c, ...f } : c) }));
    back();
  };
  if (!unlocked) return (
    <PasswordModal visible={!unlocked} storedPassword={db.editPassword}
      onOk={() => setUnlocked(true)} onCancel={back} title="Enter edit password to edit customer" />
  );
  return (
    <><Header title="Edit customer" onBack={back} />
    <Page>
      <Photo label="Customer photo" value={f.photo} onChange={set('photo')} />
      <Field label="Full name" value={f.name} onChangeText={set('name')} />
      <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Address" value={f.address} onChangeText={set('address')} multiline />
      <Field label="ID proof type" value={f.idType} onChangeText={set('idType')} />
      <Field label="ID number" value={f.idNo} onChangeText={set('idNo')} />
      <Photo label="ID proof photo" value={f.idPhoto} onChange={set('idPhoto')} />
      <Btn title="Save changes" onPress={submit} />
    </Page></>
  );
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
      {list.map((l) => { const c = calc(l, db.payments); const cust = db.customers.find((x) => x.id === l.customerId) || {}; return (
        <Card key={l.id} onPress={() => go('loan', { id: l.id })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700' }}>{l.no} · {cust.name || 'Unknown'}</Text>
            {c.overdue ? <Chip text="Overdue" color={C.red} /> : null}
          </View>
          {cust.custNo ? <Text style={{ color: C.gold, fontSize: 12, fontWeight: '600', marginBottom: 2 }}>{cust.custNo}</Text> : null}
          <Row a="Principal" b={inr(l.principal)} /><Row a="Outstanding" b={inr(c.outstanding)} bold />
        </Card>); })}
    </Page>
  );
}

const EMPTY_ORNAMENT = { desc: '', weight: '', purity: '22', metal: 'Gold' };

export function LoanForm({ db, update, back, go }) {
  const cfg = db.settings || {};
  const [custQ, setCustQ] = useState('');
  const [ornaments, setOrnaments] = useState([{ ...EMPTY_ORNAMENT }]);
  const [f, setF] = useState({
    customerId: '', principal: '', rate: cfg.defaultRate || '2', months: cfg.defaultMonths || '6',
    interestMode: cfg.defaultInterestMode || 'day',
    goldPhoto: null, signaturePaths: [], date: today(), dueDate: '',
  });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const refs = { principal: useRef(), rate: useRef(), months: useRef() };

  const filteredCusts = db.customers.filter((c) =>
    (c.name + c.phone).toLowerCase().includes(custQ.toLowerCase())
  ).slice(0, 8);

  const suggestions = db.itemSuggestions || [];

  const setOrn = (i, k, v) => setOrnaments((prev) => prev.map((o, idx) => idx === i ? { ...o, [k]: v } : o));
  const addOrn = () => setOrnaments((prev) => [...prev, { ...EMPTY_ORNAMENT }]);
  const removeOrn = (i) => setOrnaments((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  const totalWeight = ornaments.reduce((s, o) => s + (parseFloat(o.weight) || 0), 0);

  const submit = async (andNext = false) => {
    if (!f.customerId) return notify('Select a customer');
    const principal = Number(f.principal);
    if (!principal) return notify('Enter loan amount');
    if (ornaments.some((o) => !o.weight || isNaN(parseFloat(o.weight)))) return notify('Enter weight for all ornaments');
    if (db.loans.length >= LIMIT) return notify(`Loan limit of ${LIMIT} reached`);
    const loanDate = f.date || today();
    const dueDate = f.dueDate || addMonths(loanDate, f.months);
    const no = nextSerial(db.loans);
    const loan = {
      id: uid(), no, customerId: f.customerId,
      ornaments,
      itemDesc: ornaments.map((o) => o.desc).filter(Boolean).join(', ') || '-',
      weight: totalWeight, purity: ornaments[0].purity,
      principal, rate: Number(f.rate) || 0,
      interestMode: f.interestMode || 'day',
      date: loanDate, dueDate, goldPhoto: f.goldPhoto, signaturePaths: f.signaturePaths, status: 'active',
    };
    const newDescs = ornaments.map((o) => o.desc).filter((d) => d && !suggestions.includes(d));
    const newSuggestions = newDescs.length ? [...suggestions, ...newDescs] : suggestions;
    await update((d) => ({ ...d, loans: [loan, ...d.loans], itemSuggestions: newSuggestions }));
    const msg = reportText(db, loan);
    confirm('Loan created. Send report to customer?', () => Share.share({ message: msg }).catch(() => {}), 'Send');
    if (andNext) {
      setF({ customerId: '', principal: '', rate: cfg.defaultRate || '2', months: cfg.defaultMonths || '6', interestMode: cfg.defaultInterestMode || 'day', goldPhoto: null, signaturePaths: [], date: today(), dueDate: '' });
      setOrnaments([{ ...EMPTY_ORNAMENT }]);
      setCustQ('');
    } else back();
  };

  return (
    <><Header title="New loan" onBack={back} />
    <Page>
      <Text style={{ color: C.mute, fontWeight: '600', marginBottom: 6 }}>Search customer</Text>
      <TextInput value={custQ} onChangeText={setCustQ} placeholder="Type name or phone…"
        placeholderTextColor="#9AA7B4" style={[s.input, { marginBottom: 6 }]} />
      {db.customers.length === 0
        ? <Btn title="Add a customer first" kind="ghost" onPress={() => go('customerForm')} />
        : custQ.length > 0 && filteredCusts.map((c) => (
          <TouchableOpacity key={c.id} onPress={() => { set('customerId')(c.id); setCustQ(c.name); }}
            style={{ padding: 10, borderRadius: 8, marginBottom: 4, backgroundColor: f.customerId === c.id ? C.navy : '#fff', borderWidth: 1, borderColor: C.line }}>
            <Text style={{ color: f.customerId === c.id ? '#fff' : C.text, fontWeight: '600' }}>{c.name}</Text>
            <Text style={{ color: f.customerId === c.id ? '#ddd' : C.mute, fontSize: 12 }}>{c.phone}</Text>
          </TouchableOpacity>
        ))}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Date</Text>
          <CalendarPicker value={f.date} onChange={set('date')} label="Select date" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Due date</Text>
          <CalendarPicker value={f.dueDate} onChange={set('dueDate')} label="Select due date" />
        </View>
      </View>

      <Text style={{ fontWeight: '700', color: C.text, marginBottom: 6 }}>Gold ornaments</Text>
      {ornaments.map((o, i) => {
        const metal = o.metal || 'Gold';
        const showPurity = metal === 'Gold';
        return (
          <View key={i} style={{ backgroundColor: C.goldSoft, borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.gold + '55' }}>
            {/* Title + Remove row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>Ornament {i + 1}</Text>
              {ornaments.length > 1 && (
                <TouchableOpacity onPress={() => removeOrn(i)} style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: C.red }}>
                  <Text style={{ color: C.red, fontWeight: '700', fontSize: 12 }}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Metal type selector */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {METALS.map((m) => (
                <TouchableOpacity key={m} onPress={() => setOrn(i, 'metal', m)}
                  style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5,
                    borderColor: metal === m ? C.gold : C.line,
                    backgroundColor: metal === m ? C.gold : '#fff' }}>
                  <Text style={{ color: metal === m ? '#fff' : C.mute, fontWeight: '700', fontSize: 13 }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <SuggestField label="Description" value={o.desc} onChangeText={(v) => setOrn(i, 'desc', v)} suggestions={suggestions} placeholder={metal === 'Gold' ? 'e.g. Gold chain' : metal === 'Silver' ? 'e.g. Silver anklet' : 'e.g. Platinum ring'} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <View style={{ flex: 1, minWidth: 120 }}><Field label="Weight (g)" value={o.weight} onChangeText={(v) => setOrn(i, 'weight', v)} keyboardType="decimal-pad" /></View>
              {showPurity && (
                <View style={{ flex: 1, minWidth: 120 }}><Field label="Purity (K)" value={o.purity} onChangeText={(v) => setOrn(i, 'purity', v)} keyboardType="decimal-pad" /></View>
              )}
            </View>
          </View>
        );
      })}
      <Btn title="+ Add ornament" kind="ghost" onPress={addOrn} style={{ marginBottom: 8 }} />
      {ornaments.length > 1 && <Text style={{ color: C.mute, fontSize: 13, marginBottom: 8 }}>Total weight: {totalWeight.toFixed(2)} g</Text>}

      <Field label="Loan amount (₹)" value={f.principal} onChangeText={set('principal')} keyboardType="number-pad" ref={refs.principal} returnKeyType="next" onSubmitEditing={() => refs.rate.current?.focus()} />
      <Field label="Interest rate (% / month)" value={f.rate} onChangeText={set('rate')} keyboardType="decimal-pad" ref={refs.rate} returnKeyType="next" onSubmitEditing={() => refs.months.current?.focus()} />
      <Field label="Tenure (months)" value={f.months} onChangeText={set('months')} keyboardType="number-pad" ref={refs.months} />
      <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Interest calculation</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {[['day', 'Day-wise'], ['month', 'Month-wise']].map(([k, label]) => (
          <TouchableOpacity key={k} onPress={() => set('interestMode')(k)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1,
              borderColor: f.interestMode === k ? C.navy : C.line, backgroundColor: f.interestMode === k ? C.navy : '#fff' }}>
            <Text style={{ color: f.interestMode === k ? '#fff' : C.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Photo label="Gold photo" value={f.goldPhoto} onChange={set('goldPhoto')} />
      <SignaturePad value={f.signaturePaths} onChange={set('signaturePaths')} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn title="Create loan" onPress={() => submit(false)} style={{ flex: 1 }} />
        <Btn title="Save & Next" onPress={() => submit(true)} style={{ flex: 1 }} kind="ghost" />
      </View>
    </Page></>
  );
}

const reportText = (db, l) => {
  const c = calc(l, db.payments || []);
  const cust = db.customers.find((x) => x.id === l.customerId) || {};
  const orns = l.ornaments && l.ornaments.length > 0
    ? l.ornaments.map((o, i) => `  ${i + 1}. ${o.desc || 'Item'} – ${o.weight}g, ${o.purity}K`).join('\n')
    : `  ${l.itemDesc || '-'} – ${l.weight}g, ${l.purity}K`;
  return `Kuber Jewellery – Loan ${l.no}\nCustomer: ${cust.name || 'Unknown'}${cust.custNo ? ' (' + cust.custNo + ')' : ''}\nOrnaments:\n${orns}\nTotal weight: ${l.weight}g\nLoan: ${inr(l.principal)} @ ${l.rate}% per month\nDate: ${dmy(l.date)}   Due: ${dmy(l.dueDate)}\nOutstanding today: ${inr(c.outstanding)}`;
};

/* ---------- Loan Detail with collection types ---------- */
const COL_TYPES = [
  { key: 'interest', label: 'Interest only' },
  { key: 'partial', label: 'Partial capital' },
  { key: 'capital', label: 'Capital amount' },
  { key: 'settlement', label: 'Full settlement' },
];

export function LoanDetail({ db, update, id, back }) {
  const l = db.loans.find((x) => x.id === id);
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [colType, setColType] = useState('interest');
  const [payMethod, setPayMethod] = useState('Cash');
  const [editDate, setEditDate] = useState('');
  const [pwVisible, setPwVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState(null);

  if (!l) return null;
  const c = calc(l, db.payments);
  const pays = db.payments.filter((p) => p.loanId === id);

  const pay = async () => {
    const a = Number(amt); if (!a || a <= 0) return notify('Enter a valid amount');
    const payDate = editDate || today();
    const cashDelta = payMethod === 'Cash' ? a : 0;
    await update((d) => ({
      ...d,
      cashInHand: (d.cashInHand || 0) + cashDelta,
      payments: [{ id: uid(), loanId: id, amount: a, note: note || colType, date: payDate, colType, method: payMethod }, ...d.payments],
      loans: colType === 'settlement'
        ? d.loans.map((x) => x.id === id ? { ...x, status: 'closed', closedOn: payDate } : x)
        : d.loans,
    }));
    setAmt(''); setNote(''); setEditDate('');
  };

  const close = () => confirm('Close this loan?', () =>
    update((d) => ({ ...d, loans: d.loans.map((x) => x.id === id ? { ...x, status: 'closed', closedOn: today() } : x) })), 'Close loan');

  const startEdit = () => {
    if (db.editPassword) setPwVisible(true);
    else { setEditFields({ ...l }); setEditMode(true); }
  };
  const saveEdit = async () => {
    await update((d) => ({ ...d, loans: d.loans.map((x) => x.id === id ? { ...x, ...editFields } : x) }));
    setEditMode(false);
  };

  // balance breakdown
  const interestDue = Math.max(0, c.interest - pays.filter((p) => p.colType === 'interest').reduce((s, p) => s + p.amount, 0));
  const capitalPaid = pays.filter((p) => ['capital', 'settlement', 'partial'].includes(p.colType)).reduce((s, p) => s + p.amount, 0);
  const capitalBalance = Math.max(0, l.principal - capitalPaid);

  return (
    <><Header title={l.no} onBack={back} right={
      <TouchableOpacity onPress={startEdit} style={{ paddingHorizontal: 10 }}>
        <Text style={{ color: C.gold, fontWeight: '700' }}>Edit</Text>
      </TouchableOpacity>
    } />
    <PasswordModal visible={pwVisible} storedPassword={db.editPassword}
      onOk={() => { setPwVisible(false); setEditFields({ ...l }); setEditMode(true); }}
      onCancel={() => setPwVisible(false)} />
    <Page>
      {editMode && editFields ? (
        <Card>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>Edit loan details</Text>
          <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Date</Text>
          <CalendarPicker value={editFields.date} onChange={(v) => setEditFields((p) => ({ ...p, date: v }))} label="Select date" />
          <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Due date</Text>
          <CalendarPicker value={editFields.dueDate} onChange={(v) => setEditFields((p) => ({ ...p, dueDate: v }))} label="Select due date" />
          <Field label="Principal (₹)" value={String(editFields.principal)} onChangeText={(v) => setEditFields((p) => ({ ...p, principal: Number(v) || 0 }))} keyboardType="number-pad" />
          <Field label="Rate (% / month)" value={String(editFields.rate)} onChangeText={(v) => setEditFields((p) => ({ ...p, rate: Number(v) || 0 }))} keyboardType="decimal-pad" />
          <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Interest calculation</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {[['day', 'Day-wise'], ['month', 'Month-wise']].map(([k, label]) => (
              <TouchableOpacity key={k} onPress={() => setEditFields((p) => ({ ...p, interestMode: k }))}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1,
                  borderColor: (editFields.interestMode || 'day') === k ? C.navy : C.line,
                  backgroundColor: (editFields.interestMode || 'day') === k ? C.navy : '#fff' }}>
                <Text style={{ color: (editFields.interestMode || 'day') === k ? '#fff' : C.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {(editFields.ornaments || [{ desc: editFields.itemDesc || '', weight: String(editFields.weight || ''), purity: String(editFields.purity || '22') }]).map((o, i) => (
            <View key={i} style={{ backgroundColor: C.goldSoft, borderRadius: 8, padding: 8, marginBottom: 6 }}>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 12, marginBottom: 4 }}>Ornament {i + 1}</Text>
              <Field label="Description" value={o.desc || ''} onChangeText={(v) => setEditFields((p) => { const orns = [...(p.ornaments || [o])]; orns[i] = { ...orns[i], desc: v }; return { ...p, ornaments: orns, itemDesc: orns.map((x) => x.desc).filter(Boolean).join(', ') }; })} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Field label="Weight (g)" value={String(o.weight || '')} onChangeText={(v) => setEditFields((p) => { const orns = [...(p.ornaments || [o])]; orns[i] = { ...orns[i], weight: v }; return { ...p, ornaments: orns, weight: orns.reduce((s, x) => s + (parseFloat(x.weight) || 0), 0) }; })} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Purity (K)" value={String(o.purity || '')} onChangeText={(v) => setEditFields((p) => { const orns = [...(p.ornaments || [o])]; orns[i] = { ...orns[i], purity: v }; return { ...p, ornaments: orns }; })} keyboardType="decimal-pad" /></View>
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn title="Save" onPress={saveEdit} style={{ flex: 1 }} />
            <Btn title="Cancel" kind="ghost" onPress={() => setEditMode(false)} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}

      <Card>
        {(() => { const cust = db.customers.find((x) => x.id === l.customerId); return cust ? <Row a={`Customer${cust.custNo ? ' · ' + cust.custNo : ''}`} b={cust.name} bold /> : <Row a="Customer" b="Unknown" bold />; })()}
        <Row a="Loan ID" b={l.no} />
        {l.ornaments && l.ornaments.length > 0
          ? l.ornaments.map((o, i) => (
              <Row key={i} a={`${o.metal || 'Gold'} ${i + 1}${o.desc ? ' · ' + o.desc : ''}`} b={`${o.weight}g · ${o.purity}K`} />
            ))
          : <Row a="Item" b={`${l.itemDesc || '-'} · ${l.weight}g · ${l.purity}K`} />}
        <Row a="Total weight" b={`${l.weight} g`} />
        <Row a="Loan date / due" b={`${dmy(l.date)} → ${dmy(l.dueDate)}`} />
        <Row a="Principal" b={inr(l.principal)} />
        <Row a={`Interest (${l.rate}% / month, ${c.mode === 'month' ? monthsBetween(l.date, today()) + ' months' : c.days + ' days'})`} b={inr(c.interest)} />
        <Row a="Paid so far" b={inr(c.paid)} color={C.green} />
        <Row a="Outstanding" b={inr(c.outstanding)} bold color={c.overdue ? C.red : C.navy} />
      </Card>

      <Card>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Balance breakdown</Text>
        <Row a="Interest balance" b={inr(interestDue)} color={C.gold} />
        <Row a="Capital balance" b={inr(capitalBalance)} color={C.navy} />
        <Row a="Settlement amount" b={inr(c.outstanding)} bold color={c.overdue ? C.red : C.navy} />
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {[...(l.goldPhoto ? [l.goldPhoto] : []), ...(l.photos || []), l.signature].filter(Boolean).map((p, i) =>
          <Image key={i} source={{ uri: p }} style={{ width: 90, height: 90, borderRadius: 8, marginRight: 8, marginBottom: 8 }} />
        )}
      </View>

      {l.status === 'active' ? (
        <>
          <Text style={{ fontWeight: '700', marginVertical: 8 }}>Record collection</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {COL_TYPES.map((t) => (
              <TouchableOpacity key={t.key} onPress={() => setColType(t.key)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, marginRight: 6, marginBottom: 6, backgroundColor: colType === t.key ? C.navy : '#fff', borderWidth: 1, borderColor: C.line }}>
                <Text style={{ color: colType === t.key ? '#fff' : C.text, fontSize: 13 }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Amount (₹)" value={amt} onChangeText={setAmt} keyboardType="number-pad" />
          <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Payment method</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {PAY_METHODS.map((m) => (
              <TouchableOpacity key={m} onPress={() => setPayMethod(m)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1,
                  borderColor: payMethod === m ? C.navy : C.line, backgroundColor: payMethod === m ? C.navy : '#fff' }}>
                <Text style={{ color: payMethod === m ? '#fff' : C.text, fontWeight: '600', fontSize: 13 }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Date (leave blank for today)</Text>
          <CalendarPicker value={editDate} onChange={setEditDate} label={dmy(today())} />
          <Field label="Note (optional)" value={note} onChangeText={setNote} />
          <Btn title="Save collection" onPress={pay} />
          <Btn title="Send loan report" kind="ghost" onPress={() => Share.share({ message: reportText(db, l) }).catch(() => {})} />
          <Btn title="Close loan" kind="danger" onPress={close} />
        </>
      ) : <Chip text={`Closed on ${dmy(l.closedOn)}`} color={C.green} />}

      <Text style={{ fontWeight: '700', marginTop: 16, marginBottom: 6 }}>Collection history</Text>
      {pays.length === 0 ? <Text style={{ color: C.mute }}>No payments recorded.</Text> : pays.map((p) => (
        <Row key={p.id} a={`${dmy(p.date)} · ${p.colType || ''} · ${p.method || 'Cash'}${p.note ? ' · ' + p.note : ''}`} b={inr(p.amount)} />
      ))}
    </Page></>
  );
}

/* ---------- Member Summary ---------- */
export function MemberSummary({ db, go }) {
  const [q, setQ] = useState('');
  const rows = db.loans
    .filter((l) => l.status === 'active')
    .map((l) => ({ l, c: calc(l, db.payments), cust: db.customers.find((x) => x.id === l.customerId) || {} }))
    .filter(({ l, cust }) => (cust.name + l.no + (cust.custNo || '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.l.date < b.l.date ? -1 : 1));

  const totalInterest = rows.reduce((s, r) => s + r.c.interest, 0);
  const totalPending = rows.reduce((s, r) => s + r.c.outstanding, 0);

  return (
    <Page>
      <Field label="" value={q} onChangeText={setQ} placeholder="Search member / loan no." />
      {/* Totals */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        <Stat label="Total members" value={rows.length} />
        <Stat label="Total interest" value={inr(totalInterest)} color={C.gold} />
        <Stat label="Total pending" value={inr(totalPending)} color={C.red} />
      </View>
      {rows.length === 0 ? <Empty text="No active loans." /> : null}
      {rows.map(({ l, c, cust }) => (
        <Card key={l.id} onPress={() => go('loan', { id: l.id })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <Text style={{ fontWeight: '700', color: C.text, flex: 1 }}>{cust.name || 'Unknown'}</Text>
            {c.overdue ? <Chip text="Overdue" color={C.red} /> : null}
          </View>
          {cust.custNo ? <Text style={{ color: C.gold, fontSize: 12, fontWeight: '600', marginBottom: 2 }}>{cust.custNo} · {l.no}</Text>
            : <Text style={{ color: C.mute, fontSize: 12, marginBottom: 2 }}>{l.no}</Text>}
          <Row a="Loan date" b={dmy(l.date)} />
          <Row a={`Interest (${l.rate}%/mo)`} b={inr(c.interest)} color={C.gold} />
          <Row a="Pending" b={inr(c.outstanding)} bold color={c.overdue ? C.red : C.navy} />
        </Card>
      ))}
    </Page>
  );
}

/* ---------- Reports ---------- */
const shareCSV = async (filename, csv) => {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } else {
    const path = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Report' });
  }
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function Reports({ db, go }) {
  const [t, setT] = useState('loan');
  const [fMode, setFMode] = useState('date'); // 'date' | 'month' | 'year'
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [fMonth, setFMonth] = useState(''); // '01'..'12'
  const [fYear, setFYear] = useState('');   // '2024'
  const [fLoanNo, setFLoanNo] = useState('');
  const [fCustId, setFCustId] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const tabs = [['loan', 'Loans'], ['pay', 'Collections'], ['out', 'Outstanding'], ['over', 'Overdue'], ['cust', 'Statements']];
  const rows = db.loans.map((l) => ({ l, c: calc(l, db.payments) }));

  const matchesDateFilter = (dateStr) => {
    if (!dateStr) return true;
    if (fMode === 'date') {
      if (fFrom && dateStr < fFrom) return false;
      if (fTo && dateStr > fTo) return false;
    } else if (fMode === 'month') {
      if (fYear && !dateStr.startsWith(fYear)) return false;
      if (fMonth && dateStr.slice(5, 7) !== fMonth) return false;
    } else if (fMode === 'year') {
      if (fYear && !dateStr.startsWith(fYear)) return false;
    }
    return true;
  };

  const matchesFilter = (l) => {
    const cust = db.customers.find((c) => c.id === l.customerId) || {};
    if (!matchesDateFilter(l.date)) return false;
    if (fLoanNo && !l.no.toLowerCase().includes(fLoanNo.toLowerCase())) return false;
    if (fCustId && !(cust.custNo || '').toLowerCase().includes(fCustId.toLowerCase())) return false;
    if (fPhone && !(cust.phone || '').includes(fPhone)) return false;
    return true;
  };

  const hasDateFilter = fMode === 'date' ? (fFrom || fTo) : fMode === 'month' ? (fMonth || fYear) : fYear;
  const hasFilter = hasDateFilter || fLoanNo || fCustId || fPhone;
  const clearFilter = () => { setFFrom(''); setFTo(''); setFMonth(''); setFYear(''); setFLoanNo(''); setFCustId(''); setFPhone(''); };

  const exportPDF = async () => {
    const shopName = db.settings?.shopName || 'Kuber Jewellery';
    let headers = [], rowsData = [], title = '';
    if (t === 'pay') {
      title = 'Collections Report';
      headers = ['Date', 'Loan No', 'Customer', 'Type', 'Amount (₹)'];
      const pays = hasFilter
        ? db.payments.filter((p) => { const l = db.loans.find((x) => x.id === p.loanId); return l ? matchesFilter(l) : false; })
        : db.payments;
      rowsData = pays.map((p) => { const l = db.loans.find((x) => x.id === p.loanId) || {}; return [dmy(p.date), l.no || '-', cname(db, l.customerId), p.colType || '-', inr(p.amount)]; });
    } else if (t === 'cust') {
      title = 'Customer Statements';
      headers = ['Customer ID', 'Name', 'Phone', 'Address', 'Total Loans', 'Total Principal (₹)'];
      rowsData = db.customers.map((c) => { const cls = db.loans.filter((l) => l.customerId === c.id); return [c.custNo || '-', c.name, c.phone, c.address || '-', cls.length, inr(cls.reduce((s, l) => s + l.principal, 0))]; });
    } else {
      title = t === 'out' ? 'Outstanding Report' : t === 'over' ? 'Overdue Report' : 'Loans Report';
      headers = ['Loan No', 'Customer', 'Date', 'Due Date', 'Status', 'Principal (₹)', 'Interest (₹)', 'Paid (₹)', 'Outstanding (₹)'];
      const base = t === 'out' ? rows.filter((r) => r.c.outstanding > 0) : t === 'over' ? rows.filter((r) => r.c.overdue) : rows;
      const f = hasFilter ? base.filter(({ l }) => matchesFilter(l)) : base;
      rowsData = f.map(({ l, c }) => [l.no, cname(db, l.customerId), dmy(l.date), dmy(l.dueDate), l.status, inr(l.principal), inr(Math.round(c.interest)), inr(Math.round(c.paid)), inr(Math.round(c.outstanding))]);
    }
    const thCells = headers.map((h) => `<th>${h}</th>`).join('');
    const trRows = rowsData.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('');
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:16px}h2{color:#1a2e44}h3{color:#b8860b}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a2e44;color:#fff;padding:6px 8px;text-align:left}td{padding:5px 8px;border-bottom:1px solid #eee}tr:nth-child(even){background:#fafafa}</style></head><body><h2>${shopName}</h2><h3>${title}</h3><p>Generated: ${new Date().toLocaleDateString('en-IN')}</p><table><thead><tr>${thCells}</tr></thead><tbody>${trRows}</tbody></table></body></html>`;
    if (Platform.OS === 'web') {
      const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print();
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export PDF' });
    }
  };

  const exportReport = () => {
    let csv = '';
    if (t === 'pay') {
      const pays = hasFilter
        ? db.payments.filter((p) => { const l = db.loans.find((x) => x.id === p.loanId); return l ? matchesFilter(l) : false; })
        : db.payments;
      csv = 'Date,Loan No,Customer,Type,Amount (Rs)\n' +
        pays.map((p) => { const l = db.loans.find((x) => x.id === p.loanId) || {}; return [dmy(p.date), l.no || '-', cname(db, l.customerId), p.colType || '-', p.amount].join(','); }).join('\n');
      shareCSV('collections.csv', csv);
    } else if (t === 'cust') {
      csv = 'Customer ID,Customer,Phone,Address,Total Loans,Total Principal (Rs)\n' +
        db.customers.map((c) => { const cls = db.loans.filter((l) => l.customerId === c.id); return [c.custNo || '-', c.name, c.phone, c.address || '-', cls.length, cls.reduce((s, l) => s + l.principal, 0)].join(','); }).join('\n');
      shareCSV('statements.csv', csv);
    } else {
      const base = t === 'out' ? rows.filter((r) => r.c.outstanding > 0) : t === 'over' ? rows.filter((r) => r.c.overdue) : rows;
      const f = hasFilter ? base.filter(({ l }) => matchesFilter(l)) : base;
      csv = 'Loan No,Customer,Date,Due Date,Status,Principal (Rs),Interest (Rs),Paid (Rs),Outstanding (Rs)\n' +
        f.map(({ l, c }) => [l.no, cname(db, l.customerId), dmy(l.date), dmy(l.dueDate), l.status, l.principal, Math.round(c.interest), Math.round(c.paid), Math.round(c.outstanding)].join(',')).join('\n');
      shareCSV(`${t === 'out' ? 'outstanding' : t === 'over' ? 'overdue' : 'loans'}_report.csv`, csv);
    }
  };

  let body;
  if (t === 'pay') {
    const pays = hasFilter
      ? db.payments.filter((p) => {
          const l = db.loans.find((x) => x.id === p.loanId);
          if (!l) return false;
          const cust = db.customers.find((c) => c.id === l.customerId) || {};
          if (!matchesDateFilter(p.date)) return false;
          if (fLoanNo && !l.no.toLowerCase().includes(fLoanNo.toLowerCase())) return false;
          if (fCustId && !(cust.custNo || '').toLowerCase().includes(fCustId.toLowerCase())) return false;
          if (fPhone && !(cust.phone || '').includes(fPhone)) return false;
          return true;
        })
      : db.payments;
    body = pays.map((p) => { const l = db.loans.find((x) => x.id === p.loanId) || {}; return <Card key={p.id}><Row a={`${dmy(p.date)} · ${l.no} · ${p.colType || ''}`} b={inr(p.amount)} bold /><Text style={{ color: C.mute }}>{cname(db, l.customerId)}</Text></Card>; });
  } else if (t === 'cust') {
    const custs = hasFilter
      ? db.customers.filter((c) => {
          if (fCustId && !(c.custNo || '').toLowerCase().includes(fCustId.toLowerCase())) return false;
          if (fPhone && !(c.phone || '').includes(fPhone)) return false;
          return true;
        })
      : db.customers;
    body = custs.map((c) => <Card key={c.id} onPress={() => go('statement', { id: c.id })}><Row a={c.custNo || '-'} b={c.name} bold /><Text style={{ color: C.mute }}>{c.phone}</Text></Card>);
  } else {
    const base = t === 'out' ? rows.filter((r) => r.c.outstanding > 0) : t === 'over' ? rows.filter((r) => r.c.overdue) : rows;
    const f = hasFilter ? base.filter(({ l }) => matchesFilter(l)) : base;
    body = f.map(({ l, c }) => <Card key={l.id} onPress={() => go('loan', { id: l.id })}><Row a={`${l.no} · ${cname(db, l.customerId)}`} b={inr(t === 'loan' ? l.principal : c.outstanding)} bold /><Row a={`${dmy(l.date)} → ${dmy(l.dueDate)}`} b={l.status} /></Card>);
    if (t === 'out') body.push(<Row key="tot" a="Total outstanding" b={inr(f.reduce((s, r) => s + r.c.outstanding, 0))} bold />);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {tabs.map(([k, n]) => <TouchableOpacity key={k} onPress={() => setT(k)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, marginRight: 6, backgroundColor: t === k ? C.navy : '#fff', borderWidth: 1, borderColor: C.line }}><Text style={{ color: t === k ? '#fff' : C.text }}>{n}</Text></TouchableOpacity>)}
        </ScrollView>
        {body.length ? body : <Empty text="Nothing to show yet." />}
        {body.length ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Btn title="Export CSV" onPress={exportReport} style={{ flex: 1, marginVertical: 0 }} kind="ghost" />
            <Btn title="Export PDF" onPress={exportPDF} style={{ flex: 1, marginVertical: 0 }} />
          </View>
        ) : null}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom filter bar */}
      <View style={{ borderTopWidth: 1, borderColor: C.line, backgroundColor: '#fff' }}>
        <TouchableOpacity onPress={() => setShowFilter((v) => !v)}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ fontWeight: '700', color: C.navy }}>Filters {hasFilter ? '•' : ''}</Text>
          <Text style={{ color: C.gold, fontWeight: '600' }}>{showFilter ? 'Hide ▼' : 'Show ▲'}</Text>
        </TouchableOpacity>
        {showFilter && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            {/* Date mode selector */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
              {[['date', 'Date'], ['month', 'Month'], ['year', 'Year']].map(([k, label]) => (
                <TouchableOpacity key={k} onPress={() => { setFMode(k); setFFrom(''); setFTo(''); setFMonth(''); setFYear(''); }}
                  style={{ flex: 1, paddingVertical: 7, borderRadius: 18, alignItems: 'center', borderWidth: 1,
                    borderColor: fMode === k ? C.navy : C.line, backgroundColor: fMode === k ? C.navy : '#fff' }}>
                  <Text style={{ color: fMode === k ? '#fff' : C.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date range */}
            {fMode === 'date' && (
              <CalendarPicker
                label="Select date range"
                value={fFrom}
                value2={fTo}
                onChange={setFFrom}
                onChangeEnd={setFTo}
              />
            )}

            {/* Month picker */}
            {fMode === 'month' && (
              <View style={{ marginBottom: 8 }}>
                <Field label="Year" value={fYear} onChangeText={setFYear} keyboardType="number-pad" placeholder="2025" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {MONTHS.map((m, i) => {
                    const val = String(i + 1).padStart(2, '0');
                    const sel = fMonth === val;
                    return (
                      <TouchableOpacity key={val} onPress={() => setFMonth(sel ? '' : val)}
                        style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, marginRight: 6,
                          backgroundColor: sel ? C.gold : '#fff', borderWidth: 1, borderColor: sel ? C.gold : C.line }}>
                        <Text style={{ color: sel ? '#fff' : C.text, fontWeight: '600', fontSize: 13 }}>{m}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Year picker */}
            {fMode === 'year' && (
              <View style={{ marginBottom: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => {
                    const sel = fYear === y;
                    return (
                      <TouchableOpacity key={y} onPress={() => setFYear(sel ? '' : y)}
                        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, marginRight: 6,
                          backgroundColor: sel ? C.gold : '#fff', borderWidth: 1, borderColor: sel ? C.gold : C.line }}>
                        <Text style={{ color: sel ? '#fff' : C.text, fontWeight: '600', fontSize: 13 }}>{y}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1 }}><Field label="Loan No" value={fLoanNo} onChangeText={setFLoanNo} placeholder="GL/25-26/A001" /></View>
              <View style={{ flex: 1 }}><Field label="Customer ID" value={fCustId} onChangeText={setFCustId} placeholder="CUS-001" /></View>
            </View>
            <Field label="Phone" value={fPhone} onChangeText={setFPhone} keyboardType="phone-pad" placeholder="Customer phone" />
            {hasFilter && <Btn title="Clear filters" kind="ghost" onPress={clearFilter} style={{ marginVertical: 0 }} />}
          </View>
        )}
      </View>
    </View>
  );
}

export function Statement({ db, id, back, go }) {
  const c = db.customers.find((x) => x.id === id); if (!c) return null;
  const allLoans = db.loans.filter((l) => l.customerId === id);
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [fLoanNo, setFLoanNo] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const hasFilter = fFrom || fTo || fLoanNo;
  const loans = hasFilter ? allLoans.filter((l) => {
    if (fFrom && l.date < fFrom) return false;
    if (fTo && l.date > fTo) return false;
    if (fLoanNo && !l.no.toLowerCase().includes(fLoanNo.toLowerCase())) return false;
    return true;
  }) : allLoans;

  const exportCSV = async () => {
    const headers = 'Loan No,Date,Due Date,Status,Principal (Rs),Interest Rate (%),Gold (g),Purity (K),Paid (Rs),Outstanding (Rs)';
    const rowsData = loans.map((l) => { const k = calc(l, db.payments); return [l.no, dmy(l.date), dmy(l.dueDate), l.status, l.principal, l.rate, l.weight, l.purity, Math.round(k.paid), Math.round(k.outstanding)].join(','); });
    const csv = [`Customer: ${c.name} (${c.custNo || '-'})`, `Phone: ${c.phone}`, '', headers, ...rowsData].join('\n');
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${c.name}_statement.csv`; a.click(); URL.revokeObjectURL(url);
    } else {
      const path = FileSystem.cacheDirectory + `${c.name}_statement.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'text/csv' });
    }
  };
  return (
    <View style={{ flex: 1 }}>
      <Header title="Customer statement" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 17 }}>{c.name}</Text>
            {c.custNo ? <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>{c.custNo}</Text> : null}
          </View>
          <Text style={{ color: C.mute }}>{c.phone}{c.address ? ' · ' + c.address : ''}</Text>
          <Text style={{ color: C.mute }}>{c.idType}: {c.idNo || '-'}</Text>
        </Card>
        <Btn title="Export as CSV" onPress={exportCSV} style={{ marginBottom: 4 }} />
        {loans.length === 0 ? <Empty text="No loans for this customer." /> : loans.map((l) => {
          const k = calc(l, db.payments);
          return <Card key={l.id} onPress={() => go('loan', { id: l.id })}><Row a={l.no} b={l.status} bold /><Row a="Principal" b={inr(l.principal)} /><Row a="Paid" b={inr(k.paid)} /><Row a="Outstanding" b={inr(k.outstanding)} bold /></Card>;
        })}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom filter bar */}
      <View style={{ borderTopWidth: 1, borderColor: C.line, backgroundColor: '#fff' }}>
        <TouchableOpacity onPress={() => setShowFilter((v) => !v)}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ fontWeight: '700', color: C.navy }}>Filters {hasFilter ? '•' : ''}</Text>
          <Text style={{ color: C.gold, fontWeight: '600' }}>{showFilter ? 'Hide ▼' : 'Show ▲'}</Text>
        </TouchableOpacity>
        {showFilter && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <CalendarPicker label="Select date range" value={fFrom} value2={fTo} onChange={setFFrom} onChangeEnd={setFTo} />
            <Field label="Loan No" value={fLoanNo} onChangeText={setFLoanNo} placeholder="GL/25-26/A001" />
            {hasFilter && <Btn title="Clear filters" kind="ghost" onPress={() => { setFFrom(''); setFTo(''); setFLoanNo(''); }} style={{ marginVertical: 0 }} />}
          </View>
        )}
      </View>
    </View>
  );
}

/* ---------- Backup ---------- */
export function Backup({ db, update, lock }) {
  const json = JSON.stringify({ ...db, pin: undefined, editPassword: undefined });
  const [txt, setTxt] = useState('');
  const restore = () => {
    try {
      const d = JSON.parse(txt);
      if (!d.customers || !d.loans) throw 0;
      confirm('Replace all current data with this backup?', () =>
        update((o) => ({ ...o, customers: d.customers, loans: d.loans, payments: d.payments || [], itemSuggestions: d.itemSuggestions || [] }))
          .then(() => notify('Backup restored')), 'Restore');
    } catch (e) { notify('Invalid backup'); }
  };
  return (
    <Page>
      <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 6 }}>Backup</Text>
      <Btn title="Share backup" onPress={() => Share.share({ message: json }).catch(() => {})} />
      <Text style={{ fontWeight: '700', fontSize: 16, marginTop: 18, marginBottom: 6 }}>Restore</Text>
      <Field label="Paste backup text" value={txt} onChangeText={setTxt} multiline />
      <Btn title="Restore from backup" kind="ghost" onPress={restore} />
      <Btn title="Lock app" kind="danger" onPress={lock} style={{ marginTop: 24 }} />
    </Page>
  );
}

/* ---------- Settings ---------- */
export function Profile({ db, update, back }) {
  const cfg = db.settings || {};
  const [shopName, setShopName] = useState(cfg.shopName || 'Kuber Jewellery');
  const [defRate, setDefRate] = useState(cfg.defaultRate || '2');
  const [defMonths, setDefMonths] = useState(cfg.defaultMonths || '6');
  const [defMode, setDefMode] = useState(cfg.defaultInterestMode || 'day');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [editPw, setEditPw] = useState(db.editPassword || '');
  const [saved, setSaved] = useState('');

  const saveSettings = async () => {
    await update((d) => ({ ...d, settings: { shopName: shopName.trim() || 'Kuber Jewellery', defaultRate: defRate, defaultMonths: defMonths, defaultInterestMode: defMode } }));
    setSaved('settings');
  };
  const savePin = async () => {
    if (db.pin && oldPin !== db.pin) return notify('Current PIN is wrong');
    if (!/^\d{4}$/.test(newPin)) return notify('New PIN must be 4 digits');
    await update((d) => ({ ...d, pin: newPin }));
    setOldPin(''); setNewPin(''); setSaved('pin');
  };
  const saveEditPw = async () => {
    await update((d) => ({ ...d, editPassword: editPw.trim() || null }));
    setSaved('pw');
  };

  const Section = ({ title }) => (
    <Text style={{ fontWeight: '700', fontSize: 15, marginTop: 20, marginBottom: 8, color: C.navy }}>{title}</Text>
  );

  return (
    <><Header title="Settings" onBack={back} />
    <Page>
      <Section title="Shop" />
      <Field label="Shop name" value={shopName} onChangeText={setShopName} />

      <Section title="Loan defaults" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Interest rate (% / month)" value={defRate} onChangeText={setDefRate} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Tenure (months)" value={defMonths} onChangeText={setDefMonths} keyboardType="number-pad" /></View>
      </View>
      <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Default interest calculation</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
        {[['day', 'Day-wise'], ['month', 'Month-wise']].map(([k, label]) => (
          <TouchableOpacity key={k} onPress={() => setDefMode(k)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1,
              borderColor: defMode === k ? C.navy : C.line, backgroundColor: defMode === k ? C.navy : '#fff' }}>
            <Text style={{ color: defMode === k ? '#fff' : C.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Btn title="Save settings" onPress={saveSettings} />
      {saved === 'settings' && <Text style={{ color: C.green, textAlign: 'center', marginBottom: 4 }}>Saved ✓</Text>}

      <Section title="Security" />
      {db.pin ? <Field label="Current PIN" value={oldPin} onChangeText={setOldPin} secureTextEntry keyboardType="number-pad" maxLength={4} /> : null}
      <Field label="New PIN (4 digits)" value={newPin} onChangeText={setNewPin} secureTextEntry keyboardType="number-pad" maxLength={4} />
      <Btn title="Save PIN" onPress={savePin} />
      {saved === 'pin' && <Text style={{ color: C.green, textAlign: 'center', marginBottom: 4 }}>Saved ✓</Text>}

      <Text style={{ color: C.mute, fontSize: 12, marginTop: 16, marginBottom: 4 }}>Edit password — required before editing any loan or customer. Leave blank to disable.</Text>
      <Field label="Edit password" value={editPw} onChangeText={setEditPw} secureTextEntry />
      <Btn title="Save edit password" onPress={saveEditPw} />
      {saved === 'pw' && <Text style={{ color: C.green, textAlign: 'center', marginBottom: 4 }}>Saved ✓</Text>}
    </Page></>
  );
}
