import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api, enqueueCare, flushQueue } from '../api';
import { colors, space } from '../theme';
import { Card, Chip, Muted, PrimaryButton, Title } from '../ui';

export function LogScreen() {
  const { t } = useTranslation();
  const [children, setChildren] = useState<any[]>([]);
  const [childId, setChildId] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api('/api/children')
      .then((list) => {
        setChildren(list);
        setChildId(list[0]?.id);
      })
      .catch(() => setOffline(true));
  }, []);

  const log = async (type: string, subtype: string, amount?: string) => {
    if (!childId) return;
    const payload = { type, subtype, amount, at: new Date().toISOString(), clientId: `${Date.now()}-${Math.random()}` };
    try {
      await api(`/api/children/${childId}/care`, { method: 'POST', body: JSON.stringify(payload) });
      await flushQueue();
      setOffline(false);
      Alert.alert(t('log'), t('save'));
    } catch {
      await enqueueCare(childId, payload);
      setOffline(true);
      Alert.alert(t('log'), t('offline'));
    }
  };

  const child = children.find((c) => c.id === childId);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.md, paddingTop: 56 }}>
      <Title>{t('log')}</Title>
      {offline ? <Muted>{t('offline')}</Muted> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {children.map((c) => (
          <Chip key={c.id} label={c.firstName} selected={c.id === childId} onPress={() => setChildId(c.id)} />
        ))}
      </View>
      {child?.allergies?.length ? (
        <Card>
          <Text style={{ color: colors.danger, fontWeight: '800' }}>
            {t('allergies')}: {child.allergies.map((a: any) => `${a.name} (${a.severity})`).join(', ')}
          </Text>
        </Card>
      ) : null}
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('meals')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {['Breakfast', 'Lunch', 'Snack'].map((m) => (
            <Chip key={m} label={t(m.toLowerCase())} onPress={() => log('Meal', m, 'All')} />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('sleep')}</Text>
        <PrimaryButton label={t('nap')} color={colors.sage} onPress={() => log('Nap', 'Nap', '30min')} />
      </Card>
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('diapers')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {['Wet', 'Soiled', 'Dry'].map((d) => (
            <Chip key={d} label={t(d.toLowerCase())} onPress={() => log('Diaper', d)} />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('mood')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {['Happy', 'Calm', 'Sad', 'Tired', 'Upset'].map((m) => (
            <Chip key={m} label={t(m.toLowerCase())} onPress={() => log('Mood', m)} />
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
