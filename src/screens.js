import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Image, Modal, Platform, ScrollView, Share, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as XLSX from 'xlsx';
import { LIMIT, saveImage } from './storage';
import { Btn, C, CalendarPicker, Card, Chip, Empty, Field, Header, PasswordModal, Row, s, SignaturePad, SuggestField } from './ui';
import { addMonths, calc, confirm, dmy, inr, monthsBetween, nextCustomerSerial, nextSerial, notify, today, uid } from './utils';

const METALS = ['Gold', 'Silver', 'Others'];
const PAY_METHODS = ['Cash', 'UPI', 'Bank'];

/* ---------- HomeScreen (K Jewels UI) ---------- */
export function HomeScreen({ db, update, go }) {
  const [activeTab, setActiveTab] = useState('Parties');
  const [searchQ, setSearchQ] = useState('');

  // Compute summary values from real data
  const activeLoans = db.loans.filter((l) => l.status === 'active');
  const totalOutstanding = activeLoans.reduce((s, l) => s + calc(l, db.payments).outstanding, 0);
  const totalPrincipal = activeLoans.reduce((s, l) => s + l.principal, 0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthPayments = db.payments
    .filter((p) => p.date && p.date.startsWith(currentMonth))
    .reduce((s, p) => s + p.amount, 0);

  // Party list = customers with active loans
  const parties = db.customers
    .filter((c) => (c.name + (c.phone || '')).toLowerCase().includes(searchQ.toLowerCase()))
    .map((c) => {
      const loans = db.loans.filter((l) => l.customerId === c.id && l.status === 'active');
      const outstanding = loans.reduce((s, l) => s + calc(l, db.payments).outstanding, 0);
      const lastLoan = loans.sort((a, b) => (b.date > a.date ? 1 : -1))[0];
      return { c, outstanding, lastDate: lastLoan?.date || c.createdAt || '' };
    });

  const TABS = ['Parties', 'Transactions', 'Items'];

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F5F8' }}>
      {/* Summary Cards */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 10, paddingTop: 12, paddingBottom: 4, gap: 8 }}>
        <SummaryCard label="You'll Get" value={inr(totalOutstanding)} color={C.green} icon="↑" />
        <SummaryCard label={`Sale (${new Date().toLocaleString('en-IN', { month: 'short' })})`} value={inr(monthPayments)} color="#E07B20" icon="₹" />
        <SummaryCard label="You'll Give" value={inr(totalPrincipal)} color="#C0392B" icon="↓" />
      </View>

      {/* Navigation Tabs */}
      <View style={{ flexDirection: 'row', marginHorizontal: 10, marginTop: 10, marginBottom: 8, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' }}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)}
            style={{ flex: 1, paddingVertical: 11, alignItems: 'center',
              backgroundColor: activeTab === tab ? C.navy : '#fff',
              borderRightWidth: tab !== 'Items' ? 1 : 0, borderColor: C.line }}>
            <Text style={{ color: activeTab === tab ? '#fff' : C.text, fontWeight: activeTab === tab ? '700' : '500', fontSize: 14 }}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search + Filter + New Party */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 10, marginBottom: 8, gap: 6 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: C.line, paddingHorizontal: 10 }}>
          <Text style={{ color: C.mute, fontSize: 16, marginRight: 6 }}>🔍</Text>
          <TextInput
            value={searchQ}
            onChangeText={setSearchQ}
            placeholder="Search Party"
            placeholderTextColor="#9AA7B4"
            style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: C.text }}
          />
        </View>
        <TouchableOpacity style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 10 }}>
          <Text style={{ fontSize: 16 }}>⚙️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => go('customerForm')}
          style={{ backgroundColor: '#D6EAF8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text style={{ color: '#1A6FA8', fontWeight: '700', fontSize: 13 }}>+ New Party</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'Parties' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          {parties.length === 0 ? <Empty text="No parties found." /> : parties.map(({ c, outstanding, lastDate }) => (
            <TouchableOpacity key={c.id} onPress={() => go('statement', { id: c.id })}
              style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.line,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: C.text }}>{c.name}</Text>
                <Text style={{ color: C.mute, fontSize: 12, marginTop: 2 }}>{lastDate ? dmy(lastDate) : '-'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: C.green, fontWeight: '700', fontSize: 15 }}>{inr(outstanding)}</Text>
                <Text style={{ color: C.green, fontSize: 11, marginTop: 2 }}>You'll Get</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {activeTab === 'Transactions' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 100 }}>
          {db.payments.length === 0 ? <Empty text="No transactions yet." /> : db.payments.slice(0, 50).map((p) => {
            const loan = db.loans.find((l) => l.id === p.loanId) || {};
            const cust = db.customers.find((c) => c.id === loan.customerId) || {};
            return (
              <View key={p.id} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.line,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: C.text }}>{cust.name || 'Unknown'}</Text>
                  <Text style={{ color: C.mute, fontSize: 12, marginTop: 2 }}>{dmy(p.date)} · {p.colType || 'payment'}</Text>
                </View>
                <Text style={{ color: C.navy, fontWeight: '700', fontSize: 15 }}>{inr(p.amount)}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
      {activeTab === 'Items' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 100 }}>
          {db.loans.length === 0 ? <Empty text="No items yet." /> : db.loans.map((l) => {
            const cust = db.customers.find((c) => c.id === l.customerId) || {};
            const orns = l.ornaments || [{ desc: l.itemDesc || '-', weight: l.weight, purity: l.purity, metal: 'Gold' }];
            return orns.map((o, i) => (
              <TouchableOpacity key={l.id + '_' + i} onPress={() => go('loan', { id: l.id })}
                style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.line,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: C.text }}>{o.desc || o.metal || 'Item'}</Text>
                  <Text style={{ color: C.mute, fontSize: 12, marginTop: 2 }}>{cust.name || 'Unknown'} · {o.weight}g · {o.purity}K</Text>
                </View>
                <Text style={{ color: C.navy, fontWeight: '700', fontSize: 14 }}>{l.no}</Text>
              </TouchableOpacity>
            ));
          })}
        </ScrollView>
      )}

      {/* Fixed Bottom Action Bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 16,
        borderTopWidth: 1, borderColor: C.line, gap: 8 }}>
        <TouchableOpacity onPress={() => go('loanForm')}
          style={{ flex: 1, backgroundColor: C.red, borderRadius: 25, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>New Loan</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => go('loanForm')}
          style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#1A6FA8',
            alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
          <Text style={{ color: '#1A6FA8', fontSize: 24, fontWeight: '300', lineHeight: 28 }}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => go('dayEntry')}
          style={{ flex: 1, backgroundColor: C.navy, borderRadius: 25, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Day Entry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const SummaryCard = ({ label, value, color, icon }) => (
  <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E8EDF2',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
      <Text style={{ color, fontSize: 14, fontWeight: '700' }}>{icon}</Text>
    </View>
    <Text style={{ color: C.mute, fontSize: 11, marginBottom: 3 }}>{label}</Text>
    <Text style={{ color, fontSize: 15, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
  </View>
);

/* ---------- Day Entry Screen ---------- */
export function DayEntry({ db, update, back }) {
  const active = db.loans
    .filter((l) => l.status === 'active')
    .map((l) => ({ l, c: calc(l, db.payments) }));

  const [selLoan, setSelLoan] = useState(null);
  const [dayAmt, setDayAmt] = useState('');
  const [dayType, setDayType] = useState('interest');
  const [dayNote, setDayNote] = useState('');
  const [dayDate, setDayDate] = useState('');
  const [dayMethod, setDayMethod] = useState('Cash');
  const [loanQ, setLoanQ] = useState('');

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
          .then(() => { setSelLoan(null); setLoanQ(''); back(); }), 'Close');
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
    notify('Entry saved');
  };

  return (
    <><Header title="Day Entry" onBack={back} />
    <Page>
      <TextInput value={loanQ} onChangeText={setLoanQ} placeholder="Search loan / customer…"
        placeholderTextColor="#9AA7B4" style={[s.input, { marginBottom: 6 }]} autoFocus={Platform.OS === 'web'} />
      {filteredLoans.map(({ l }) => {
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
          <Text style={{ color: C.navy, fontWeight: '700', marginBottom: 6 }}>{selLoan.no} · {(db.customers.find((c) => c.id === selLoan.customerId) || {}).name || 'Unknown'}</Text>
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
    </Page></>
  );
}


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
  const [deletePwVisible, setDeletePwVisible] = useState(false);
  const cust = db.customers.find((c) => c.id === id);
  const [f, setF] = useState(cust ? { ...cust } : EMPTY_CUSTOMER);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  if (!cust) return null;
  const submit = async () => {
    if (!f.name.trim() || !f.phone.trim()) return notify('Name and phone are required');
    await update((d) => ({ ...d, customers: d.customers.map((c) => c.id === id ? { ...c, ...f } : c) }));
    back();
  };
  const doDelete = () => {
    const hasLoans = db.loans.some((l) => l.customerId === id);
    if (hasLoans) return notify('Cannot delete: customer has existing loans');
    confirm('Delete this customer permanently?', async () => {
      await update((d) => ({ ...d, customers: d.customers.filter((c) => c.id !== id) }));
      back();
    }, 'Delete');
  };
  const requestDelete = () => {
    if (db.editPassword) setDeletePwVisible(true);
    else doDelete();
  };
  if (!unlocked) return (
    <PasswordModal visible={!unlocked} storedPassword={db.editPassword}
      onOk={() => setUnlocked(true)} onCancel={back} title="Enter edit password to edit customer" />
  );
  return (
    <><Header title="Edit customer" onBack={back} />
    <PasswordModal visible={deletePwVisible} storedPassword={db.editPassword}
      onOk={() => { setDeletePwVisible(false); doDelete(); }}
      onCancel={() => setDeletePwVisible(false)} title="Enter password to delete customer" />
    <Page>
      <Photo label="Customer photo" value={f.photo} onChange={set('photo')} />
      <Field label="Full name" value={f.name} onChangeText={set('name')} />
      <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Address" value={f.address} onChangeText={set('address')} multiline />
      <Field label="ID proof type" value={f.idType} onChangeText={set('idType')} />
      <Field label="ID number" value={f.idNo} onChangeText={set('idNo')} />
      <Photo label="ID proof photo" value={f.idPhoto} onChange={set('idPhoto')} />
      <Btn title="Save changes" onPress={submit} />
      <Btn title="Delete customer" kind="danger" onPress={requestDelete} />
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
    referralNo: '', referralName: '', referralMobile: '',
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
      setF({ customerId: '', principal: '', rate: cfg.defaultRate || '2', months: cfg.defaultMonths || '6', interestMode: cfg.defaultInterestMode || 'day', goldPhoto: null, signaturePaths: [], date: today(), dueDate: '', referralNo: '', referralName: '', referralMobile: '' });
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

      <Text style={{ fontWeight: '700', color: C.text, marginBottom: 6, marginTop: 4 }}>Referral Details</Text>
      <View style={{ backgroundColor: '#F7FAFF', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: C.line }}>
        <Field label="Referral Number" value={f.referralNo} onChangeText={set('referralNo')} />
        <Field label="Referral Name" value={f.referralName} onChangeText={set('referralName')} />
        <Field label="Referral Mobile" value={f.referralMobile} onChangeText={set('referralMobile')} keyboardType="phone-pad" />
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
        <PaymentRow key={p.id} p={p} db={db} update={update} />
      ))}
    </Page></>
  );
}

function PaymentRow({ p, db, update }) {
  const [delPwVisible, setDelPwVisible] = useState(false);
  const doDelete = () => {
    confirm('Delete this payment record?', async () => {
      await update((d) => ({ ...d, payments: d.payments.filter((x) => x.id !== p.id) }));
    }, 'Delete');
  };
  const requestDelete = () => {
    if (db.editPassword) setDelPwVisible(true);
    else doDelete();
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderColor: C.line }}>
      <PasswordModal visible={delPwVisible} storedPassword={db.editPassword}
        onOk={() => { setDelPwVisible(false); doDelete(); }}
        onCancel={() => setDelPwVisible(false)} title="Enter password to delete payment" />
      <View style={{ flex: 1 }}>
        <Row a={`${dmy(p.date)} · ${p.colType || ''} · ${p.method || 'Cash'}${p.note ? ' · ' + p.note : ''}`} b={inr(p.amount)} />
      </View>
      <TouchableOpacity onPress={requestDelete} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>✕</Text>
      </TouchableOpacity>
    </View>
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

