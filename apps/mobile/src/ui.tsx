import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  RefreshControlProps,
} from 'react-native';
import { colors, radius, shadow, space } from './theme';

export function Screen({
  children,
  refreshControl,
}: {
  children: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function BrandIcon({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.brandIcon, { width: size, height: size, borderRadius: size * 0.4 }]}>
      <Text style={[styles.brandStar, { fontSize: size * 0.45 }]}>★</Text>
    </View>
  );
}

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.appHeader}>
      <BrandIcon size={40} />
      <View style={styles.appHeaderText}>
        <Text style={styles.appHeaderTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.appHeaderSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function LoginCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.loginCard}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function AllergyBanner({ text }: { text: string }) {
  return (
    <View style={styles.allergyBanner}>
      <Text style={styles.allergyTitle}>⚠ {text}</Text>
    </View>
  );
}

export function StatCard({
  label,
  value,
  hint,
  valueColor = colors.inkLight,
}: {
  label: string;
  value: string;
  hint?: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  color = colors.primary,
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, { backgroundColor: color }, pressed && styles.btnPressed]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}>
      <Text style={styles.btnSecondaryText}>{label}</Text>
    </Pressable>
  );
}

export function EditAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <InlineAction label={label} onPress={onPress} variant="edit" />;
}

export function RowActions({ children }: { children: React.ReactNode }) {
  return <View style={styles.rowActions}>{children}</View>;
}

export function InlineAction({
  label,
  onPress,
  variant = 'edit',
}: {
  label: string;
  onPress: () => void;
  variant?: 'edit' | 'delete';
}) {
  const isDelete = variant === 'delete';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.inlineAction,
        isDelete && styles.inlineActionDelete,
        pressed && styles.inlineActionPressed,
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
      ]}
    >
      <Text style={[styles.inlineActionText, isDelete && styles.inlineActionTextDelete]}>{label}</Text>
    </Pressable>
  );
}

export function TextLinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.textLinkBtn,
        pressed && { opacity: 0.7 },
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
      ]}
    >
      <Text style={styles.textLinkBtnText}>{label}</Text>
    </Pressable>
  );
}

export function AddAction({
  label,
  onPress,
  mode = 'add',
}: {
  label: string;
  onPress: () => void;
  mode?: 'add' | 'cancel';
}) {
  const isAdd = mode === 'add';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        isAdd ? styles.addAction : styles.editAction,
        pressed && (isAdd ? styles.addActionPressed : styles.editActionPressed),
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
      ]}
    >
      <Text style={isAdd ? styles.addActionText : styles.editActionText}>
        {isAdd ? `+ ${label}` : label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  variant = 'nav',
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  variant?: 'nav' | 'soft';
}) {
  const isNav = variant === 'nav';
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        isNav && !selected && styles.chipNavOff,
        isNav && selected && styles.chipNavOn,
        !isNav && !selected && styles.chipSoftOff,
        !isNav && selected && styles.chipSoftOn,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          isNav && selected && styles.chipTextOn,
          !isNav && selected && styles.chipSoftTextOn,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CareTile({
  label,
  sublabel,
  onPress,
  tone,
  disabled,
  checked,
}: {
  label: string;
  sublabel?: string;
  onPress: () => void;
  tone: keyof typeof colors.care;
  disabled?: boolean;
  checked?: boolean;
}) {
  const t = colors.care[tone];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.careTile,
        { backgroundColor: t.bg, borderColor: t.border },
        checked && styles.careTileChecked,
        disabled && styles.careTileDisabled,
        pressed && !disabled && styles.careTilePressed,
        Platform.OS === 'web' && !disabled ? ({ cursor: 'pointer' } as object) : null,
      ]}
    >
      {checked ? (
        <View style={styles.careTileCheck}>
          <Text style={styles.careTileCheckText}>✓</Text>
        </View>
      ) : null}
      <Text style={[styles.careTileLabel, { color: t.text }]}>{label}</Text>
      {sublabel ? <Text style={[styles.careTileSub, { color: t.text }]}>{sublabel}</Text> : null}
    </Pressable>
  );
}

