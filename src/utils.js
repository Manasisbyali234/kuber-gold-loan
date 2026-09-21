import { Platform, Alert } from 'react-native';
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const today = () => new Date().toISOString().slice(0, 10);
export const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
export const dmy = (d) => { if (!d) return '-'; const [y, m, day] = d.slice(0, 10).split('-'); return `${day}/${m}/${y}`; };
export const daysBetween = (a, b) => Math.max(0, Math.floor((new Date(b) - new Date(a)) / 86400000));
export const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + Number(m || 0)); return x.toISOString().slice(0, 10); };
export const notify = (msg) => (Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Kuber Gold Loan', msg));
export const confirm = (msg, onYes, yes = 'Yes') => {
  if (Platform.OS === 'web') { if (window.confirm(msg)) onYes(); }
  else Alert.alert('Confirm', msg, [{ text: 'Cancel', style: 'cancel' }, { text: yes, onPress: onYes }]);
};
// Simple interest, rate is % per month, pro-rated per day. Updates live.
export function calc(loan, payments) {
  const end = loan.status === 'closed' && loan.closedOn ? loan.closedOn : today();
  const days = daysBetween(loan.date, end);
  const interest = (loan.principal * loan.rate / 100) * (days / 30);
  const paid = payments.filter((p) => p.loanId === loan.id).reduce((s, p) => s + p.amount, 0);
  const total = loan.principal + interest;
  const outstanding = loan.status === 'closed' ? 0 : Math.max(0, total - paid);
  const overdue = loan.status === 'active' && loan.dueDate < today() && outstanding > 0;
  return { days, interest, paid, total, outstanding, overdue };
}
