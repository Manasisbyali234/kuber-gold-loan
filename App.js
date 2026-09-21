import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { load, save } from './src/storage';
import { C, Header } from './src/ui';
import * as S from './src/screens';

const TABS = [['home', 'Home'], ['customers', 'Customers'], ['loans', 'Loans'], ['reports', 'Reports'], ['more', 'Backup']];

export default function App() {
  const [db, setDb] = useState(null); const [ok, setOk] = useState(false);
  const [tab, setTab] = useState('home'); const [sub, setSub] = useState(null);
  useEffect(() => { load().then(setDb); }, []);
  if (!db) return <View style={{ flex: 1, backgroundColor: C.navy }} />;
  const update = async (fn) => { const n = fn(db); setDb(n); await save(n); };
  const go = (name, params = {}) => setSub({ name, ...params });
  const back = () => setSub(null);
  const p = { db, update, go, back };
  if (!ok) return <SafeAreaView style={{ flex: 1, backgroundColor: C.navy }}><S.Login db={db} update={update} onOk={() => setOk(true)} /></SafeAreaView>;

  let screen;
  if (sub) {
    const m = { customerForm: <S.CustomerForm {...p} />, loanForm: <S.LoanForm {...p} />, loan: <S.LoanDetail {...p} id={sub.id} />, statement: <S.Statement {...p} id={sub.id} /> };
    screen = m[sub.name];
  } else {
    const titles = { home: 'Dashboard', customers: 'Customers', loans: 'Loans', reports: 'Reports', more: 'Backup and restore' };
    const b = { home: <S.Dashboard {...p} />, customers: <S.Customers {...p} />, loans: <S.Loans {...p} />, reports: <S.Reports {...p} />, more: <S.Backup {...p} lock={() => setOk(false)} /> };
    screen = (<><Header title={titles[tab]} />{b[tab]}</>);
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />
      <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>{screen}</View>
      {!sub && (
        <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderColor: C.line }}>
          {TABS.map(([k, n]) => (
            <TouchableOpacity key={k} onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderTopWidth: 3, borderTopColor: tab === k ? C.gold : 'transparent' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: tab === k ? C.navy : C.mute }}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}
