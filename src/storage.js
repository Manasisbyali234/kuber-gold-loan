import AsyncStorage from '@react-native-async-storage/async-storage';
// AsyncStorage = localStorage on web, on-device storage on Android. Fully offline.
const KEY = 'kuber_gold_loan_db_v1';
export const emptyDb = () => ({ pin: null, customers: [], loans: [], payments: [] });
export async function load() {
  try { const r = await AsyncStorage.getItem(KEY); return r ? { ...emptyDb(), ...JSON.parse(r) } : emptyDb(); }
  catch (e) { return emptyDb(); }
}
export async function save(db) { await AsyncStorage.setItem(KEY, JSON.stringify(db)); }
