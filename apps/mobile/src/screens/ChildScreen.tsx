import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { colors, space } from '../theme';
import { Card, Field, Muted, PrimaryButton, Title } from '../ui';

export function ChildScreen() {
  const { t } = useTranslation();
  const [child, setChild] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [form, setForm] = useState({ fullName: '', relation: '', phone: '' });

  const load = async () => {
    const list = await api('/api/children');
    if (!list[0]) return;
    const d = await api(`/api/children/${list[0].id}`);
    setChild(d);
    setInvoices(await api(`/api/children/${list[0].id}/invoices`));
  };

  useEffect(() => {
    void load();
  }, []);

  if (!child) {
    return (
      <View style={{ padding: 24 }}>
        <Muted>{t('noData')}</Muted>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.md, paddingTop: 56 }}>
      <Title>
        {child.firstName} {child.lastName}
      </Title>
      <Muted>
        QR {child.qrCode} · {child.classroom}
      </Muted>
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('health')}</Text>
        <Muted>
          {t('allergies')}: {child.allergies?.map((a: any) => a.name).join(', ') || '—'}
        </Muted>
        {child.vaccines?.map((v: any) => (
          <Muted key={v.id}>
            {v.name} {v.administeredOn ?? v.dueOn}
          </Muted>
        ))}
        {child.medications?.map((m: any) => (
          <Muted key={m.id}>
            {m.name} · {m.dosage} · {m.schedule}
          </Muted>
        ))}
      </Card>
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('pickup')}</Text>
        {child.pickups?.map((p: any) => (
          <Muted key={p.id}>
            {p.fullName} ({p.relation}) · {t('pin')} {p.pin}
          </Muted>
        ))}
        <Field value={form.fullName} onChangeText={(fullName) => setForm({ ...form, fullName })} placeholder={t('fullName')} />
        <Field value={form.relation} onChangeText={(relation) => setForm({ ...form, relation })} placeholder={t('relation')} />
        <Field value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} placeholder={t('phone')} />
        <PrimaryButton
          label={t('addPickup')}
          onPress={async () => {
            await api(`/api/children/${child.id}/pickups`, { method: 'POST', body: JSON.stringify(form) });
            setForm({ fullName: '', relation: '', phone: '' });
            await load();
          }}
        />
      </Card>
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('invoices')}</Text>
        {invoices.map((i) => (
          <View key={i.id} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.ink }}>
              {i.period} · {i.amount} {i.currency} · {t(String(i.status).toLowerCase())}
            </Text>
            {i.status !== 'Paid' ? (
              <PrimaryButton
                label={t('pay')}
                color={colors.sage}
                onPress={async () => {
                  await api(`/api/children/invoices/${i.id}/pay`, { method: 'POST' });
                  Alert.alert(t('invoices'), t('paid'));
                  await load();
                }}
              />
            ) : null}
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
