import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api, openPaymentReceipt } from '../api';
import { ChildHealthPanel } from '../components/ChildHealthPanel';
import { colors } from '../theme';
import { AppHeader, Card, Chip, Muted, PrimaryButton, Screen, SectionLabel, Title } from '../ui';

type ChildListItem = { id: string; firstName: string; lastName: string };

export function ChildScreen() {
  const { t, i18n } = useTranslation();
  const [children, setChildren] = useState<ChildListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [child, setChild] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  const loadDetail = useCallback(async (childId: string) => {
    const d = await api(`/api/children/${childId}`);
    setChild(d);
    setInvoices(await api(`/api/children/${childId}/invoices`));
  }, []);

  const load = useCallback(async () => {
    const list = await api<ChildListItem[]>('/api/children');
    setChildren(list);
    if (!list.length) {
      setSelectedId(null);
      setChild(null);
      setInvoices([]);
      return;
    }
    const id = selectedId && list.some((c) => c.id === selectedId) ? selectedId : list[0].id;
    setSelectedId(id);
    await loadDetail(id);
  }, [loadDetail, selectedId]);

  useEffect(() => {
    void load();
  }, []);

  const pickChild = async (childId: string) => {
    setSelectedId(childId);
    await loadDetail(childId);
  };

  const reloadCurrent = async () => {
    if (!selectedId) return;
    await loadDetail(selectedId);
  };

  if (!child) {
    return (
      <Screen>
        <Muted>{t('noData')}</Muted>
      </Screen>
    );
  }

  const childId = child.id as string;

  return (
    <Screen>
      <AppHeader title={`${child.firstName} ${child.lastName}`} subtitle={child.classroom} />
      {children.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
          {children.map((c) => (
            <Chip
              key={c.id}
              label={`${c.firstName} ${c.lastName}`}
              selected={c.id === selectedId}
              variant="nav"
              onPress={() => void pickChild(c.id)}
            />
          ))}
        </View>
      ) : null}
      <Title>{child.firstName} {child.lastName}</Title>
      <Muted>QR {child.qrCode}</Muted>

      <ChildHealthPanel childId={childId} child={child} canEdit onReload={reloadCurrent} />

      <Card>
        <SectionLabel>{t('invoices')}</SectionLabel>
        {invoices.length === 0 ? <Muted>{t('noData')}</Muted> : null}
        {invoices.map((i) => (
          <View key={i.id} style={{ marginTop: 8, padding: 12, backgroundColor: colors.surfaceMuted, borderRadius: 12, borderWidth: 1, borderColor: colors.line }}>
            <Text style={{ color: colors.ink, fontWeight: '700' }}>
              {i.period} · {i.amount} {i.currency} · {t(String(i.status).toLowerCase())}
            </Text>
            {i.status !== 'Paid' ? (
              <PrimaryButton
                label={t('pay')}
                color={colors.sage}
                onPress={async () => {
                  try {
                    await api(`/api/children/invoices/${i.id}/pay`, {
                      method: 'POST',
                      body: JSON.stringify({ lang: i18n.language }),
                    });
                    Alert.alert(t('invoices'), t('receiptGenerated'), [
                      { text: t('viewReceipt'), onPress: () => void openPaymentReceipt(i.id, i18n.language) },
                      { text: 'OK' },
                    ]);
                    await reloadCurrent();
                  } catch (e: any) {
                    Alert.alert(t('invoices'), e.message);
                  }
                }}
              />
            ) : (
              <PrimaryButton label={t('viewReceipt')} onPress={async () => {
                try {
                  await openPaymentReceipt(i.id, i18n.language);
                } catch (e: any) {
                  Alert.alert(t('invoices'), e.message);
                }
              }} />
            )}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
