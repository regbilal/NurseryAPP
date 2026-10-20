import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api, openWeeklySummaryDocument } from '../api';
import { colors, space } from '../theme';
import { Card, Muted, PrimaryButton, Title } from '../ui';
import { useAuth } from '../auth';

export function TodayScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [child, setChild] = useState<any>(null);
  const [care, setCare] = useState<any>({ events: [], attendance: [] });
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const children = await api('/api/children');
      const c = children[0];
      setChild(c);
      if (c) {
        const day = await api(`/api/children/${c.id}/care`);
        setCare(day);
        const s = await api(`/api/children/${c.id}/weekly-summary?lang=${i18n.language}`);
        setSummary(s.summary);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const check = care.attendance?.find((a: any) => a.type === 'CheckIn');
  const out = care.attendance?.find((a: any) => a.type === 'CheckOut');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.md, paddingTop: 56 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Muted>{user?.fullName}</Muted>
      <Title>
        {child ? `${child.firstName} ${child.lastName}` : t('today')}
      </Title>
      <Card>
        <Text style={{ fontWeight: '700', color: colors.ink }}>{t('attendance')}</Text>
        <Muted>
          {check ? `${t('arrived')} ${new Date(check.at).toLocaleTimeString()}` : t('noData')}
        </Muted>
        {out ? <Muted>{`${t('left')} ${new Date(out.at).toLocaleTimeString()}`}</Muted> : null}
        {child?.allergies?.length ? (
          <Text style={{ color: colors.danger, marginTop: 8, fontWeight: '700' }}>
            {t('allergies')}: {child.allergies.map((a: any) => a.name).join(', ')}
          </Text>
        ) : null}
      </Card>
      {['Meal', 'Nap', 'Diaper', 'Mood'].map((type) => (
        <Card key={type}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>
            {t(type === 'Meal' ? 'meals' : type === 'Nap' ? 'sleep' : type === 'Diaper' ? 'diapers' : 'mood')}
          </Text>
          {(care.events || [])
            .filter((e: any) => e.type === type)
            .map((e: any) => (
              <Muted key={e.id}>
                {new Date(e.at).toLocaleTimeString()} · {e.subtype} {e.amount ?? ''} {e.notes ?? ''}
              </Muted>
            ))}
        </Card>
      ))}
      <Card>
        <Text style={{ fontWeight: '700', color: colors.ink }}>{t('weeklySummary')}</Text>
        <Muted>{summary}</Muted>
        {child ? (
          <PrimaryButton
            label={t('viewReport')}
            onPress={() => void openWeeklySummaryDocument(child.id, i18n.language)}
          />
        ) : null}
      </Card>
    </ScrollView>
  );
}
