import React, { useState, forwardRef, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform, PanResponder } from 'react-native';
import Svg, { Path } from 'react-native-svg';
export const C = { navy: '#12263A', navy2: '#1C3A57', gold: '#B8912F', goldSoft: '#F6EFD9', bg: '#F3F5F8', text: '#1B2733', mute: '#6B7A8A', red: '#B93A2E', green: '#1E8A58', line: '#E1E6EC', white: '#fff' };
export const Btn = ({ title, onPress, kind, style }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.8}
    style={[s.btn, kind === 'ghost' && s.ghost, kind === 'danger' && { backgroundColor: C.red }, style]}>
    <Text style={[s.btnT, kind === 'ghost' && { color: C.navy }]}>{title}</Text>
  </TouchableOpacity>
);
export const Field = forwardRef(({ label, ...p }, ref) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={s.label}>{label}</Text>
    <TextInput ref={ref} placeholderTextColor="#9AA7B4" {...p} style={[s.input, p.multiline && { height: 90, textAlignVertical: 'top' }, p.style]} />
  </View>
));
export const Card = ({ children, style, onPress }) => {
  const W = onPress ? TouchableOpacity : View;
  return <W onPress={onPress} activeOpacity={0.8} style={[s.card, style]}>{children}</W>;
};
export const Header = ({ title, onBack, right }) => (
  <View style={s.header}>
    {onBack ? <TouchableOpacity onPress={onBack} style={{ paddingRight: 14 }}><Text style={{ color: '#fff', fontSize: 22 }}>‹</Text></TouchableOpacity> : null}
    <Text style={s.hTitle}>{title}</Text>
    <View style={{ flex: 1 }} />{right}
  </View>
);
export const Row = ({ a, b, bold, color }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
    <Text style={{ color: C.mute, flexShrink: 1 }}>{a}</Text>
    <Text style={{ color: color || C.text, fontWeight: bold ? '700' : '500', marginLeft: 12, textAlign: 'right', flexShrink: 1 }}>{b}</Text>
  </View>
);
export const Chip = ({ text, color }) => (
  <View style={{ backgroundColor: (color || C.mute) + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
    <Text style={{ color: color || C.mute, fontSize: 12, fontWeight: '600' }}>{text}</Text>
  </View>
);
export const Empty = ({ text }) => <Text style={{ color: C.mute, textAlign: 'center', marginTop: 40 }}>{text}</Text>;

/* Password gate modal — shows a PIN/password prompt, calls onOk() on success */
export function PasswordModal({ visible, storedPassword, onOk, onCancel, title = 'Enter edit password' }) {
  const [pw, setPw] = useState('');
  const check = () => {
    if (pw === storedPassword) { setPw(''); onOk(); }
    else { setPw(''); if (Platform.OS === 'web') window.alert('Wrong password'); else require('react-native').Alert.alert('Wrong password', ''); }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 28 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 20 }}>
          <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12, color: C.text }}>{title}</Text>
          <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder="Password" placeholderTextColor="#9AA7B4"
            style={[s.input, { marginBottom: 12 }]} autoFocus />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn title="Cancel" kind="ghost" onPress={() => { setPw(''); onCancel(); }} style={{ flex: 1 }} />
            <Btn title="Unlock" onPress={check} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* Inline suggestion list for text fields */
export function SuggestField({ label, value, onChangeText, suggestions = [], ...rest }) {
  const [show, setShow] = useState(false);
  const filtered = value.length > 0 ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()) : [];
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#9AA7B4" {...rest} value={value}
        onChangeText={(t) => { onChangeText(t); setShow(true); }}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        style={s.input} />
      {show && filtered.length > 0 && (
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 8, marginTop: 2 }}>
          {filtered.slice(0, 5).map((item) => (
            <TouchableOpacity key={item} onPress={() => { onChangeText(item); setShow(false); }}
              style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Text style={{ color: C.text }}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

/* Draw-to-sign signature pad */
export function SignaturePad({ value, onChange }) {
  const [paths, setPaths] = useState([]);
  const current = useRef([]);

  const toD = (pts) => pts.length < 2 ? '' : pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      current.current = [{ x, y }];
      setPaths((p) => [...p, [{ x, y }]]);
    },
    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      current.current = [...current.current, { x, y }];
      setPaths((p) => [...p.slice(0, -1), current.current]);
    },
    onPanResponderRelease: () => {
      if (onChange) onChange(paths);
    },
  })).current;

  const clear = () => { setPaths([]); if (onChange) onChange([]); };

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <Text style={s.label}>Customer signature</Text>
        {paths.length > 0 && <TouchableOpacity onPress={clear}><Text style={{ color: C.red, fontSize: 13, fontWeight: '600' }}>Clear</Text></TouchableOpacity>}
      </View>
      <View {...pan.panHandlers}
        style={{ height: 120, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: C.gold, backgroundColor: '#fff', overflow: 'hidden' }}>
        {paths.length === 0
          ? <Text style={{ color: C.gold, fontWeight: '600', textAlign: 'center', marginTop: 48 }}>Sign here</Text>
          : <Svg style={{ flex: 1 }}>
              {paths.map((pts, i) => <Path key={i} d={toD(pts)} stroke={C.navy} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
            </Svg>}
      </View>
    </View>
  );
}

