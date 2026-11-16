import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StatusBar, BackHandler, Platform } from 'react-native';
import { load, save } from './src/storage';
import { C, Header } from './src/ui';
import * as S from './src/screens';
import * as ScreenOrientation from 'expo-screen-orientation';

const TABS = [
  ['home', 'Home'],
  ['summary', 'Summary'],
  ['customers', 'Customers'],
  ['loans', 'Loans'],
  ['reports', 'Reports'],
  ['more', 'Backup'],
  ['settings', 'Settings'],
];

export default function App() {
  const [db, setDb] = useState(null);
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState('home');
  const [sub, setSub] = useState(null);
  const [landscape, setLandscape] = useState(false);

  useEffect(() => { load().then(setDb); }, []);

  // Hardware back — confirm exit when on root, go back when in sub-screen
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sub) { setSub(null); return true; }
      BackHandler.exitApp(); // will be intercepted by the confirm below
      return true;
    });
    return () => handler.remove();
  }, [sub]);

  // Confirm before exit on Android root
  const handleBack = useCallback(() => {
    if (sub) { setSub(null); return; }
    if (Platform.OS === 'web') { if (window.confirm('Exit Kuber Gold Loan?')) window.close(); return; }
    const { Alert } = require('react-native');
    Alert.alert('Exit', 'Exit Kuber Gold Loan?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
    ]);
  }, [sub]);

  // Screen rotation toggle (tablet / web)
  const toggleOrientation = async () => {
    if (Platform.OS === 'web') { setLandscape((v) => !v); return; }
    if (landscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    setLandscape((v) => !v);
  };

  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  if (!db) return (
    <View style={{ flex: 1, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: C.gold, fontSize: 16 }}>Loading…</Text>
    </View>
  );

  const update = async (fn) => {
    const n = fn(db);
    setDb(n);
    setSaving(true);
    clearTimeout(saveTimer.current);
    await save(n);
    saveTimer.current = setTimeout(() => setSaving(false), 800);
  };
  const go = (name, params = {}) => setSub({ name, ...params });
  const back = () => setSub(null);
  const p = { db, update, go, back };

  if (!ok) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.navy }}>
      <S.Login db={db} update={update} onOk={() => setOk(true)} />
    </SafeAreaView>
  );

  let screen;
  if (sub) {
    const map = {
      customerForm: <S.CustomerForm {...p} />,
      customerEdit: <S.CustomerEdit {...p} id={sub.id} />,
      loanForm: <S.LoanForm {...p} />,
      loan: <S.LoanDetail {...p} id={sub.id} />,
      statement: <S.Statement {...p} id={sub.id} />,
      dashboardConfig: <S.DashboardConfig {...p} />,
      profile: <S.Profile {...p} />,
    };
    screen = map[sub.name] || null;
  } else {
    const titles = { home: 'Dashboard', summary: 'Member Summary', customers: 'Customers', loans: 'Loans', reports: 'Reports', more: 'Backup & Restore', settings: 'Settings' };
    const rotateBtn = (
      <TouchableOpacity onPress={toggleOrientation} style={{ paddingHorizontal: 10 }}>
        <Text style={{ color: C.gold, fontSize: 18 }}>⟳</Text>
      </TouchableOpacity>
    );
    const body = {
      home: <S.Dashboard {...p} />,
      summary: <S.MemberSummary {...p} />,
      customers: <S.Customers {...p} />,
      loans: <S.Loans {...p} />,
      reports: <S.Reports {...p} />,
      more: <S.Backup {...p} lock={() => setOk(false)} />,
      settings: <S.Profile {...p} />,
    };
    screen = (
      <>
        <Header title={titles[tab]}
          onBack={tab !== 'home' ? undefined : handleBack}
          right={rotateBtn}
        />
        {body[tab]}
      </>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />
      {saving && (
        <View style={{ position: 'absolute', top: 0, right: 0, zIndex: 99, padding: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold }} />
        </View>
      )}
      <View style={{ flex: 1, width: '100%', maxWidth: landscape ? undefined : 720, alignSelf: 'center' }}>
        {screen}
      </View>
      {!sub && (
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderColor: C.line, paddingBottom: Platform.OS === 'android' ? 8 : 0 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', minWidth: '100%' }}
          >
            {TABS.map(([k, n]) => (
              <TouchableOpacity key={k} onPress={() => setTab(k)}
                style={{ minWidth: 64, flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', borderTopWidth: 3, borderTopColor: tab === k ? C.gold : 'transparent' }}>
                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: tab === k ? C.navy : C.mute }}>{n}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}