/* ---------- Reports Menu ---------- */
const REPORT_CATEGORIES = [
  {
    title: '⭐ Favorite Reports',
    items: ['Day Book', 'Item Report by Party'],
  },
  {
    title: '💳 Transaction Reports',
    items: ['Sale Report', 'Purchase Report', 'All Transactions', 'Bill Wise Profit', 'Profit & Loss', 'Cashflow', 'Balance Sheet', 'Trial Balance'],
  },
  {
    title: '👥 Party Reports',
    items: ['Party Statement', 'Party Wise Profit & Loss', 'All Parties Report', 'Party Report by Items', 'Sale/Purchase by Party'],
  },
  {
    title: '📦 Item/Stock Reports',
    items: ['Stock Summary Report', 'Item Wise Profit & Loss', 'Low Stock Summary Report', 'Stock Summary By Item Category', 'Item Batch Report', 'Item Serial Number Report'],
  },
  {
    title: '💸 Expense Reports',
    items: ['Expense Category Report', 'Expense Item Report'],
  },
  {
    title: '📋 Sale/Purchase Order Reports',
    items: ['Sale/Purchase Order Transaction Report', 'Sale/Purchase Order Item Report'],
  },
  {
    title: '📊 Other Income Reports',
    items: ['Other Income Transaction Report', 'Other Income Category Report'],
  },
  {
    title: '🏷️ Loan Reports',
    items: ['Loan Statement'],
  },
];

export function ReportsMenu({ go }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      {REPORT_CATEGORIES.map((cat) => (
        <View key={cat.title} style={{ marginBottom: 20 }}>
          <Text style={{ color: C.navy, fontWeight: '800', fontSize: 15, marginBottom: 8 }}>{cat.title}</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
            {cat.items.map((item, i) => (
              <TouchableOpacity key={item + i} onPress={() => go('reportDetail', { title: item })}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 14, paddingVertical: 14,
                  borderBottomWidth: i < cat.items.length - 1 ? 1 : 0, borderColor: C.line }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '500' }}>{item}</Text>
                <Text style={{ color: C.gold, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/* ---------- Cashflow Report ---------- */
const RANGE_OPTIONS = ['All Time', 'This Month', 'Last Month', 'This Year', 'Financial Year', 'Custom Range'];

export function CashflowReport({ db, back }) {
  const [range, setRange] = useState('This Month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showZeroTxns, setShowZeroTxns] = useState(false);
  const [considerOpenClose, setConsiderOpenClose] = useState(true);
  const [activeTab, setActiveTab] = useState('in');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const pad = (n) => String(n).padStart(2, '0');
    if (range === 'This Month') {
      return { fromDate: `${y}-${pad(m + 1)}-01`, toDate: `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}` };
    } else if (range === 'Last Month') {
      const lm = m === 0 ? 11 : m - 1, ly = m === 0 ? y - 1 : y;
      return { fromDate: `${ly}-${pad(lm + 1)}-01`, toDate: `${ly}-${pad(lm + 1)}-${pad(new Date(ly, lm + 1, 0).getDate())}` };
    } else if (range === 'This Year') {
      return { fromDate: `${y}-01-01`, toDate: `${y}-12-31` };
    } else if (range === 'Financial Year') {
      const fyStart = m >= 3 ? y : y - 1;
      return { fromDate: `${fyStart}-04-01`, toDate: `${fyStart + 1}-03-31` };
    } else {
      return { fromDate: customFrom, toDate: customTo };
    }
  }, [range, customFrom, customTo]);

  const pays = db.payments || [];
  const loans = db.loans || [];
  const customers = db.customers || [];

  const filtered = useMemo(() => pays.filter((p) => {
    if (fromDate && p.date < fromDate) return false;
    if (toDate && p.date > toDate) return false;
    if (!showZeroTxns && p.amount === 0) return false;
    const q = searchQ.toLowerCase();
    if (q) {
      const loan = loans.find((l) => l.id === p.loanId) || {};
      const cust = customers.find((c) => c.id === loan.customerId) || {};
      if (!(cust.name || '').toLowerCase().includes(q) && !(loan.no || '').toLowerCase().includes(q) && !(p.colType || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [pays, fromDate, toDate, showZeroTxns, searchQ]);

  // Money In = all cash inflows (interest, capital, settlement, partial)
  const moneyInTxns = filtered.filter((p) => p.amount > 0);
  const moneyOutTxns = filtered.filter((p) => p.amount < 0);
  const totalMoneyIn = moneyInTxns.reduce((s, p) => s + p.amount, 0);
  const totalMoneyOut = Math.abs(moneyOutTxns.reduce((s, p) => s + p.amount, 0));

  // Opening/Closing cash
  const allBeforeFrom = fromDate ? pays.filter((p) => p.date < fromDate) : [];
  const openingCash = considerOpenClose ? (db.cashInHand || 0) - filtered.reduce((s, p) => s + p.amount, 0) + allBeforeFrom.reduce((s, p) => s + p.amount, 0) : 0;
  const closingCash = considerOpenClose ? openingCash + totalMoneyIn - totalMoneyOut : totalMoneyIn - totalMoneyOut;

  const txns = activeTab === 'in' ? moneyInTxns : moneyOutTxns;
  const total = activeTab === 'in' ? totalMoneyIn : totalMoneyOut;

  const exportPDF = async () => {
    const shopName = db.settings?.shopName || 'Kuber Jewellery';
    const makeRows = (list, color) => list.map((p) => {
      const loan = loans.find((l) => l.id === p.loanId) || {};
      const cust = customers.find((c) => c.id === loan.customerId) || {};
      return `<tr><td>${cust.name || 'Cash Sale'}${loan.no ? ' · ' + loan.no : ''}</td><td>${dmy(p.date)}</td><td>${p.colType || 'Sale'}</td><td style="color:${color};font-weight:bold">${inr(Math.abs(p.amount))}</td></tr>`;
    }).join('');
    const inRows = makeRows(moneyInTxns, '#1E8A58');
    const outRows = makeRows(moneyOutTxns, '#B93A2E');
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:16px}h2{color:#12263A}h3{color:#444;font-size:14px;margin:16px 0 6px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#12263A;color:#fff;padding:8px;text-align:left}td{padding:7px 8px;border-bottom:1px solid #eee}.summary{display:flex;gap:12px;margin:12px 0;flex-wrap:wrap}.box{flex:1;min-width:100px;padding:12px;border:1px solid #eee;border-radius:8px;text-align:center}.total{font-weight:bold;font-size:14px}</style></head><body><h2>${shopName} – Cashflow Report</h2><p style="color:#666">${fromDate ? dmy(fromDate) : 'All'} to ${toDate ? dmy(toDate) : 'All'}</p><div class="summary"><div class="box"><div style="color:#666;font-size:11px">Closing Cash</div><div style="color:${closingCash >= 0 ? '#1E8A58' : '#B93A2E'};font-weight:bold">${inr(closingCash)}</div></div><div class="box"><div style="color:#666;font-size:11px">Opening Cash</div><div style="font-weight:bold">${inr(openingCash)}</div></div><div class="box"><div style="color:#666;font-size:11px">Money In</div><div style="color:#1E8A58;font-weight:bold">${inr(totalMoneyIn)}</div></div><div class="box"><div style="color:#666;font-size:11px">Money Out</div><div style="color:#B93A2E;font-weight:bold">${inr(totalMoneyOut)}</div></div></div><h3>Money In</h3><table><thead><tr><th>Name & Loan</th><th>Date</th><th>Txn Type</th><th>Amount</th></tr></thead><tbody>${inRows || '<tr><td colspan="4" style="color:#999;text-align:center">No transactions</td></tr>'}</tbody></table><tr style="background:#f5f5f5"><td colspan="3" class="total">Total Money In</td><td class="total" style="color:#1E8A58">${inr(totalMoneyIn)}</td></tr><h3>Money Out</h3><table><thead><tr><th>Name & Loan</th><th>Date</th><th>Txn Type</th><th>Amount</th></tr></thead><tbody>${outRows || '<tr><td colspan="4" style="color:#999;text-align:center">No transactions</td></tr>'}</tbody></table><tr style="background:#f5f5f5"><td colspan="3" class="total">Total Money Out</td><td class="total" style="color:#B93A2E">${inr(totalMoneyOut)}</td></tr></body></html>`;
    if (Platform.OS === 'web') {
      const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print();
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export PDF' });
    }
  };

  const fmtRange = () => {
    if (range !== 'Custom Range') return range;
    if (customFrom && customTo) return `${dmy(customFrom)} – ${dmy(customTo)}`;
    return 'Custom Range';
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E8EDF2' }}>
        <TouchableOpacity onPress={back} style={{ paddingRight: 12 }}>
          <Text style={{ fontSize: 22, color: C.navy }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: C.text }}>Cashflow Report</Text>
        <TouchableOpacity onPress={() => { setShowSearch((v) => !v); setSearchQ(''); }} style={{ paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 18, opacity: showSearch ? 1 : 0.5 }}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={exportPDF} style={{ paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 18 }}>📄</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E8EDF2' }}>
          <TextInput
            value={searchQ}
            onChangeText={setSearchQ}
            placeholder="Search by name, loan no, type…"
            placeholderTextColor="#9AA7B4"
            style={{ backgroundColor: '#F3F5F8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: C.text }}
            autoFocus
          />
        </View>
      )}

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {/* Date Filter */}
        <View style={{ backgroundColor: '#F7FAFF', borderBottomWidth: 1, borderColor: '#D6E8FF', paddingHorizontal: 14, paddingVertical: 10 }}>
          {/* Row 1: dropdown + calendar icon */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TouchableOpacity onPress={() => setShowRangeDropdown((v) => !v)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>{fmtRange()}</Text>
              <Text style={{ color: C.mute, fontSize: 12 }}>▾</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18 }}>📅</Text>
          </View>
          {/* Dropdown list */}
          {showRangeDropdown && (
            <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
              {RANGE_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} onPress={() => { setRange(opt); setShowRangeDropdown(false); }}
                  style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F4FA', backgroundColor: range === opt ? '#EEF4FF' : '#fff' }}>
                  <Text style={{ fontSize: 14, color: range === opt ? C.navy : C.text, fontWeight: range === opt ? '700' : '400' }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {/* Row 2: From / TO / To */}
          {range === 'Custom Range' ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: C.mute, fontWeight: '600', marginBottom: 4 }}>FROM</Text>
                <CalendarPicker value={customFrom} onChange={setCustomFrom} label="Select" />
              </View>
              <Text style={{ color: C.mute, fontWeight: '700', fontSize: 13, marginTop: 22 }}>TO</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: C.mute, fontWeight: '600', marginBottom: 4 }}>TO</Text>
                <CalendarPicker value={customTo} onChange={setCustomTo} label="Select" />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ fontSize: 11, color: C.mute }}>From</Text>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>{fromDate ? dmy(fromDate) : '-'}</Text>
              </View>
              <Text style={{ color: C.mute, fontWeight: '700', fontSize: 13 }}>TO</Text>
              <View style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ fontSize: 11, color: C.mute }}>To</Text>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>{toDate ? dmy(toDate) : '-'}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Filters Applied */}
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E8EDF2', paddingHorizontal: 14, paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>Filters Applied</Text>
            <TouchableOpacity onPress={() => setShowFilterPanel((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 14 }}>⚙</Text>
              <Text style={{ fontSize: 13, color: C.navy, fontWeight: '600' }}>Filters</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF4FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 4 }}>
              <Text style={{ fontSize: 12, color: C.navy }}>0 Value Txns – {showZeroTxns ? 'Show' : 'Hide'}</Text>
              <TouchableOpacity onPress={() => setShowZeroTxns((v) => !v)}>
                <Text style={{ fontSize: 11, color: C.mute }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF4FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 4 }}>
              <Text style={{ fontSize: 12, color: C.navy }}>Opening/Closing Cash – {considerOpenClose ? 'Consider' : 'Ignore'}</Text>
              <TouchableOpacity onPress={() => setConsiderOpenClose((v) => !v)}>
                <Text style={{ fontSize: 11, color: C.mute }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showFilterPanel && (
            <View style={{ marginTop: 10, backgroundColor: '#F7FAFF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#D6E8FF' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>Show zero-value transactions</Text>
                <TouchableOpacity onPress={() => setShowZeroTxns((v) => !v)}
                  style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: showZeroTxns ? C.green : '#ccc', justifyContent: 'center', paddingHorizontal: 2 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignSelf: showZeroTxns ? 'flex-end' : 'flex-start' }} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>Consider Opening/Closing Cash</Text>
                <TouchableOpacity onPress={() => setConsiderOpenClose((v) => !v)}
                  style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: considerOpenClose ? C.green : '#ccc', justifyContent: 'center', paddingHorizontal: 2 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignSelf: considerOpenClose ? 'flex-end' : 'flex-start' }} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Summary */}
        <View style={{ backgroundColor: '#F7FAFF', borderBottomWidth: 4, borderColor: '#D6E8FF', paddingHorizontal: 14, paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', gap: 0 }}>
            {(considerOpenClose
              ? [
                  { label: 'Closing Cash', value: inr(closingCash), color: closingCash >= 0 ? C.green : C.red },
                  { label: 'Opening Cash', value: inr(openingCash), color: C.text },
                  { label: 'Money In', value: inr(totalMoneyIn), color: C.green },
                  { label: 'Money Out', value: inr(totalMoneyOut), color: C.red },
                ]
              : [
                  { label: 'Money In', value: inr(totalMoneyIn), color: C.green },
                  { label: 'Money Out', value: inr(totalMoneyOut), color: C.red },
                  { label: 'Net Flow', value: inr(totalMoneyIn - totalMoneyOut), color: totalMoneyIn >= totalMoneyOut ? C.green : C.red },
                ]
            ).map((item, i, arr) => (
              <View key={item.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 8,
                borderRightWidth: i < arr.length - 1 ? 1 : 0, borderColor: '#D6E8FF' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: item.color }} numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
                <Text style={{ fontSize: 11, color: C.mute, marginTop: 3, textAlign: 'center' }}>{item.label}</Text>
              </View>
            ))}
          </View>
          {filtered.length > 0 && (
            <Text style={{ fontSize: 11, color: C.mute, textAlign: 'center', marginTop: 6 }}>
              {filtered.length} transaction{filtered.length !== 1 ? 's' : ''} · {fromDate ? dmy(fromDate) : ''}{fromDate && toDate ? ' – ' : ''}{toDate ? dmy(toDate) : ''}
            </Text>
          )}
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E8EDF2' }}>
          {[['in', 'Money In', moneyInTxns.length], ['out', 'Money Out', moneyOutTxns.length]].map(([key, label, count]) => (
            <TouchableOpacity key={key} onPress={() => setActiveTab(key)}
              style={{ flex: 1, paddingVertical: 13, alignItems: 'center',
                borderBottomWidth: activeTab === key ? 2 : 0, borderBottomColor: C.red }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: activeTab === key ? C.red : C.mute }}>{label}</Text>
                {count > 0 && (
                  <View style={{ backgroundColor: activeTab === key ? C.red : '#E8EDF2', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: activeTab === key ? '#fff' : C.mute }}>{count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transaction Table Header */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F7FAFF', borderBottomWidth: 1, borderColor: '#E8EDF2' }}>
          <Text style={{ flex: 2, fontSize: 12, fontWeight: '700', color: C.mute }}>NAME & DATE</Text>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: C.mute, textAlign: 'center' }}>TXN TYPE</Text>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: C.mute, textAlign: 'right' }}>{activeTab === 'in' ? 'MONEY IN' : 'MONEY OUT'}</Text>
        </View>

        {/* Transactions */}
        {txns.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: C.mute, fontSize: 14 }}>No transactions found.</Text>
          </View>
        ) : txns.map((p) => {
          const loan = loans.find((l) => l.id === p.loanId) || {};
          const cust = customers.find((c) => c.id === loan.customerId) || {};
          const name = cust.name || 'Cash Sale';
          const txnType = p.colType ? (p.colType.charAt(0).toUpperCase() + p.colType.slice(1)) : 'Sale';
          const amt = Math.abs(p.amount);
          return (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F4FA', backgroundColor: '#fff' }}>
              <View style={{ flex: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{name}</Text>
                <Text style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>{dmy(p.date)}{loan.no ? ' · ' + loan.no : ''}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: C.mute, textAlign: 'center' }}>{txnType}{p.method && p.method !== 'Cash' ? '\n' + p.method : ''}</Text>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: activeTab === 'in' ? C.green : C.red, textAlign: 'right' }}>{inr(amt)}</Text>
            </View>
          );
        })}

        {/* Total Row */}
        {txns.length > 0 && (
          <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1, borderColor: '#D6E8FF', backgroundColor: '#F7FAFF' }}>
            <Text style={{ flex: 3, fontSize: 14, fontWeight: '700', color: C.text }}>Total {activeTab === 'in' ? 'Money In' : 'Money Out'}</Text>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: activeTab === 'in' ? C.green : C.red, textAlign: 'right' }}>{inr(total)}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/* ---------- Sale Report ---------- */