/* Mini calendar picker — single or range selection */
const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export function CalendarPicker({ value, value2, onChange, onChangeEnd, label }) {
  const today = new Date();
  const parseD = (s) => s ? new Date(s + 'T00:00:00') : null;
  const fmt = (d) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';

  const initD = parseD(value) || today;
  const [cur, setCur] = useState({ y: initD.getFullYear(), m: initD.getMonth() });
  const [open, setOpen] = useState(false);

  const firstDay = new Date(cur.y, cur.m, 1).getDay();
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);

  const selA = parseD(value);
  const selB = parseD(value2);

  const isSelected = (d) => {
    if (!d) return false;
    const dt = new Date(cur.y, cur.m, d);
    if (selA && selB) return dt >= selA && dt <= selB;
    return selA && fmt(dt) === fmt(selA);
  };
  const isStart = (d) => d && selA && fmt(new Date(cur.y, cur.m, d)) === fmt(selA);
  const isEnd = (d) => d && selB && fmt(new Date(cur.y, cur.m, d)) === fmt(selB);

  const pick = (d) => {
    if (!d) return;
    const s = fmt(new Date(cur.y, cur.m, d));
    onChange(s);
    if (onChangeEnd) onChangeEnd('');
  };
  const pickEnd = (d) => {
    if (!d || !onChangeEnd) return;
    const s = fmt(new Date(cur.y, cur.m, d));
    if (value && s >= value) onChangeEnd(s);
    else { onChange(s); onChangeEnd(''); }
  };

  const prevM = () => setCur((c) => c.m === 0 ? { y: c.y-1, m: 11 } : { y: c.y, m: c.m-1 });
  const nextM = () => setCur((c) => c.m === 11 ? { y: c.y+1, m: 0 } : { y: c.y, m: c.m+1 });

  const fmtDisplay = (isoStr) => { if (!isoStr) return ''; const [y, m, d] = isoStr.split('-'); return `${d}-${m}-${y}`; };
  const displayLabel = value
    ? (value2 ? `${fmtDisplay(value)}  →  ${fmtDisplay(value2)}` : fmtDisplay(value))
    : (label || 'Select date');

  return (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#fff', borderWidth: 1, borderColor: open ? C.gold : C.line,
          borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 }}>
        <Text style={{ color: value ? C.text : '#9AA7B4', fontSize: 15 }}>{displayLabel}</Text>
        <Text style={{ color: C.gold, fontSize: 16 }}>📅</Text>
      </TouchableOpacity>

      {open && (
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 12, marginTop: 4, padding: 10 }}>
          {/* Month nav */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <TouchableOpacity onPress={prevM} style={{ padding: 6 }}><Text style={{ fontSize: 18, color: C.navy }}>‹</Text></TouchableOpacity>
            <Text style={{ fontWeight: '700', color: C.navy, fontSize: 15 }}>{CAL_MONTHS[cur.m]} {cur.y}</Text>
            <TouchableOpacity onPress={nextM} style={{ padding: 6 }}><Text style={{ fontSize: 18, color: C.navy }}>›</Text></TouchableOpacity>
          </View>
          {/* Day headers */}
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {CAL_DAYS.map((d) => <Text key={d} style={{ flex: 1, textAlign: 'center', color: C.mute, fontSize: 12, fontWeight: '600' }}>{d}</Text>)}
          </View>
          {/* Cells */}
          {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row', marginBottom: 2 }}>
              {cells.slice(row*7, row*7+7).concat(Array(7)).slice(0,7).map((d, col) => {
                const sel = isSelected(d);
                const start = isStart(d);
                const end = isEnd(d);
                const isToday = d && new Date(cur.y, cur.m, d).toDateString() === today.toDateString();
                return (
                  <TouchableOpacity key={col} disabled={!d}
                    onPress={() => onChangeEnd ? (value && !value2 ? pickEnd(d) : pick(d)) : pick(d)}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 6,
                      backgroundColor: sel ? (start || end ? C.navy : C.goldSoft) : 'transparent',
                      borderRadius: (start || end || !onChangeEnd) ? 8 : 0 }}>
                    <Text style={{ fontSize: 13, fontWeight: isToday ? '800' : '400',
                      color: (start || end) ? '#fff' : sel ? C.navy : d ? C.text : 'transparent' }}>{d || ''}</Text>
                    {isToday && !sel && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.gold, marginTop: 1 }} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          {/* Clear */}
          {(value || value2) && (
            <TouchableOpacity onPress={() => { onChange(''); if (onChangeEnd) onChangeEnd(''); }}
              style={{ marginTop: 6, alignItems: 'center' }}>
              <Text style={{ color: C.red, fontWeight: '600', fontSize: 13 }}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export const s = StyleSheet.create({
  btn: { backgroundColor: C.navy, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginVertical: 6 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.navy },
  btnT: { color: '#fff', fontWeight: '700', fontSize: 15 },
  label: { color: C.mute, fontSize: 13, marginBottom: 5, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: C.text },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  header: { backgroundColor: C.navy, paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center' },
  hTitle: { color: '#fff', fontSize: 19, fontWeight: '700' },
});