export function MealLogCard({
  title,
  selectedAmount,
  amountLabels,
  amounts,
  disabled,
  onSelectAmount,
}: {
  title: string;
  selectedAmount: string;
  amountLabels: Record<string, string>;
  amounts: readonly string[];
  disabled?: boolean;
  onSelectAmount: (amount: string) => void;
}) {
  const t = colors.care.meal;
  return (
    <View style={[styles.mealCard, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[styles.mealCardTitle, { color: t.text }]}>{title}</Text>
      <View style={styles.mealCardChips}>
        {amounts.map((amt) => (
          <Pressable
            key={amt}
            disabled={disabled}
            onPress={() => onSelectAmount(amt)}
            style={({ pressed }) => [
              styles.mealAmountChip,
              selectedAmount === amt && styles.mealAmountChipOn,
              disabled && styles.careTileDisabled,
              pressed && !disabled && styles.btnPressed,
              Platform.OS === 'web' && !disabled ? ({ cursor: 'pointer' } as object) : null,
            ]}
          >
            <Text style={[styles.mealAmountChipText, selectedAmount === amt && styles.mealAmountChipTextOn]}>
              {amountLabels[amt] ?? amt}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Field({
  value,
  onChangeText,
  placeholder,
  secure,
  mono,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  mono?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedLight}
      secureTextEntry={secure}
      autoCapitalize="none"
      style={[styles.input, mono && styles.inputMono]}
    />
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: space.md, paddingTop: space.lg, paddingBottom: space.xl },
  brandIcon: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandStar: { color: colors.primary, fontWeight: '900' },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: space.md,
    ...shadow.card,
  },
  appHeaderText: { flex: 1, minWidth: 0 },
  appHeaderTitle: { fontSize: 14, fontWeight: '800', color: colors.inkLight },
  appHeaderSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space.md,
    ...shadow.card,
  },
  loginCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginVertical: space.md,
    ...shadow.lifted,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.inkLight, marginBottom: 6 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  allergyBanner: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 2,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: space.md,
  },
  allergyTitle: { color: '#9F1239', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  statCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: space.sm,
    ...shadow.card,
  },
  statLabel: { fontSize: 11, fontWeight: '500', color: colors.muted },
  statValue: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  statHint: { fontSize: 10, fontWeight: '600', color: colors.mutedLight, marginTop: 4 },
  btn: { borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnSecondary: {
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: colors.dark,
  },
  btnPressed: { opacity: 0.88 },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  btnSecondaryText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  chip: {
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  chipNavOff: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipNavOn: {
    backgroundColor: colors.dark,
  },
  chipSoftOff: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipSoftOn: {
    backgroundColor: colors.primary,
  },
  chipText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  chipTextOn: { color: colors.white },
  chipSoftTextOn: { color: colors.white, fontWeight: '800' },
  editAction: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    marginLeft: 8,
    flexShrink: 0,
  },
  editActionPressed: { backgroundColor: colors.surfaceMuted },
  editActionText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark, letterSpacing: 0.2 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: space.sm },
  inlineAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  inlineActionDelete: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
  },
  inlineActionPressed: { opacity: 0.85 },
  inlineActionText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  inlineActionTextDelete: { color: colors.danger },
  textLinkBtn: { alignSelf: 'center', paddingVertical: 10, marginTop: 4 },
  textLinkBtnText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  addAction: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginBottom: space.sm,
    ...shadow.card,
  },
  addActionPressed: { backgroundColor: colors.primaryDark },
  addActionText: { fontSize: 13, fontWeight: '800', color: colors.white, letterSpacing: 0.15 },
  careTile: {
    minWidth: '30%',
    flexGrow: 1,
    minHeight: 68,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 12,
    marginRight: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  careTileLabel: { fontWeight: '800', fontSize: 12, textAlign: 'center' },
  careTileSub: { fontSize: 10, marginTop: 4, opacity: 0.85, textAlign: 'center' },
  careTileDisabled: { opacity: 0.45 },
  careTilePressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  careTileChecked: { borderWidth: 2, borderColor: colors.sage },
  careTileCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  careTileCheckText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  mealCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  mealCardTitle: { fontWeight: '800', fontSize: 14, marginBottom: 10 },
  mealCardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealAmountChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    marginRight: 6,
    marginBottom: 6,
  },
  mealAmountChipOn: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  mealAmountChipText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  mealAmountChipTextOn: { color: colors.white },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 14,
  },
  inputMono: { fontFamily: 'monospace', fontSize: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.ink, marginBottom: 6 },
});