export function SaleReport({ db, back, go }) {
  const [range, setRange] = useState('All Time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [showZeroTxns, setShowZeroTxns] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const { fromDate, toDate } = useMemo(() => {
    if (range === 'All Time') return { fromDate: '', toDate: '' };
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const pad = (n) => String(n).padStart(2, '0');
    if (range === 'This Month') return { fromDate: `${y}-${pad(m+1)}-01`, toDate: `${y}-${pad(m+1)}-${pad(new Date(y,m+1,0).getDate())}` };
    if (range === 'Last Month') { const lm = m===0?11:m-1, ly=m===0?y-1:y; return { fromDate:`${ly}-${pad(lm+1)}-01`, toDate:`${ly}-${pad(lm+1)}-${pad(new Date(ly,lm+1,0).getDate())}` }; }
    if (range === 'This Year') return { fromDate:`${y}-01-01`, toDate:`${y}-12-31` };
    if (range === 'Financial Year') { const fs=m>=3?y:y-1; return { fromDate:`${fs}-04-01`, toDate:`${fs+1}-03-31` }; }
    return { fromDate: customFrom, toDate: customTo };
  }, [range, customFrom, customTo]);

  const pays = db.payments || [];
  const loans = db.loans || [];
  const customers = db.customers || [];

  const filtered = useMemo(() => pays.filter((p) => {
    if (fromDate && p.date < fromDate) return false;
    if (toDate && p.date > toDate) return false;
    if (!showZeroTxns && p.amount === 0) return false;
    return true;
  }), [pays, fromDate, toDate, showZeroTxns]);

  const totalSale = filtered.reduce((s, p) => s + p.amount, 0);
  const totalPaid = filtered.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
  const totalDue = filtered.filter((p) => p.amount < 0).reduce((s, p) => s + Math.abs(p.amount), 0);

  const fmtRange = () => {
    if (range === 'Custom Range' && customFrom && customTo) return `${dmy(customFrom)} – ${dmy(customTo)}`;
    return range;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.navy }}>
        <TouchableOpacity onPress={back} style={{ paddingRight: 12 }}>
          <Text style={{ fontSize: 22, color: '#fff' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: '#fff' }}>Sale Report</Text>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {/* Date Filter */}
        <View style={{ backgroundColor: '#F7FAFF', borderBottomWidth: 1, borderColor: '#D6E8FF', paddingHorizontal: 14, paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TouchableOpacity onPress={() => setShowRangeDropdown((v) => !v)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>{fmtRange()}</Text>
              <Text style={{ color: C.mute, fontSize: 12 }}>▾</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18 }}>📅</Text>
          </View>
          {showRangeDropdown && (
            <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
              {RANGE_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} onPress={() => { setRange(opt); setShowRangeDropdown(false); }}
                  style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F4FA', backgroundColor: range === opt ? '#EEF4FF' : '#fff' }}>
                  <Text style={{ fontSize: 14, color: range === opt ? C.navy : C.text, fontWeight: range === opt ? '700' : '400' }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {range === 'Custom Range' ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: C.mute, fontWeight: '600', marginBottom: 4 }}>FROM</Text>
                <CalendarPicker value={customFrom} onChange={setCustomFrom} label="Select" />
              </View>
              <Text style={{ color: C.mute, fontWeight: '700', fontSize: 13, marginTop: 22 }}>TO</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: C.mute, fontWeight: '600', marginBottom: 4 }}>TO</Text>
                <CalendarPicker value={customTo} onChange={setCustomTo} label="Select" />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ fontSize: 11, color: C.mute }}>From</Text>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>{fromDate ? dmy(fromDate) : '-'}</Text>
              </View>
              <Text style={{ color: C.mute, fontWeight: '700', fontSize: 13 }}>TO</Text>
              <View style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ fontSize: 11, color: C.mute }}>To</Text>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>{toDate ? dmy(toDate) : '-'}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Filters Applied */}
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E8EDF2', paddingHorizontal: 14, paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>Filters Applied</Text>
            <TouchableOpacity onPress={() => setShowFilterPanel((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 14 }}>⚙</Text>
              <Text style={{ fontSize: 13, color: C.navy, fontWeight: '600' }}>Filters</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF4FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 4 }}>
              <Text style={{ fontSize: 12, color: C.navy }}>0 Value Txns – {showZeroTxns ? 'Show' : 'Hide'}</Text>
              <TouchableOpacity onPress={() => setShowZeroTxns((v) => !v)}>
                <Text style={{ fontSize: 11, color: C.mute }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showFilterPanel && (
            <View style={{ marginTop: 10, backgroundColor: '#F7FAFF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#D6E8FF' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>Show zero-value transactions</Text>
                <TouchableOpacity onPress={() => setShowZeroTxns((v) => !v)}
                  style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: showZeroTxns ? C.green : '#ccc', justifyContent: 'center', paddingHorizontal: 2 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignSelf: showZeroTxns ? 'flex-end' : 'flex-start' }} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, gap: 8, backgroundColor: '#F7FAFF', borderBottomWidth: 1, borderColor: '#D6E8FF' }}>
          {[
            { label: 'Total Sale', value: inr(totalSale), color: C.navy },
            { label: 'Total Received', value: inr(totalPaid), color: C.green },
            { label: 'Balance Due', value: inr(totalDue), color: C.red },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E8EDF2' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: item.color }} numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
              <Text style={{ fontSize: 11, color: C.mute, marginTop: 3, textAlign: 'center' }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Table Header */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F7FAFF', borderBottomWidth: 1, borderColor: '#E8EDF2' }}>
          <Text style={{ flex: 2, fontSize: 12, fontWeight: '700', color: C.mute }}>PARTY / DATE</Text>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: C.mute, textAlign: 'center' }}>TYPE</Text>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: C.mute, textAlign: 'right' }}>AMOUNT</Text>
        </View>

        {/* Transaction Cards */}
        {filtered.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: C.mute, fontSize: 14 }}>No transactions found.</Text>
          </View>
        ) : filtered.map((p) => {
          const loan = loans.find((l) => l.id === p.loanId) || {};
          const cust = customers.find((c) => c.id === loan.customerId) || {};
          const txnType = p.colType ? (p.colType.charAt(0).toUpperCase() + p.colType.slice(1)) : 'Cash Sale';
          return (
            <TouchableOpacity key={p.id}
              onPress={() => go('saleDetail', { paymentId: p.id })}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderColor: '#F0F4FA', backgroundColor: '#fff' }}
              activeOpacity={0.7}>
              <View style={{ flex: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{cust.name || 'Cash Sale'}</Text>
                <Text style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>{loan.no || '-'} · {dmy(p.date)}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: C.mute, textAlign: 'center' }}>{txnType}</Text>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: p.amount >= 0 ? C.green : C.red, textAlign: 'right' }}>{inr(Math.abs(p.amount))}</Text>
            </TouchableOpacity>
          );
        })}

        {filtered.length > 0 && (
          <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1, borderColor: '#D6E8FF', backgroundColor: '#F7FAFF' }}>
            <Text style={{ flex: 3, fontSize: 14, fontWeight: '700', color: C.text }}>Total ({filtered.length} txns)</Text>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: C.navy, textAlign: 'right' }}>{inr(totalSale)}</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/* ---------- Sale Detail ---------- */
