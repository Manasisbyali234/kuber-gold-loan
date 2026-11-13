import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StatusBar, BackHandler, Platform, Modal, Pressable } from 'react-native';
import { load, save } from './src/storage';
import { C, Header, KHeader } from './src/ui';
import * as S from './src/screens';
import * as ScreenOrientation from 'expo-screen-orientation';

const TABS = [
  ['home', '🏠  Home'],
  ['summary', '📊  Summary'],
  ['customers', '👥  Customers'],
  ['loans', '💰  Loans'],
  ['reports', '📄  Reports'],
  ['reportsMenu', '📋  All Reports'],
  ['ledger', '📒  Customer Ledger'],
  ['more', '🗄️  Backup'],
  ['settings', '⚙️  Settings'],
  ['terms', '📜  Terms & Conditions'],
];

export default function App() {
  const [db, setDb] = useState(null);
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState('home');
  const [sub, setSub] = useState(null);
  const [landscape, setLandscape] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
      dayEntry: <S.DayEntry {...p} />,
      customerProfile: <S.CustomerProfile {...p} id={sub.id} />,
      reportDetail: <S.ReportDetail {...p} sub={sub} />,
      saleDetail: <S.SaleDetail {...p} paymentId={sub.paymentId} />,
    };
    screen = map[sub.name] || null;
  } else {
    const titles = { home: 'K Jewels', summary: 'Member Summary', customers: 'Customers', loans: 'Loans', reports: 'Reports', reportsMenu: 'All Reports', ledger: 'Customer Ledger', more: 'Backup & Restore', settings: 'Settings', terms: 'Terms & Conditions' };
    const menuBtn = (
      <TouchableOpacity onPress={() => setMenuOpen(true)} style={{ paddingHorizontal: 10 }}>
        <Text style={{ color: C.gold, fontSize: 22 }}>☰</Text>
      </TouchableOpacity>
    );
    const rotateBtn = (
      <TouchableOpacity onPress={toggleOrientation} style={{ paddingHorizontal: 10 }}>
        <Text style={{ color: C.gold, fontSize: 18 }}>⟳</Text>
      </TouchableOpacity>
    );
    const backToHome = tab !== 'home' ? () => setTab('home') : handleBack;
    const body = {
      home: <S.HomeScreen key={refreshKey} {...p} />,
      summary: <S.MemberSummary {...p} />,
      customers: <S.Customers {...p} />,
      loans: <S.Loans {...p} />,
      reports: <S.Reports {...p} />,
      reportsMenu: <S.ReportsMenu {...p} />,
      ledger: <S.CustomerLedger db={db} back={() => setTab('home')} />,
      more: <S.Backup {...p} lock={() => setOk(false)} />,
      settings: <S.Profile {...p} />,
      terms: <S.TermsView db={db} back={() => setTab('home')} />,
    };
    const sidebar = (
      <View style={{ width: 220, backgroundColor: C.navy, paddingTop: 24, paddingHorizontal: 0 }}>
        <Text style={{ color: C.gold, fontSize: 18, fontWeight: '800', paddingHorizontal: 20, marginBottom: 24 }}>💍 K Jewels</Text>
        {TABS.map(([k, n]) => (
          <React.Fragment key={k}>
            <TouchableOpacity onPress={() => { setTab(k); setSub(null); }}
              style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: tab === k ? C.navy2 : 'transparent', borderLeftWidth: tab === k ? 4 : 0, borderLeftColor: C.gold }}>
              <Text style={{ color: tab === k ? C.gold : '#fff', fontSize: 14, fontWeight: tab === k ? '700' : '400' }}>{n}</Text>
            </TouchableOpacity>
            {k === 'home' && (
              <TouchableOpacity onPress={() => { setSub({ name: 'customerProfile' }); }}
                style={{ paddingVertical: 14, paddingHorizontal: 20 }}>
                <Text style={{ color: '#fff', fontSize: 14 }}>👤  Customer Profile</Text>
              </TouchableOpacity>
            )}
          </React.Fragment>
        ))}
      </View>
    );

    screen = landscape ? (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {sidebar}
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ backgroundColor: C.navy, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 }}>{titles[tab]}</Text>
            <TouchableOpacity onPress={toggleOrientation} style={{ paddingHorizontal: 10 }}>
              <Text style={{ color: C.gold, fontSize: 18 }}>⊠</Text>
            </TouchableOpacity>
          </View>
          {body[tab]}
        </View>
      </View>
    ) : (
      <>
        {tab === 'home'
          ? <KHeader onMenuPress={() => setMenuOpen(true)} onRefreshPress={toggleOrientation} />
          : <Header title={titles[tab]} onBack={backToHome} left={menuBtn} right={rotateBtn} />
        }
        {body[tab]}
        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={{ flex: 1, flexDirection: 'row' }} onPress={() => setMenuOpen(false)}>
            <Pressable style={{ width: 260, backgroundColor: C.navy, paddingTop: 48, paddingHorizontal: 0 }} onPress={() => {}}>
              <Text style={{ color: C.gold, fontSize: 20, fontWeight: '800', paddingHorizontal: 20, marginBottom: 18 }}>Kuber Gold Loan</Text>
              {TABS.map(([k, n]) => (
                <React.Fragment key={k}>
                  <TouchableOpacity onPress={() => { setTab(k); setMenuOpen(false); }}
                    style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: tab === k ? C.navy2 : 'transparent', borderLeftWidth: tab === k ? 4 : 0, borderLeftColor: C.gold }}>
                    <Text style={{ color: tab === k ? C.gold : '#fff', fontSize: 15, fontWeight: tab === k ? '700' : '400' }}>{n}</Text>
                  </TouchableOpacity>
                  {k === 'home' && (
                    <TouchableOpacity onPress={() => { setSub({ name: 'customerProfile' }); setMenuOpen(false); }}
                      style={{ paddingVertical: 14, paddingHorizontal: 20 }}>
                      <Text style={{ color: '#fff', fontSize: 15 }}>👤  Customer Profile</Text>
                    </TouchableOpacity>
                  )}
                </React.Fragment>
              ))}
            </Pressable>
            <View style={{ flex: 1, backgroundColor: '#0006' }} />
          </Pressable>
        </Modal>
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
      <View style={{ flex: 1, width: '100%', maxWidth: landscape ? 1400 : 480, alignSelf: 'center' }}>
        {screen}
      </View>

    </SafeAreaView>
  );
}
