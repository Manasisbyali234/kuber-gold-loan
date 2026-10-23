import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const KEY = 'kuber_gold_loan_db_v1';
export const LIMIT = Infinity;
export const emptyDb = () => ({
  pin: null,
  editPassword: null,          // separate password to unlock editing
  customers: [],
  loans: [],
  payments: [],
  cashInHand: 0,               // running cash balance
  itemSuggestions: [],         // deduplicated item/gold-type suggestions
  settings: {
    shopName: 'Kuber Jewellery',
    defaultRate: '2',
    defaultMonths: '6',
    defaultInterestMode: 'day',
  },
  dashboardConfig: {           // which dashboard cards are visible
    activeLoans: true,
    outstanding: true,
    todayCollections: true,
    overdue: true,
  },
});

export async function load() {
  try {
    const r = await AsyncStorage.getItem(KEY);
    return r ? { ...emptyDb(), ...JSON.parse(r) } : emptyDb();
  } catch (e) {
    console.warn('kuber: load failed', e);
    return emptyDb();
  }
}

let _queue = Promise.resolve();
export function save(db) {
  _queue = _queue.then(() =>
    AsyncStorage.setItem(KEY, JSON.stringify(db)).catch((e) => console.warn('kuber: save failed', e))
  );
  return _queue;
}

// Save image to app's persistent directory; returns local file URI (or base64 on web)
export async function saveImage(base64OrUri) {
  if (!base64OrUri) return null;
  if (Platform.OS === 'web') return base64OrUri;
  const dir = FileSystem.documentDirectory + 'kuber_images/';
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const filename = Date.now() + '_' + Math.random().toString(36).slice(2) + '.jpg';
  const dest = dir + filename;
  if (base64OrUri.startsWith('data:') || base64OrUri.startsWith('data:image')) {
    const b64 = base64OrUri.split(',')[1];
    await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
  } else {
    await FileSystem.copyAsync({ from: base64OrUri, to: dest });
  }
  return dest;
}