export function SaleDetail({ db, update, back, paymentId }) {
  const payment = (db.payments || []).find((p) => p.id === paymentId);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState(null);

  if (!payment) return (
    <View style={{ flex: 1 }}>
      <Header title="Sale Details" onBack={back} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.mute }}>Transaction not found.</Text>
      </View>
    </View>
  );

  const loan = (db.loans || []).find((l) => l.id === payment.loanId) || {};
  const cust = (db.customers || []).find((c) => c.id === loan.customerId) || {};
  const orns = loan.ornaments || (loan.itemDesc ? [{ desc: loan.itemDesc, weight: loan.weight, purity: loan.purity, metal: 'Gold' }] : []);

  // Derived financials
  const rate = loan.rate || 0;
  const taxAmt = 0; // no tax field in current data model
  const discountPct = 0;
  const discountAmt = 0;
  const oldBalance = (db.payments || []).filter((p) => p.loanId === payment.loanId && p.id !== payment.id).reduce((s, p) => s + p.amount, 0);
  const balanceDue = Math.max(0, (loan.principal || 0) - oldBalance - payment.amount);

  const doDelete = () => {
    confirm('Delete this sale transaction permanently?', async () => {
      await update((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== paymentId) }));
      back();
    }, 'Delete');
  };

  const startEdit = () => { setEditFields({ ...payment }); setEditMode(true); };
  const saveEdit = async () => {
    if (!editFields.amount || isNaN(Number(editFields.amount))) return notify('Enter a valid amount');
    await update((d) => ({ ...d, payments: d.payments.map((p) => p.id === paymentId ? { ...p, ...editFields, amount: Number(editFields.amount) } : p) }));
    setEditMode(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F5F8' }}>
      <Header title="Sale" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

        {editMode && editFields ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line }}>
            <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 10, color: C.navy }}>Edit Sale</Text>
            <Field label="Amount (₹)" value={String(editFields.amount)} onChangeText={(v) => setEditFields((p) => ({ ...p, amount: v }))} keyboardType="number-pad" />
            <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Date</Text>
            <CalendarPicker value={editFields.date} onChange={(v) => setEditFields((p) => ({ ...p, date: v }))} label="Select date" />
            <Field label="Note" value={editFields.note || ''} onChangeText={(v) => setEditFields((p) => ({ ...p, note: v }))} />
            <Text style={{ color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Transaction Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {['interest', 'capital', 'partial', 'settlement'].map((k) => (
                <TouchableOpacity key={k} onPress={() => setEditFields((p) => ({ ...p, colType: k }))}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1,
                    borderColor: editFields.colType === k ? C.navy : C.line,
                    backgroundColor: editFields.colType === k ? C.navy : '#fff' }}>
                  <Text style={{ color: editFields.colType === k ? '#fff' : C.text, fontSize: 13, fontWeight: '600' }}>{k.charAt(0).toUpperCase() + k.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn title="Save" onPress={saveEdit} style={{ flex: 1 }} />
              <Btn title="Cancel" kind="ghost" onPress={() => setEditMode(false)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}

        {/* Party Name */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.mute, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Party Name</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{cust.name || 'Cash Sale'}</Text>
          {cust.custNo ? <Text style={{ color: C.gold, fontSize: 12, marginTop: 2 }}>{cust.custNo}</Text> : null}
        </View>

        {/* Item Details */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.navy, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>Item Details</Text>
          {orns.length === 0 ? (
            <Text style={{ color: C.mute, fontSize: 13 }}>No item details available.</Text>
          ) : orns.map((o, i) => (
            <View key={i} style={{ marginBottom: i < orns.length - 1 ? 12 : 0, paddingBottom: i < orns.length - 1 ? 12 : 0, borderBottomWidth: i < orns.length - 1 ? 1 : 0, borderColor: C.line }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontWeight: '700', color: C.text, fontSize: 14 }}>{o.desc || o.metal || 'Item'}</Text>
                <Text style={{ color: C.navy, fontWeight: '700', fontSize: 14 }}>{inr(loan.principal || 0)}</Text>
              </View>
              <Text style={{ color: C.mute, fontSize: 12, marginBottom: 6 }}>{o.metal || 'Gold'} · {o.purity || '-'}K</Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View>
                  <Text style={{ color: C.mute, fontSize: 11 }}>Qty / Weight</Text>
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{o.weight || '-'} g</Text>
                </View>
                <View>
                  <Text style={{ color: C.mute, fontSize: 11 }}>Rate</Text>
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{rate}% / mo</Text>
                </View>
                <View>
                  <Text style={{ color: C.mute, fontSize: 11 }}>Tax</Text>
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{inr(taxAmt)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Discount & Charges */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.navy, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>Discount & Charges</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
            <Text style={{ color: C.mute, fontSize: 13 }}>Discount</Text>
            <Text style={{ color: C.text, fontSize: 13 }}>{discountPct}% · {inr(discountAmt)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
            <Text style={{ color: C.mute, fontSize: 13 }}>Old Balance</Text>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>{inr(oldBalance)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
            <Text style={{ color: C.mute, fontSize: 13 }}>Balance Due</Text>
            <Text style={{ color: balanceDue > 0 ? C.red : C.green, fontSize: 13, fontWeight: '700' }}>{inr(balanceDue)}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: C.line, marginVertical: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: C.navy, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.navy, fontSize: 12, fontWeight: '700' }}>✓</Text>
              </View>
              <Text style={{ color: C.text, fontSize: 13 }}>Round Off</Text>
            </View>
            <Text style={{ color: C.navy, fontSize: 16, fontWeight: '800' }}>{inr(payment.amount)}</Text>
          </View>
        </View>

        {/* Transaction Info */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.navy, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>Transaction Info</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: C.mute, fontSize: 13 }}>Invoice / Sale No</Text>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>{loan.no || '-'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: C.mute, fontSize: 13 }}>Date & Time</Text>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>{dmy(payment.date)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: C.mute, fontSize: 13 }}>Transaction Type</Text>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>{payment.colType ? (payment.colType.charAt(0).toUpperCase() + payment.colType.slice(1)) : 'Cash Sale'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: C.mute, fontSize: 13 }}>Payment Method</Text>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>{payment.method || 'Cash'}</Text>
          </View>
          {payment.note ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ color: C.mute, fontSize: 13 }}>Note</Text>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }}>{payment.note}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      {!editMode && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderColor: C.line }}>
          <TouchableOpacity onPress={doDelete}
            style={{ flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.red }}>
            <Text style={{ color: C.red, fontWeight: '700', fontSize: 15 }}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={startEdit}
            style={{ flex: 1, backgroundColor: C.navy, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ---------- Day Book Report ---------- */
export function DayBookReport({ db, back }) {
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState({ firm: 'All Firms', user: 'All Users', txnType: 'All Types', party: 'All Parties' });
  const [pendingFilters, setPendingFilters] = useState({ firm: 'All Firms', user: 'All Users', txnType: 'All Types', party: 'All Parties' });

  const pays = db.payments || [];
  const loans = db.loans || [];
  const customers = db.customers || [];

  // Derive unique parties and txn types for filter options
  const partyOptions = useMemo(() => ['All Parties', ...customers.map((c) => c.name)], [customers]);
  const txnTypeOptions = ['All Types', 'interest', 'capital', 'partial', 'settlement', 'close'];

  const records = useMemo(() => {
    return pays.filter((p) => {
      const pDate = p.date || today();
      if (fromDate && pDate < fromDate) return false;
      if (toDate && pDate > toDate) return false;
      if (filters.txnType !== 'All Types' && p.colType !== filters.txnType) return false;
      if (filters.party !== 'All Parties') {
        const loan = loans.find((l) => l.id === p.loanId) || {};
        const cust = customers.find((c) => c.id === loan.customerId) || {};
        if (cust.name !== filters.party) return false;
      }
      return true;
    });
  }, [pays, fromDate, toDate, filters, loans, customers]);

  const totalDebit = records.reduce((s, p) => s + (p.amount < 0 ? Math.abs(p.amount) : 0), 0);
  const totalCredit = records.reduce((s, p) => s + (p.amount > 0 ? p.amount : 0), 0);

  const activeChips = Object.entries(filters).filter(([, v]) => !v.startsWith('All'));

  const applyFilters = () => { setFilters({ ...pendingFilters }); setShowFilterPanel(false); };
  const clearFilters = () => {
    const def = { firm: 'All Firms', user: 'All Users', txnType: 'All Types', party: 'All Parties' };
    setFilters(def); setPendingFilters(def); setShowFilterPanel(false);
  };

  const exportPDF = async () => {
    const shopName = db.settings?.shopName || 'Kuber Jewellery';
    const rows = records.map((p) => {
      const loan = loans.find((l) => l.id === p.loanId) || {};
      const cust = customers.find((c) => c.id === loan.customerId) || {};
      const debit = p.amount < 0 ? inr(Math.abs(p.amount)) : '-';
      const credit = p.amount > 0 ? inr(p.amount) : '-';
      return `<tr><td>${dmy(p.date || today())}</td><td>${loan.no || '-'}</td><td>${p.colType || '-'}</td><td>${cust.name || '-'}</td><td style="color:#B93A2E">${debit}</td><td style="color:#1E8A58">${credit}</td></tr>`;
    }).join('');
    const dateLabel = fromDate === toDate ? dmy(fromDate) : `${dmy(fromDate)} – ${dmy(toDate)}`;
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:16px}h2{color:#12263A}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#12263A;color:#fff;padding:8px;text-align:left}td{padding:7px 8px;border-bottom:1px solid #eee}.total{font-weight:bold;background:#f5f5f5}</style></head><body><h2>${shopName} – Day Book</h2><p style="color:#666">Date: ${dateLabel}</p><table><thead><tr><th>Date</th><th>Voucher</th><th>Type</th><th>Party</th><th>Debit</th><th>Credit</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#999">No transactions</td></tr>'}</tbody><tfoot><tr class="total"><td colspan="4">Total</td><td style="color:#B93A2E">${inr(totalDebit)}</td><td style="color:#1E8A58">${inr(totalCredit)}</td></tr></tfoot></table></body></html>`;
    if (Platform.OS === 'web') {
      const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print();
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export PDF' });
    }
  };

  const FilterOption = ({ label, value, options, field }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, color: '#6B7A8A', fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {options.map((opt) => {
            const sel = pendingFilters[field] === opt;
            return (
              <TouchableOpacity key={opt} onPress={() => setPendingFilters((p) => ({ ...p, [field]: opt }))}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                  borderColor: sel ? '#12263A' : '#D0DCF0', backgroundColor: sel ? '#12263A' : '#fff' }}>
                <Text style={{ fontSize: 12, color: sel ? '#fff' : '#1B2733', fontWeight: sel ? '700' : '400' }}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E8EDF2' }}>
        <TouchableOpacity onPress={back} style={{ paddingRight: 12 }}>
          <Text style={{ fontSize: 22, color: '#12263A' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: '#1B2733' }}>Day Book</Text>
        <TouchableOpacity onPress={exportPDF} style={{ paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 18 }}>📄</Text>
        </TouchableOpacity>
      </View>

      {/* Date Selection */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E8EDF2', paddingHorizontal: 14, paddingVertical: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Text style={{ fontSize: 15 }}>📅</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1B2733' }}>Select Date</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: '#6B7A8A', fontWeight: '600', marginBottom: 4 }}>FROM</Text>
            <CalendarPicker value={fromDate} onChange={(v) => { if (v) { setFromDate(v); if (v > toDate) setToDate(v); } }} label="From date" />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7A8A', marginTop: 16 }}>→</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: '#6B7A8A', fontWeight: '600', marginBottom: 4 }}>TO</Text>
            <CalendarPicker value={toDate} onChange={(v) => { if (v) { setToDate(v); if (v < fromDate) setFromDate(v); } }} label="To date" />
          </View>
        </View>
      </View>

      {/* Filters Section */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E8EDF2', paddingHorizontal: 14, paddingVertical: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: activeChips.length > 0 ? 8 : 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1B2733' }}>Filters Applied</Text>
          <TouchableOpacity onPress={() => { setPendingFilters({ ...filters }); setShowFilterPanel((v) => !v); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontSize: 13 }}>⚙</Text>
            <Text style={{ fontSize: 13, color: '#12263A', fontWeight: '600' }}>Filters</Text>
          </TouchableOpacity>
        </View>
        {activeChips.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {activeChips.map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF4FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 4 }}>
                <Text style={{ fontSize: 12, color: '#12263A' }}>{v}</Text>
                <TouchableOpacity onPress={() => { const u = { ...filters, [k]: k === 'firm' ? 'All Firms' : k === 'user' ? 'All Users' : k === 'txnType' ? 'All Types' : 'All Parties' }; setFilters(u); setPendingFilters(u); }}>
                  <Text style={{ fontSize: 11, color: '#6B7A8A' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Filter Panel */}
        {showFilterPanel && (
          <View style={{ marginTop: 12, backgroundColor: '#F7FAFF', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#D6E8FF' }}>
            <FilterOption label="Firm" field="firm" options={['All Firms']} value={pendingFilters.firm} />
            <FilterOption label="User" field="user" options={['All Users']} value={pendingFilters.user} />
            <FilterOption label="Transaction Type" field="txnType" options={txnTypeOptions} value={pendingFilters.txnType} />
            <FilterOption label="Party" field="party" options={partyOptions} value={pendingFilters.party} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TouchableOpacity onPress={clearFilters}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#12263A' }}>
                <Text style={{ color: '#12263A', fontWeight: '700', fontSize: 13 }}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyFilters}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#12263A' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Main Content */}
      <ScrollView style={{ flex: 1, backgroundColor: '#EAF4FF' }} contentContainerStyle={{ flexGrow: 1 }}>
        {records.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 }}>
            <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#D6E8FF', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 40 }}>📋</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1B2733', marginBottom: 10, textAlign: 'center' }}>No Data Available</Text>
            <Text style={{ fontSize: 13, color: '#6B7A8A', textAlign: 'center', lineHeight: 20 }}>
              No data is available for this report. Please try again after making relevant changes.
            </Text>
          </View>
        ) : (
          <View style={{ padding: 12 }}>
            {/* Table Header */}
            <View style={{ flexDirection: 'row', backgroundColor: '#12263A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 }}>
              <Text style={{ flex: 2, fontSize: 11, fontWeight: '700', color: '#fff' }}>PARTY / TYPE</Text>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'center' }}>VOUCHER</Text>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: '#B93A2E', textAlign: 'right' }}>DEBIT</Text>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: '#1E8A58', textAlign: 'right' }}>CREDIT</Text>
            </View>
            {records.map((p) => {
              const loan = loans.find((l) => l.id === p.loanId) || {};
              const cust = customers.find((c) => c.id === loan.customerId) || {};
              const txnType = p.colType ? (p.colType.charAt(0).toUpperCase() + p.colType.slice(1)) : 'Payment';
              const isCredit = p.amount > 0;
              return (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 6, borderWidth: 1, borderColor: '#D6E8FF' }}>
                  <View style={{ flex: 2 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1B2733' }}>{cust.name || 'Unknown'}</Text>
                    <Text style={{ fontSize: 11, color: '#6B7A8A', marginTop: 2 }}>{txnType}{p.method && p.method !== 'Cash' ? ' · ' + p.method : ''}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 12, color: '#6B7A8A', textAlign: 'center' }}>{loan.no || '-'}</Text>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#B93A2E', textAlign: 'right' }}>{!isCredit ? inr(Math.abs(p.amount)) : '-'}</Text>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#1E8A58', textAlign: 'right' }}>{isCredit ? inr(p.amount) : '-'}</Text>
                </View>
              );
            })}
            {/* Totals */}
            <View style={{ flexDirection: 'row', backgroundColor: '#D6E8FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, marginTop: 4 }}>
              <Text style={{ flex: 3, fontSize: 13, fontWeight: '700', color: '#12263A' }}>Total ({records.length} txn{records.length !== 1 ? 's' : ''})</Text>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: '#B93A2E', textAlign: 'right' }}>{inr(totalDebit)}</Text>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: '#1E8A58', textAlign: 'right' }}>{inr(totalCredit)}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export function ReportDetail({ back, sub, db, go, update }) {
  const title = sub?.title || 'Report';

  if (title === 'Cashflow') return <CashflowReport db={db} back={back} />;
  if (title === 'Day Book') return <DayBookReport db={db} back={back} />;
  if (title === 'Sale Report' || title === 'All Transactions') return <SaleReport db={db} back={back} go={go} />;

  const rows = (db?.loans || []).map((l) => ({ l, c: calc(l, db.payments) }));
  const active = rows.filter((r) => r.l.status === 'active');
  const pays = db?.payments || [];

  let content = null;

  if (title === 'Loan Statement') {
    content = (
      <>
        {active.length === 0 ? <Empty text="No active loans." /> : active.map(({ l, c }) => (
          <Card key={l.id}>
            <Row a={`${l.no} · ${cname(db, l.customerId)}`} b={inr(l.principal)} bold />
            <Row a={`${dmy(l.date)} → ${dmy(l.dueDate)}`} b={l.status} />
            <Row a="Outstanding" b={inr(c.outstanding)} color={c.overdue ? C.red : C.navy} bold />
          </Card>
        ))}
      </>
    );
  } else if (title === 'Party Statement' || title === 'All Parties Report') {
    content = (
      <>
        {(db?.customers || []).length === 0 ? <Empty text="No parties found." /> : (db?.customers || []).map((cu) => {
          const cLoans = rows.filter((r) => r.l.customerId === cu.id);
          const outstanding = cLoans.reduce((s, r) => s + r.c.outstanding, 0);
          return (
            <Card key={cu.id}>
              <Row a={cu.custNo ? `${cu.name} · ${cu.custNo}` : cu.name} b={cu.phone} bold />
              <Row a="Loans" b={String(cLoans.length)} />
              <Row a="Outstanding" b={inr(outstanding)} color={outstanding > 0 ? C.red : C.green} bold />
            </Card>
          );
        })}
      </>
    );
  } else if (title === 'Sale Report' || title === 'All Transactions') {
    return <SaleReport db={db} back={back} go={go} />;
  } else if (title === 'Stock Summary Report' || title === 'Item Report by Party') {
    content = (
      <>
        {rows.length === 0 ? <Empty text="No items found." /> : rows.map(({ l }) => {
          const orns = l.ornaments || [{ desc: l.itemDesc || '-', weight: l.weight, purity: l.purity, metal: 'Gold' }];
          return orns.map((o, i) => (
            <Card key={l.id + '_' + i}>
              <Row a={o.desc || o.metal || 'Item'} b={`${o.weight}g · ${o.purity || '-'}K`} bold />
              <Row a={cname(db, l.customerId)} b={l.no} />
              <Row a="Status" b={l.status} color={l.status === 'active' ? C.green : C.mute} />
            </Card>
          ));
        })}
      </>
    );
  } else if (title === 'Profit & Loss' || title === 'Bill Wise Profit') {
    const totalInterest = active.reduce((s, r) => s + r.c.interest, 0);
    const totalPaid = pays.reduce((s, p) => s + p.amount, 0);
    content = (
      <>
        <Card>
          <Row a="Total Interest Accrued" b={inr(totalInterest)} color={C.gold} bold />
          <Row a="Total Collected" b={inr(totalPaid)} color={C.green} bold />
          <Row a="Active Loans" b={String(active.length)} />
        </Card>
        {active.map(({ l, c }) => (
          <Card key={l.id}>
            <Row a={`${l.no} · ${cname(db, l.customerId)}`} b={inr(c.interest)} bold />
            <Row a="Paid" b={inr(c.paid)} color={C.green} />
            <Row a="Outstanding" b={inr(c.outstanding)} color={c.overdue ? C.red : C.navy} />
          </Card>
        ))}
      </>
    );
  } else {
    // Generic fallback for remaining report types
    const totalOutstanding = active.reduce((s, r) => s + r.c.outstanding, 0);
    content = (
      <>
        <Card>
          <Row a="Active Loans" b={String(active.length)} bold />
          <Row a="Total Outstanding" b={inr(totalOutstanding)} color={C.red} bold />
          <Row a="Total Customers" b={String((db?.customers || []).length)} />
          <Row a="Total Payments" b={String(pays.length)} />
        </Card>
        {active.map(({ l, c }) => (
          <Card key={l.id}>
            <Row a={`${l.no} · ${cname(db, l.customerId)}`} b={inr(l.principal)} bold />
            <Row a={`${dmy(l.date)} → ${dmy(l.dueDate)}`} b={l.status} />
            <Row a="Outstanding" b={inr(c.outstanding)} color={c.overdue ? C.red : C.navy} />
          </Card>
        ))}
      </>
    );
  }

  return (
    <><Header title={title} onBack={back} />
    <Page>{content}</Page></>
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

/* ---------- Customer Profile ---------- */
export function CustomerProfile({ db, go, back, id }) {
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(id || null);
  const cust = selId ? db.customers.find((c) => c.id === selId) : null;

  if (cust) {
    const loans = db.loans.filter((l) => l.customerId === cust.id);
    const activeLoans = loans.filter((l) => l.status === 'active');
    const closedLoans = loans.filter((l) => l.status === 'closed');
    const totalOutstanding = activeLoans.reduce((s, l) => s + calc(l, db.payments).outstanding, 0);
    const totalPrincipal = activeLoans.reduce((s, l) => s + l.principal, 0);
    const totalPaid = db.payments.filter((p) => loans.some((l) => l.id === p.loanId)).reduce((s, p) => s + p.amount, 0);

    return (
      <View style={{ flex: 1, backgroundColor: '#F3F5F8' }}>
        {/* Hero Banner */}
        <View style={{ backgroundColor: C.navy, paddingTop: 16, paddingBottom: 32, paddingHorizontal: 16 }}>
          <TouchableOpacity onPress={() => setSelId(null)} style={{ marginBottom: 12 }}>
            <Text style={{ color: C.gold, fontSize: 22 }}>‹</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            {cust.photo
              ? <Image source={{ uri: cust.photo }} style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: C.gold, marginBottom: 12 }} />
              : <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.gold + '33', borderWidth: 3, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Text style={{ color: C.gold, fontWeight: '900', fontSize: 34 }}>{cust.name[0].toUpperCase()}</Text>
                </View>}
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 22, letterSpacing: 0.3 }}>{cust.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
              {cust.custNo ? <View style={{ backgroundColor: C.gold + '33', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>{cust.custNo}</Text>
              </View> : null}
              <View style={{ backgroundColor: C.green + '33', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color: C.green, fontWeight: '700', fontSize: 12 }}>● Active</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stat Cards — float over banner */}
        <View style={{ flexDirection: 'row', marginHorizontal: 12, marginTop: -22, gap: 8, marginBottom: 4 }}>
          {[
            { label: 'Active Loans', value: String(activeLoans.length), color: C.navy, icon: '💰' },
            { label: 'Outstanding', value: inr(totalOutstanding), color: C.red, icon: '📊' },
            { label: 'Total Paid', value: inr(totalPaid), color: C.green, icon: '✅' },
          ].map((s) => (
            <View key={s.label} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center',
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 4 }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</Text>
              <Text style={{ color: s.color, fontWeight: '800', fontSize: 15 }} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
              <Text style={{ color: C.mute, fontSize: 11, marginTop: 2, textAlign: 'center' }}>{s.label}</Text>
            </View>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 80 }}>
          {/* Contact Info */}
          <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 8, letterSpacing: 0.8 }}>CONTACT DETAILS</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.line, marginBottom: 16 }}>
            {(() => {
              const latestLoan = loans.slice().sort((a, b) => (b.date > a.date ? 1 : -1)).find((l) => l.referralNo || l.referralName || l.referralMobile);
              const baseRows = [
                { icon: '📞', label: 'Phone', value: cust.phone || '-' },
                { icon: '📍', label: 'Address', value: cust.address || '-' },
                { icon: '🪪', label: cust.idType || 'ID Proof', value: cust.idNo || '-' },
                { icon: '📅', label: 'Member Since', value: cust.createdAt ? dmy(cust.createdAt) : '-' },
                ...(latestLoan ? [
                  { icon: '🔗', label: 'Referral No', value: latestLoan.referralNo || '-' },
                  { icon: '👤', label: 'Referral Name', value: latestLoan.referralName || '-' },
                  { icon: '📱', label: 'Referral Mobile', value: latestLoan.referralMobile || '-' },
                ] : []),
              ];
              return baseRows.map((row, i) => (
              <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13,
                borderBottomWidth: 1, borderColor: C.line }}>
                <Text style={{ fontSize: 18, marginRight: 12 }}>{row.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.mute, fontSize: 11, fontWeight: '600' }}>{row.label}</Text>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', marginTop: 1 }}>{row.value}</Text>
                </View>
              </View>
              ));
            })()}
            {(() => {
              const sigLoan = loans.slice().sort((a, b) => (b.date > a.date ? 1 : -1)).find((l) => l.signaturePaths && l.signaturePaths.length > 0);
              const toD = (pts) => pts.length < 2 ? '' : pts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
              return (
                <View style={{ paddingHorizontal: 14, paddingVertical: 13 }}>
                  <Text style={{ color: C.mute, fontSize: 11, fontWeight: '600', marginBottom: 8 }}>Signature</Text>
                  {sigLoan ? (
                    <>
                      <View style={{ height: 110, borderRadius: 10, borderWidth: 1, borderColor: C.gold + '66', backgroundColor: '#FAFAFA', overflow: 'hidden' }}>
                        <Svg height={110} width={320}>
                          {sigLoan.signaturePaths.map((pts, i) => (
                            <Path key={i} d={toD(pts)} stroke={C.navy} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          ))}
                        </Svg>
                      </View>
                      <Text style={{ color: C.mute, fontSize: 10, marginTop: 4, textAlign: 'right' }}>Loan {sigLoan.no} - {dmy(sigLoan.date)}</Text>
                    </>
                  ) : (
                    <View style={{ height: 60, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: C.mute, fontSize: 12 }}>No signature on file</Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </View>

          {/* Loan Summary */}
          <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 0.8 }}>LOAN SUMMARY</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <View style={{ flex: 1, backgroundColor: C.navy, borderRadius: 14, padding: 14 }}>
              <Text style={{ color: C.gold, fontSize: 22, fontWeight: '900' }}>{activeLoans.length}</Text>
              <Text style={{ color: '#B9C6D3', fontSize: 12, marginTop: 2 }}>Active</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line }}>
              <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>{closedLoans.length}</Text>
              <Text style={{ color: C.mute, fontSize: 12, marginTop: 2 }}>Closed</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.goldSoft, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.gold + '44' }}>
              <Text style={{ color: C.gold, fontSize: 16, fontWeight: '900' }} numberOfLines={1} adjustsFontSizeToFit>{inr(totalPrincipal)}</Text>
              <Text style={{ color: C.gold + 'aa', fontSize: 12, marginTop: 2 }}>Principal</Text>
            </View>
          </View>

          {/* ID Photo */}
          {cust.idPhoto ? (
            <>
              <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 0.8 }}>ID PROOF</Text>
              <Image source={{ uri: cust.idPhoto }} style={{ width: '100%', height: 160, borderRadius: 14, marginBottom: 16 }} resizeMode="cover" />
            </>
          ) : null}

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => go('statement', { id: cust.id })}
              style={{ flex: 1, backgroundColor: C.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>📄  Statement</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => go('customerEdit', { id: cust.id })}
              style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.line }}>
              <Text style={{ color: C.navy, fontWeight: '700', fontSize: 14 }}>✏️  Edit</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Search list
  const list = db.customers.filter((c) => (c.name + (c.phone || '')).toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ flex: 1, backgroundColor: '#F3F5F8' }}>
      <View style={{ backgroundColor: C.navy, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={back} style={{ paddingRight: 14 }}>
          <Text style={{ color: '#fff', fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '700', flex: 1 }}>Customer Profile</Text>
      </View>
      <View style={{ margin: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12 }}>
        <Text style={{ color: C.mute, fontSize: 16, marginRight: 8 }}>🔍</Text>
        <TextInput value={q} onChangeText={setQ} placeholder="Search by name or phone"
          placeholderTextColor="#9AA7B4" style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: C.text }}
          autoFocus={Platform.OS === 'web'} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}>
        {list.length === 0 ? <Empty text="No customers found." /> : list.map((c) => {
          const aLoans = db.loans.filter((l) => l.customerId === c.id && l.status === 'active');
          const outstanding = aLoans.reduce((s, l) => s + calc(l, db.payments).outstanding, 0);
          return (
            <TouchableOpacity key={c.id} onPress={() => setSelId(c.id)}
              style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line,
                flexDirection: 'row', alignItems: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
              {c.photo
                ? <Image source={{ uri: c.photo }} style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12, borderWidth: 2, borderColor: C.gold }} />
                : <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.navy, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: C.gold, fontWeight: '900', fontSize: 20 }}>{c.name[0].toUpperCase()}</Text>
                  </View>}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: C.text }}>{c.name}</Text>
                <Text style={{ color: C.mute, fontSize: 12, marginTop: 2 }}>{c.custNo ? c.custNo + ' · ' : ''}{c.phone || '-'}</Text>
                {aLoans.length > 0 && <Text style={{ color: C.green, fontSize: 12, fontWeight: '600', marginTop: 2 }}>{aLoans.length} active · {inr(outstanding)}</Text>}
              </View>
              <View style={{ backgroundColor: C.goldSoft, borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.gold, fontSize: 18, fontWeight: '700' }}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ---------- Customer Wise Ledger ---------- */
