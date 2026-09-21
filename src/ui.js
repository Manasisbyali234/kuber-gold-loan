import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
export const C = { navy: '#12263A', navy2: '#1C3A57', gold: '#B8912F', goldSoft: '#F6EFD9', bg: '#F3F5F8', text: '#1B2733', mute: '#6B7A8A', red: '#B93A2E', green: '#1E8A58', line: '#E1E6EC', white: '#fff' };
export const Btn = ({ title, onPress, kind, style }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.8}
    style={[s.btn, kind === 'ghost' && s.ghost, kind === 'danger' && { backgroundColor: C.red }, style]}>
    <Text style={[s.btnT, kind === 'ghost' && { color: C.navy }]}>{title}</Text>
  </TouchableOpacity>
);
export const Field = ({ label, ...p }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={s.label}>{label}</Text>
    <TextInput placeholderTextColor="#9AA7B4" {...p} style={[s.input, p.multiline && { height: 90, textAlignVertical: 'top' }]} />
  </View>
);
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
