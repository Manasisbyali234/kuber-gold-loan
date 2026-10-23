import { Platform, Alert } from 'react-native';
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const today = () => new Date().toISOString().slice(0, 10);
export const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
export const dmy = (d) => { if (!d) return '-'; const parts = d.slice(0, 10).split('-'); if (parts.length !== 3 || parts.some((p) => !p || p === 'undefined')) return '-'; const [y, m, day] = parts; return `${day}-${m}-${y}`; };
// Parse DD-MM-YYYY or YYYY-MM-DD input → YYYY-MM-DD (returns '' if invalid)
export const parseDmy = (s) => { if (!s) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s; };
export const daysBetween = (a, b) => Math.max(0, Math.floor((new Date(b) - new Date(a)) / 86400000));
export const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + Number(m || 0)); return x.toISOString().slice(0, 10); };
export const notify = (msg) => (Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Kuber Gold Loan', msg));
export const confirm = (msg, onYes, yes = 'Yes') => {
  if (Platform.OS === 'web') { if (window.confirm(msg)) onYes(); }
  else Alert.alert('Confirm', msg, [{ text: 'Cancel', style: 'cancel' }, { text: yes, onPress: onYes }]);
};

// Financial year: Apr–Mar. Returns prefix like "GL/25-26/"
export function fyPrefix(prefix = 'GL') {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(); // 0-indexed
  const fyStart = m >= 3 ? y : y - 1;
  const fyEnd = (fyStart + 1).toString().slice(2);
  return `${prefix}/${fyStart}-${fyEnd}/`;
}

// Generate next customer serial: CUS-001, CUS-002 …
export function nextCustomerSerial(customers) {
  const nums = customers
    .map((c) => c.custNo)
    .filter(Boolean)
    .map((n) => parseInt(n.replace('CUS-', ''), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return 'CUS-' + String(max + 1).padStart(3, '0');
}

// Generate next serial: GL/25-26/A001, GL/25-26/A002 … GL/25-26/Z999 then B001…
export function nextSerial(loans, prefix = 'GL') {
  const pfx = fyPrefix(prefix);
  const existing = loans
    .map((l) => l.no)
    .filter((n) => n && n.startsWith(pfx))
    .map((n) => n.slice(pfx.length)); // e.g. "A001"
  if (!existing.length) return pfx + 'A001';
  existing.sort();
  const last = existing[existing.length - 1];
  const letter = last[0];
  const num = parseInt(last.slice(1), 10);
  if (num < 999) return pfx + letter + String(num + 1).padStart(3, '0');
  const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);
  return pfx + nextLetter + '001';
}

// months elapsed (completed) between two YYYY-MM-DD strings
export function monthsBetween(a, b) {
  const da = new Date(a), db = new Date(b);
  const m = (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
  // if day-of-month hasn't reached yet, subtract 1
  return Math.max(0, db.getDate() < da.getDate() ? m - 1 : m);
}

// interestMode: 'day' (pro-rated daily, default) | 'month' (completed months only)
export function calc(loan, payments) {
  const end = loan.status === 'closed' && loan.closedOn ? loan.closedOn : today();
  const days = daysBetween(loan.date, end);
  const mode = loan.interestMode || 'day';
  const interest = mode === 'month'
    ? (loan.principal * loan.rate / 100) * monthsBetween(loan.date, end)
    : (loan.principal * loan.rate / 100) * (days / 30);
  const paid = payments.filter((p) => p.loanId === loan.id).reduce((s, p) => s + p.amount, 0);
  const total = loan.principal + interest;
  const outstanding = loan.status === 'closed' ? 0 : Math.max(0, total - paid);
  const overdue = loan.status === 'active' && loan.dueDate < today() && outstanding > 0;
  return { days, interest, paid, total, outstanding, overdue, mode };
}