export function CustomerLedger({ db, back }) {
  const [reportFormat, setReportFormat] = useState('excel'); // 'excel' | 'statement'
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQ, setSearchQ] = useState('');
  // Individual statement state
  const [stmtCustQ, setStmtCustQ] = useState('');
  const [stmtCustId, setStmtCustId] = useState(null);
  const [stmtFrom, setStmtFrom] = useState('');
  const [stmtTo, setStmtTo] = useState('');
  const [stmtData, setStmtData] = useState(null);
  const [stmtPreview, setStmtPreview] = useState(false);
  const [stmtZoom, setStmtZoom] = useState(1);

  const loans = db.loans || [];
  const customers = db.customers || [];
  const payments = db.payments || [];

  const rows = useMemo(() => {
    return customers
      .filter((c) => {
        const q = searchQ.toLowerCase();
        return !q || c.name.toLowerCase().includes(q) || (c.custNo || '').toLowerCase().includes(q);
      })
      .map((c) => {
        const cLoans = loans.filter((l) => l.customerId === c.id);
        const filteredLoans = cLoans.filter((l) => {
          if (fromDate && l.date < fromDate) return false;
          if (toDate && l.date > toDate) return false;
          return true;
        });
        const totalDebit = filteredLoans.reduce((s, l) => s + l.principal, 0);
        const totalReceived = filteredLoans.reduce((s, l) => {
          const lPays = payments.filter((p) => p.loanId === l.id);
          return s + lPays.reduce((ps, p) => ps + p.amount, 0);
        }, 0);
        const netAmount = totalDebit - totalReceived;
        const activeLoans = filteredLoans.filter((l) => l.status === 'active');
        const dueMonths = activeLoans.length > 0
          ? activeLoans.map((l) => dmy(l.dueDate)).join(', ')
          : '-';
        const assets = filteredLoans.map((l) => l.itemDesc || (l.ornaments && l.ornaments.map((o) => o.desc).filter(Boolean).join(', ')) || '-').filter(Boolean).join('; ');
        const avgRate = filteredLoans.length > 0
          ? (filteredLoans.reduce((s, l) => s + (l.rate || 0), 0) / filteredLoans.length).toFixed(2)
          : '0';
        const installment = activeLoans.reduce((s, l) => {
          const monthly = (l.principal * (l.rate || 0)) / 100;
          return s + monthly;
        }, 0);
        return {
          custNo: c.custNo || '-',
          name: c.name,
          asset: assets || '-',
          phone: c.phone || '-',
          phone2: c.phone2 || '-',
          area: c.address || '-',
          debit: totalDebit,
          dueMonth: dueMonths,
          dueMonthDetails: activeLoans.map((l) => l.no).join(', ') || '-',
          pctDebit: avgRate,
          remarks: c.remarks || '-',
          received: totalReceived,
          netAmount,
          installment,
        };
      })
      .filter((r) => r.debit > 0 || r.received > 0);
  }, [customers, loans, payments, fromDate, toDate, searchQ]);

  const exportExcel = () => {
    const shopName = (db.settings || {}).shopName || 'Kuber Jewellery';
    const dateRange = fromDate || toDate
      ? `${fromDate ? dmy(fromDate) : 'All'} to ${toDate ? dmy(toDate) : 'All'}`
      : 'All Time';
    const genDate = dmy(today());

    const wb = XLSX.utils.book_new();

    // Title rows
    const titleRows = [
      [shopName + ' – Customer Wise Ledger'],
      ['Date Range: ' + dateRange],
      ['Generated: ' + genDate],
      [],
      ['SL NO', 'CUSTOMER CODE', 'CUSTOMER NAME', 'ASSET', 'TELEPHONE NO', 'TELEPHONE NO 2',
        'AREA', 'DEBIT', 'DUE MONTH', 'DUE MONTH DETAILS', '% DEBIT', 'REMARKS',
        'RECEIVED', 'NET AMOUNT', 'INSTALLMENT'],
    ];

    const dataRows = rows.map((r, i) => [
      i + 1,
      r.custNo,
      r.name,
      r.asset,
      r.phone,
      r.phone2,
      r.area,
      r.debit,
      r.dueMonth,
      r.dueMonthDetails,
      parseFloat(r.pctDebit),
      r.remarks,
      r.received,
      r.netAmount,
      r.installment,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...titleRows, ...dataRows]);

    // Column widths
    ws['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
      { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 8 }, { wch: 16 },
      { wch: 12 }, { wch: 12 }, { wch: 14 },
    ];

    // Bold header row (row index 4, 0-based)
    const headerRowIdx = 4;
    const cols = 15;
    for (let c = 0; c < cols; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
      if (ws[cellRef]) {
        ws[cellRef].s = { font: { bold: true }, alignment: { horizontal: 'center', wrapText: true } };
      }
    }

    // Borders + number format for data rows
    const numCols = [7, 10, 12, 13, 14]; // 0-based: DEBIT, %DEBIT, RECEIVED, NET AMOUNT, INSTALLMENT
    for (let r = headerRowIdx; r < headerRowIdx + 1 + dataRows.length; r++) {
      for (let c = 0; c < cols; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
        ws[cellRef].s = {
          ...(ws[cellRef].s || {}),
          border: {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' },
          },
        };
        if (r > headerRowIdx && numCols.includes(c)) {
          ws[cellRef].z = '#,##0.00';
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Customer Ledger');

    if (Platform.OS === 'web') {
      XLSX.writeFile(wb, 'customer_wise_ledger.xlsx');
    } else {
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const path = FileSystem.cacheDirectory + 'customer_wise_ledger.xlsx';
      FileSystem.writeAsStringAsync(path, wbout, { encoding: FileSystem.EncodingType.Base64 })
        .then(() => Sharing.shareAsync(path, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Export Excel' }))
        .catch(() => notify('Export failed'));
    }
  };

  const stmtCustomers = customers.filter((c) => {
    const q = stmtCustQ.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.custNo || '').toLowerCase().includes(q);
  }).slice(0, 8);

  const generateStatement = () => {
    if (!stmtCustId) return notify('Select a customer');
    const cust = customers.find((c) => c.id === stmtCustId);
    if (!cust) return notify('Customer not found');
    const custLoans = loans.filter((l) => l.customerId === stmtCustId);

    // Opening balance = sum of principal for loans before stmtFrom, minus payments before stmtFrom
    let openingBalance = 0;
    if (stmtFrom) {
      const loansBeforeFrom = custLoans.filter((l) => l.date < stmtFrom);
      const debitBefore = loansBeforeFrom.reduce((s, l) => s + l.principal, 0);
      const creditBefore = payments.filter((p) => {
        const l = custLoans.find((x) => x.id === p.loanId);
        return l && p.date < stmtFrom;
      }).reduce((s, p) => s + p.amount, 0);
      openingBalance = debitBefore - creditBefore;
    }

    // Transactions in range
    const txns = [];
    custLoans.forEach((l) => {
      if ((!stmtFrom || l.date >= stmtFrom) && (!stmtTo || l.date <= stmtTo)) {
        txns.push({ date: l.date, docNo: l.no, billNo: l.no, type: 'Loan Issued', debit: l.principal, credit: 0, ref: l.id });
      }
      payments.filter((p) => p.loanId === l.id).forEach((p) => {
        if ((!stmtFrom || p.date >= stmtFrom) && (!stmtTo || p.date <= stmtTo)) {
          txns.push({ date: p.date, docNo: p.id.slice(0, 8).toUpperCase(), billNo: l.no, type: p.colType ? (p.colType.charAt(0).toUpperCase() + p.colType.slice(1)) : 'Payment', debit: 0, credit: p.amount, ref: p.id });
        }
      });
    });
    txns.sort((a, b) => (a.date > b.date ? 1 : -1));

    let balance = openingBalance;
    const rows = txns.map((t) => {
      balance += t.debit - t.credit;
      return { ...t, balance };
    });

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;

    setStmtData({ cust, rows, openingBalance, totalDebit, totalCredit, closingBalance, from: stmtFrom, to: stmtTo });
    setStmtPreview(true);
    setStmtZoom(1);
  };

  const exportStmtPDF = async () => {
    if (!stmtData) return;
    const shopName = (db.settings || {}).shopName || 'Kuber Jewellery';
    const { cust, rows, openingBalance, totalDebit, totalCredit, closingBalance, from, to } = stmtData;
    const trRows = rows.map((r) =>
      `<tr><td>${dmy(r.date)}</td><td>${r.docNo}</td><td>${r.billNo}</td><td>${r.type}</td><td style="color:#B93A2E">${r.debit > 0 ? inr(r.debit) : '-'}</td><td style="color:#1E8A58">${r.credit > 0 ? inr(r.credit) : '-'}</td><td>${inr(r.balance)}</td></tr>`
    ).join('');
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:20px;font-size:13px}h2{color:#12263A;margin:0 0 4px}h3{color:#B8912F;margin:0 0 16px}.info{display:flex;gap:24px;margin-bottom:16px;flex-wrap:wrap}.info div{min-width:160px}.info label{color:#6B7A8A;font-size:11px;display:block}.info span{font-weight:700;color:#1B2733}table{width:100%;border-collapse:collapse}th{background:#12263A;color:#fff;padding:7px 8px;text-align:left;font-size:12px}td{padding:6px 8px;border-bottom:1px solid #eee;font-size:12px}.total{background:#F7FAFF;font-weight:700}.opening{background:#FFF8E7}</style></head><body><h2>${shopName}</h2><h3>Customer Ledger Statement</h3><div class="info"><div><label>Customer Code</label><span>${cust.custNo || '-'}</span></div><div><label>Customer Name</label><span>${cust.name}</span></div><div><label>Period</label><span>${from ? dmy(from) : 'All'} – ${to ? dmy(to) : 'All'}</span></div><div><label>Phone</label><span>${cust.phone || '-'}</span></div></div><table><thead><tr><th>Date</th><th>Doc No</th><th>Bill No</th><th>Type</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody><tr class="opening"><td colspan="4">Opening Balance</td><td>-</td><td>-</td><td>${inr(openingBalance)}</td></tr>${trRows}<tr class="total"><td colspan="4">Total / Closing Balance</td><td style="color:#B93A2E">${inr(totalDebit)}</td><td style="color:#1E8A58">${inr(totalCredit)}</td><td>${inr(closingBalance)}</td></tr></tbody></table></body></html>`;
    if (Platform.OS === 'web') {
      const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print();
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export PDF' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.navy }}>
        <TouchableOpacity onPress={back} style={{ paddingRight: 12 }}>
          <Text style={{ fontSize: 22, color: '#fff' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: '#fff' }}>Customer Wise Ledger</Text>
        {reportFormat === 'excel' && (
          <TouchableOpacity onPress={exportExcel}
            style={{ backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>📥 Export Excel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Report Format Dropdown */}
      <View style={{ backgroundColor: '#F7FAFF', borderBottomWidth: 1, borderColor: '#D6E8FF', paddingHorizontal: 14, paddingVertical: 10 }}>
        <Text style={{ fontSize: 11, color: C.mute, fontWeight: '600', marginBottom: 4 }}>REPORT FORMAT</Text>
        <TouchableOpacity onPress={() => setShowFormatDropdown((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text style={{ fontSize: 14, color: C.text, fontWeight: '600' }}>
            {reportFormat === 'excel' ? '📊  Customer Wise Ledger (Excel Format)' : '📄  Individual Customer Ledger (Statement Format)'}
          </Text>
          <Text style={{ color: C.mute, fontSize: 12 }}>▾</Text>
        </TouchableOpacity>
        {showFormatDropdown && (
          <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#D0DCF0', borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
            {[['excel', '📊  Customer Wise Ledger (Excel Format)'], ['statement', '📄  Individual Customer Ledger (Statement Format)']].map(([k, label]) => (
              <TouchableOpacity key={k} onPress={() => { setReportFormat(k); setShowFormatDropdown(false); }}
                style={{ paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: k === 'excel' ? 1 : 0, borderColor: '#F0F4FA', backgroundColor: reportFormat === k ? '#EEF4FF' : '#fff' }}>
                <Text style={{ fontSize: 14, color: reportFormat === k ? C.navy : C.text, fontWeight: reportFormat === k ? '700' : '400' }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>


      {/* Excel Format Filters */}
      {reportFormat === 'excel' && (
        <>
          <View style={{ backgroundColor: '#F7FAFF', borderBottomWidth: 1, borderColor: '#D6E8FF', paddingHorizontal: 14, paddingVertical: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: C.line, paddingHorizontal: 10, marginBottom: 8 }}>
              <Text style={{ color: C.mute, fontSize: 15, marginRight: 6 }}>🔍</Text>
              <TextInput
                value={searchQ}
                onChangeText={setSearchQ}
                placeholder="Search by name or customer code"
                placeholderTextColor="#9AA7B4"
                style={{ flex: 1, paddingVertical: 9, fontSize: 14, color: C.text }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: C.mute, fontWeight: '600', marginBottom: 4 }}>FROM</Text>
                <CalendarPicker value={fromDate} onChange={setFromDate} label="Select" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: C.mute, fontWeight: '600', marginBottom: 4 }}>TO</Text>
                <CalendarPicker value={toDate} onChange={setToDate} label="Select" />
              </View>
            </View>
          </View>

          {/* Summary */}
          <View style={{ flexDirection: 'row', backgroundColor: '#F7FAFF', borderBottomWidth: 1, borderColor: '#D6E8FF', paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
            {[
              { label: 'Customers', value: String(rows.length), color: C.navy },
              { label: 'Total Debit', value: inr(rows.reduce((s, r) => s + r.debit, 0)), color: C.red },
              { label: 'Total Received', value: inr(rows.reduce((s, r) => s + r.received, 0)), color: C.green },
              { label: 'Net Amount', value: inr(rows.reduce((s, r) => s + r.netAmount, 0)), color: C.gold },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E8EDF2' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: item.color }} numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
                <Text style={{ fontSize: 10, color: C.mute, marginTop: 2, textAlign: 'center' }}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Table */}
          <ScrollView style={{ flex: 1 }} horizontal>
            <View>
              {/* Table Header */}
              <View style={{ flexDirection: 'row', backgroundColor: C.navy, paddingVertical: 10 }}>
                {[
                  ['SL', 50], ['CODE', 80], ['NAME', 140], ['ASSET', 120], ['PHONE', 110],
                  ['AREA', 120], ['DEBIT', 90], ['DUE MONTH', 110], ['% DEBIT', 70],
                  ['RECEIVED', 90], ['NET AMT', 90], ['INSTALL.', 90],
                ].map(([h, w]) => (
                  <Text key={h} style={{ width: w, color: '#fff', fontWeight: '700', fontSize: 11, paddingHorizontal: 6, textAlign: 'center' }}>{h}</Text>
                ))}
              </View>

              <ScrollView style={{ flex: 1 }}>
                {rows.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center', width: 1200 }}>
                    <Text style={{ color: C.mute, fontSize: 14 }}>No data found. Adjust filters.</Text>
                  </View>
                ) : rows.map((r, i) => (
                  <View key={r.custNo + i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#E8EDF2', backgroundColor: i % 2 === 0 ? '#fff' : '#F7FAFF', paddingVertical: 9 }}>
                    <Text style={[cell, { width: 50 }]}>{i + 1}</Text>
                    <Text style={[cell, { width: 80 }]}>{r.custNo}</Text>
                    <Text style={[cell, { width: 140, fontWeight: '600' }]}>{r.name}</Text>
                    <Text style={[cell, { width: 120 }]} numberOfLines={2}>{r.asset}</Text>
                    <Text style={[cell, { width: 110 }]}>{r.phone}</Text>
                    <Text style={[cell, { width: 120 }]} numberOfLines={2}>{r.area}</Text>
                    <Text style={[cell, { width: 90, color: C.red, fontWeight: '600' }]}>{inr(r.debit)}</Text>
                    <Text style={[cell, { width: 110 }]} numberOfLines={2}>{r.dueMonth}</Text>
                    <Text style={[cell, { width: 70 }]}>{r.pctDebit}%</Text>
                    <Text style={[cell, { width: 90, color: C.green, fontWeight: '600' }]}>{inr(r.received)}</Text>
                    <Text style={[cell, { width: 90, color: C.gold, fontWeight: '700' }]}>{inr(r.netAmount)}</Text>
                    <Text style={[cell, { width: 90 }]}>{inr(r.installment)}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </>
      )}

      {/* Statement Format */}
      {reportFormat === 'statement' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 13, color: C.mute, fontWeight: '600', marginBottom: 6 }}>CUSTOMER NAME / CODE</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: C.line, paddingHorizontal: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: C.mute, fontSize: 15, marginRight: 6 }}>🔍</Text>
            <TextInput
              value={stmtCustQ}
              onChangeText={(t) => { setStmtCustQ(t); setStmtCustId(null); }}
              placeholder="Search customer by name or code"
              placeholderTextColor="#9AA7B4"
              style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: C.text }}
            />
          </View>
          {stmtCustQ.length > 0 && !stmtCustId && stmtCustomers.map((c) => (
            <TouchableOpacity key={c.id} onPress={() => { setStmtCustId(c.id); setStmtCustQ(c.name + (c.custNo ? ' (' + c.custNo + ')' : '')); }}
              style={{ backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: C.line, padding: 10, marginBottom: 4 }}>
              <Text style={{ fontWeight: '600', color: C.text }}>{c.name}</Text>
              <Text style={{ color: C.mute, fontSize: 12 }}>{c.custNo || ''}{c.phone ? ' · ' + c.phone : ''}</Text>
            </TouchableOpacity>
          ))}
          {stmtCustId && (
            <View style={{ backgroundColor: '#EEF4FF', borderRadius: 8, padding: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: C.navy, fontWeight: '700', fontSize: 13 }}>✓ {stmtCustQ}</Text>
              <TouchableOpacity onPress={() => { setStmtCustId(null); setStmtCustQ(''); }}>
                <Text style={{ color: C.red, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: C.mute, fontWeight: '600', marginBottom: 4 }}>FROM DATE</Text>
              <CalendarPicker value={stmtFrom} onChange={setStmtFrom} label="Select" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: C.mute, fontWeight: '600', marginBottom: 4 }}>TO DATE</Text>
              <CalendarPicker value={stmtTo} onChange={setStmtTo} label="Select" />
            </View>
          </View>
          <TouchableOpacity onPress={generateStatement}
            style={{ backgroundColor: C.navy, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>📄 Generate Report</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Statement Preview Modal */}
      <Modal visible={stmtPreview} animationType="slide" onRequestClose={() => setStmtPreview(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          {/* Preview Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.navy, paddingHorizontal: 14, paddingVertical: 10, flexWrap: 'wrap', gap: 6 }}>
            <TouchableOpacity onPress={() => setStmtPreview(false)} style={{ paddingRight: 10 }}>
              <Text style={{ color: '#fff', fontSize: 22 }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, flex: 1 }}>Ledger Statement</Text>
            <TouchableOpacity onPress={() => setStmtZoom((z) => Math.min(z + 0.1, 1.5))}
              style={{ backgroundColor: C.gold + '44', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>A+</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStmtZoom((z) => Math.max(z - 0.1, 0.6))}
              style={{ backgroundColor: C.gold + '44', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>A-</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={exportStmtPDF}
              style={{ backgroundColor: C.red, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>🖨 Print/PDF</Text>
            </TouchableOpacity>
          </View>

          {stmtData && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
              {/* Company Header */}
              <View style={{ alignItems: 'center', marginBottom: 12, borderBottomWidth: 2, borderColor: C.navy, paddingBottom: 10 }}>
                <Text style={{ fontSize: 18 * stmtZoom, fontWeight: '800', color: C.navy }}>{(db.settings || {}).shopName || 'Kuber Jewellery'}</Text>
                <Text style={{ fontSize: 12 * stmtZoom, color: C.mute, marginTop: 2 }}>Customer Ledger Statement</Text>
              </View>

              {/* Customer Info */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12, backgroundColor: '#F7FAFF', borderRadius: 8, padding: 10 }}>
                {[
                  ['Customer Code', stmtData.cust.custNo || '-'],
                  ['Customer Name', stmtData.cust.name],
                  ['Phone', stmtData.cust.phone || '-'],
                  ['Period', (stmtData.from ? dmy(stmtData.from) : 'All') + ' – ' + (stmtData.to ? dmy(stmtData.to) : 'All')],
                ].map(([label, val]) => (
                  <View key={label} style={{ minWidth: 140 }}>
                    <Text style={{ fontSize: 10 * stmtZoom, color: C.mute, fontWeight: '600' }}>{label}</Text>
                    <Text style={{ fontSize: 13 * stmtZoom, color: C.text, fontWeight: '700' }}>{val}</Text>
                  </View>
                ))}
              </View>

              {/* Opening Balance */}
              <View style={{ flexDirection: 'row', backgroundColor: '#FFF8E7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8, marginBottom: 4 }}>
                <Text style={{ flex: 3, fontSize: 12 * stmtZoom, fontWeight: '700', color: C.gold }}>Opening Balance</Text>
                <Text style={{ flex: 1, fontSize: 12 * stmtZoom, color: C.mute, textAlign: 'center' }}>-</Text>
                <Text style={{ flex: 1, fontSize: 12 * stmtZoom, color: C.mute, textAlign: 'center' }}>-</Text>
                <Text style={{ flex: 1, fontSize: 12 * stmtZoom, fontWeight: '700', color: C.navy, textAlign: 'right' }}>{inr(stmtData.openingBalance)}</Text>
              </View>

              {/* Table Header */}
              <View style={{ flexDirection: 'row', backgroundColor: C.navy, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 7, marginBottom: 2 }}>
                {[['Date', 1], ['Doc No', 1.2], ['Bill No', 1], ['Type', 1.2], ['Debit', 1], ['Credit', 1], ['Balance', 1]].map(([h, f]) => (
                  <Text key={h} style={{ flex: f, fontSize: 10 * stmtZoom, color: '#fff', fontWeight: '700', textAlign: h === 'Debit' || h === 'Credit' || h === 'Balance' ? 'right' : 'left' }}>{h}</Text>
                ))}
              </View>

              {/* Rows */}
              {stmtData.rows.length === 0 ? (
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <Text style={{ color: C.mute }}>No transactions in this period.</Text>
                </View>
              ) : stmtData.rows.map((r, i) => (
                <View key={r.ref + i} style={{ flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 7, borderBottomWidth: 1, borderColor: '#E8EDF2', backgroundColor: i % 2 === 0 ? '#fff' : '#F7FAFF' }}>
                  <Text style={{ flex: 1, fontSize: 11 * stmtZoom, color: C.text }}>{dmy(r.date)}</Text>
                  <Text style={{ flex: 1.2, fontSize: 11 * stmtZoom, color: C.mute }} numberOfLines={1}>{r.docNo}</Text>
                  <Text style={{ flex: 1, fontSize: 11 * stmtZoom, color: C.mute }} numberOfLines={1}>{r.billNo}</Text>
                  <Text style={{ flex: 1.2, fontSize: 11 * stmtZoom, color: C.text }} numberOfLines={1}>{r.type}</Text>
                  <Text style={{ flex: 1, fontSize: 11 * stmtZoom, color: r.debit > 0 ? C.red : C.mute, textAlign: 'right', fontWeight: r.debit > 0 ? '600' : '400' }}>{r.debit > 0 ? inr(r.debit) : '-'}</Text>
                  <Text style={{ flex: 1, fontSize: 11 * stmtZoom, color: r.credit > 0 ? C.green : C.mute, textAlign: 'right', fontWeight: r.credit > 0 ? '600' : '400' }}>{r.credit > 0 ? inr(r.credit) : '-'}</Text>
                  <Text style={{ flex: 1, fontSize: 11 * stmtZoom, color: C.navy, textAlign: 'right', fontWeight: '700' }}>{inr(r.balance)}</Text>
                </View>
              ))}

              {/* Totals */}
              <View style={{ flexDirection: 'row', backgroundColor: '#D6E8FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 9, marginTop: 4 }}>
                <Text style={{ flex: 3, fontSize: 12 * stmtZoom, fontWeight: '700', color: C.navy }}>Total / Closing Balance</Text>
                <Text style={{ flex: 1, fontSize: 12 * stmtZoom, fontWeight: '800', color: C.red, textAlign: 'right' }}>{inr(stmtData.totalDebit)}</Text>
                <Text style={{ flex: 1, fontSize: 12 * stmtZoom, fontWeight: '800', color: C.green, textAlign: 'right' }}>{inr(stmtData.totalCredit)}</Text>
                <Text style={{ flex: 1, fontSize: 12 * stmtZoom, fontWeight: '800', color: C.navy, textAlign: 'right' }}>{inr(stmtData.closingBalance)}</Text>
              </View>

              {/* Summary Cards */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                {[
                  { label: 'Opening Balance', value: inr(stmtData.openingBalance), color: C.gold },
                  { label: 'Total Debit', value: inr(stmtData.totalDebit), color: C.red },
                  { label: 'Total Credit', value: inr(stmtData.totalCredit), color: C.green },
                  { label: 'Closing Balance', value: inr(stmtData.closingBalance), color: C.navy },
                ].map((s) => (
                  <View key={s.label} style={{ flex: 1, backgroundColor: '#F7FAFF', borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E8EDF2' }}>
                    <Text style={{ fontSize: 11 * stmtZoom, fontWeight: '800', color: s.color }} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
                    <Text style={{ fontSize: 9 * stmtZoom, color: C.mute, marginTop: 2, textAlign: 'center' }}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const cell = { fontSize: 12, color: C.text, paddingHorizontal: 6, textAlignVertical: 'center' };

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
    await update((d) => ({ ...d, settings: { ...(d.settings || {}), shopName: shopName.trim() || 'Kuber Jewellery', defaultRate: defRate, defaultMonths: defMonths, defaultInterestMode: defMode } }));
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

      <TermsEditor db={db} update={update} />
    </Page>
  );
}

function TermsEditor({ db, update }) {
  const [terms, setTerms] = useState((db.settings || {}).termsAndConditions || DUMMY_TERMS);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);

  const save = async () => {
    await update((d) => ({ ...d, settings: { ...(d.settings || {}), termsAndConditions: terms } }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <View style={{ marginTop: 24 }}>
      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: C.gold }} />
          <Text style={{ fontWeight: '800', fontSize: 16, color: C.navy }}>Terms & Conditions</Text>
        </View>
        <TouchableOpacity onPress={() => setPreview((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5,
            borderRadius: 8, borderWidth: 1, borderColor: preview ? C.navy : C.line,
            backgroundColor: preview ? C.navy : '#fff' }}>
          <Text style={{ fontSize: 13, color: preview ? '#fff' : C.mute, fontWeight: '600' }}>
            {preview ? '✏️ Edit' : '👁 Preview'}
          </Text>
        </TouchableOpacity>
      </View>

      {preview ? (
        /* ── Preview panel ── */
        <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 16, minHeight: 200 }}>
          {terms.trim() ? terms.split('\n').map((line, i) => {
            const isH = line.startsWith('##');
            const isB = line.startsWith('-') || line.startsWith('•');
            const text = line.replace(/^##\s*/, '').replace(/^[-•]\s*/, '');
            if (!text.trim()) return <View key={i} style={{ height: 8 }} />;
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: isH ? 4 : 4 }}>
                {isB && <Text style={{ color: C.gold, fontWeight: '700', marginRight: 7, marginTop: 2, fontSize: 14 }}>•</Text>}
                <Text style={{ flex: 1, fontSize: isH ? 14 : 13, fontWeight: isH ? '800' : '400',
                  color: isH ? C.navy : C.text, marginTop: isH ? 10 : 0, lineHeight: 21 }}>{text}</Text>
              </View>
            );
          }) : <Text style={{ color: C.mute, fontSize: 13 }}>Nothing to preview yet.</Text>}
        </View>
      ) : (
        /* ── Editor panel ── */
        <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
          {/* Toolbar hint */}
          <View style={{ flexDirection: 'row', gap: 6, padding: 10, borderBottomWidth: 1, borderColor: C.line, backgroundColor: '#F7FAFF' }}>
            {[['##', 'Heading'], ['-', 'Bullet'], ['', 'Blank line']].map(([sym, lbl]) => (
              <View key={lbl} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff',
                borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.line }}>
                {sym ? <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: C.gold, fontWeight: '700' }}>{sym}</Text> : null}
                <Text style={{ fontSize: 11, color: C.mute }}>{lbl}</Text>
              </View>
            ))}
          </View>
          <TextInput
            value={terms}
            onChangeText={setTerms}
            multiline
            style={{ padding: 14, fontSize: 13, color: C.text, minHeight: 260,
              textAlignVertical: 'top', lineHeight: 22,
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
            placeholder="Type your terms here…"
            placeholderTextColor="#B0BAC5"
          />
          {/* Footer: char count */}
          <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderColor: C.line, backgroundColor: '#F7FAFF', alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: C.mute }}>{terms.length} characters</Text>
          </View>
        </View>
      )}

      {/* Save button */}
      <TouchableOpacity onPress={save}
        style={{ marginTop: 12, backgroundColor: saved ? C.green : C.navy, borderRadius: 10,
          paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
          {saved ? '✓  Saved!' : '💾  Save Terms & Conditions'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const DUMMY_TERMS = `## Kuber Gold Loan – Terms & Conditions

## 1. Loan Agreement
- The borrower agrees to pledge gold ornaments as collateral for the loan amount sanctioned.
- The loan amount is determined based on the purity, weight, and current market value of the pledged gold.
- All ornaments will be safely stored in our secured vault during the loan tenure.

## 2. Interest & Repayment
- Interest is charged at the agreed rate per month on the outstanding principal.
- Interest must be paid on or before the due date each month to avoid penalties.
- Partial or full repayment of principal is accepted at any time during the loan tenure.

## 3. Loan Tenure & Renewal
- The standard loan tenure is as agreed at the time of disbursement.
- Loans may be renewed upon mutual agreement before the due date.
- Failure to repay or renew within the tenure may result in auction of pledged gold as per applicable law.

## 4. Auction Notice
- A minimum of 14 days written notice will be provided before any auction proceedings.
- Any surplus amount after auction and recovery of dues will be returned to the borrower.

## 5. Customer Obligations
- The borrower must ensure the gold pledged is their own property and free from disputes.
- Valid government-issued ID proof is mandatory for all loan transactions.
- Any change in contact details must be communicated to us immediately.

## 6. Privacy
- Customer information is stored securely and will not be shared with third parties.
- Data is used solely for loan management and communication purposes.

## 7. Governing Law
- These terms are governed by the laws of India and applicable RBI guidelines for gold loan NBFCs.
- Any disputes shall be subject to the jurisdiction of local courts.

## Contact Us
- For queries, please visit our office or contact us at the number provided at the time of loan.
`;
