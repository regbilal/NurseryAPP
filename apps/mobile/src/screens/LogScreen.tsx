import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api, enqueueCare, flushQueue } from '../api';
import { colors } from '../theme';
import { AllergyBanner, AppHeader, Card, CareTile, Chip, MealLogCard, Muted, Screen, SectionLabel, Title } from '../ui';

type MealAmount = 'All' | 'Most' | 'Some' | 'None';
type MealSlot = 'Breakfast' | 'Lunch' | 'Snack';

const MEAL_AMOUNTS: MealAmount[] = ['All', 'Most', 'Some', 'None'];
const MEAL_SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Snack'];

function localDateParam(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sortEventsNewest(events: any[]) {
  return [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function mergeCareEvent(events: any[], created: any) {
  const merged = [created, ...events.filter((e) => e.id !== created.id)];
  return sortEventsNewest(merged);
}

function defaultMealPrefs(): Record<MealSlot, MealAmount> {
  return { Breakfast: 'All', Lunch: 'All', Snack: 'All' };
}

function mealPrefsFromEvents(events: any[]): Record<MealSlot, MealAmount> {
  const prefs = defaultMealPrefs();
  for (const slot of MEAL_SLOTS) {
    const latest = events.find((e) => e.type === 'Meal' && e.subtype === slot);
    if (latest?.amount && MEAL_AMOUNTS.includes(latest.amount as MealAmount)) {
      prefs[slot] = latest.amount as MealAmount;
    }
  }
  return prefs;
}

function isLoggedToday(events: any[], type: string, subtype: string) {
  return events.some((e) => e.type === type && e.subtype === subtype);
}

export function LogScreen() {
  const { t } = useTranslation();
  const [children, setChildren] = useState<any[]>([]);
  const [childId, setChildId] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [mealPrefsByChild, setMealPrefsByChild] = useState<Record<string, Record<MealSlot, MealAmount>>>({});

  const amountLabels = useMemo(
    () => ({
      All: t('all'),
      Most: t('most'),
      Some: t('some'),
      None: t('none'),
    }),
    [t],
  );

  const currentMealPrefs = useMemo(() => {
    const fromEvents = mealPrefsFromEvents(todayEvents);
    const saved = childId ? mealPrefsByChild[childId] : undefined;
    return { ...fromEvents, ...saved };
  }, [todayEvents, mealPrefsByChild, childId]);

  const loadChildren = useCallback(async () => {
    setLoadingChildren(true);
    try {
      const list = await api('/api/children');
      setChildren(list);
      setChildId((prev) => prev ?? list[0]?.id ?? null);
      setOffline(false);
    } catch (e: any) {
      setOffline(true);
      setStatus({ kind: 'err', text: e.message ?? t('offline') });
    } finally {
      setLoadingChildren(false);
    }
  }, [t]);

  const loadToday = useCallback(async () => {
    if (!childId) {
      setTodayEvents([]);
      return;
    }
    const dayKey = localDateParam();
    try {
      const day = await api(`/api/children/${childId}/care?day=${dayKey}`);
      setTodayEvents(sortEventsNewest(day.events ?? []));
    } catch (e: any) {
      setStatus({ kind: 'err', text: e.message ?? t('noData') });
    }
  }, [childId, t]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const log = async (type: string, subtype: string, amount?: string) => {
    if (!childId) {
      setStatus({ kind: 'err', text: t('noData') });
      return;
    }
    setSaving(true);
    setStatus(null);
    const payload = { type, subtype, amount, at: new Date().toISOString(), clientId: `${Date.now()}-${Math.random()}` };
    try {
      const created = await api(`/api/children/${childId}/care`, { method: 'POST', body: JSON.stringify(payload) });
      setTodayEvents((prev) => mergeCareEvent(prev, created));
      await flushQueue();
      setOffline(false);
      setStatus({ kind: 'ok', text: t('save') });
      await loadToday();
    } catch (e: any) {
      const msg = e?.message ?? '';
      const network = e instanceof TypeError || /failed to fetch|network/i.test(msg);
      if (network) {
        await enqueueCare(childId, payload);
        setOffline(true);
        const optimistic = {
          id: payload.clientId,
          at: payload.at,
          type: payload.type,
          subtype: payload.subtype,
          amount: payload.amount,
          pendingSync: true,
        };
        setTodayEvents((prev) => mergeCareEvent(prev, optimistic));
        setStatus({ kind: 'err', text: t('offline') });
      } else {
        setStatus({ kind: 'err', text: msg || t('noData') });
      }
    } finally {
      setSaving(false);
    }
  };

  const pickMealAmount = (slot: MealSlot, amount: MealAmount) => {
    if (!childId || saving) return;
    setMealPrefsByChild((prev) => ({
      ...prev,
      [childId]: { ...(prev[childId] ?? mealPrefsFromEvents(todayEvents)), [slot]: amount },
    }));
    void log('Meal', slot, amount);
  };

  const child = children.find((c) => c.id === childId);
  const allergyText = child?.allergies?.length
    ? `${t('allergies')}: ${child.allergies.map((a: any) => `${a.name} (${a.severity})`).join(', ')}`
    : null;
  const tilesDisabled = saving || !childId;

  return (
    <Screen>
      <AppHeader title={t('log')} subtitle={t('tagline')} />
      <Title>{t('log')}</Title>

      {loadingChildren ? <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} /> : null}

      {status ? (
        <View
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 12,
            backgroundColor: status.kind === 'ok' ? colors.sageSoft : colors.dangerSoft,
            borderWidth: 1,
            borderColor: status.kind === 'ok' ? colors.sageBorder : colors.dangerBorder,
          }}
        >
          <Text style={{ fontWeight: '700', color: status.kind === 'ok' ? colors.sage : colors.danger }}>{status.text}</Text>
        </View>
      ) : null}

      {offline ? (
        <View
          style={{
            backgroundColor: colors.primarySoft,
            borderColor: colors.primaryBorder,
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 8,
            alignSelf: 'flex-start',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400E' }}>{t('offline')}</Text>
        </View>
      ) : null}

      {children.length === 0 && !loadingChildren ? (
        <Card>
          <Muted>{t('noData')}</Muted>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {children.map((c) => (
          <Chip key={c.id} label={c.firstName} selected={c.id === childId} variant="nav" onPress={() => setChildId(c.id)} />
        ))}
      </View>

      {allergyText ? <AllergyBanner text={allergyText} /> : null}

      <Card>
        <SectionLabel>{t('meals')}</SectionLabel>
        <Muted>{t('mealAmount')}</Muted>
        {MEAL_SLOTS.map((slot) => (
          <MealLogCard
            key={slot}
            title={t(slot.toLowerCase())}
            selectedAmount={currentMealPrefs[slot]}
            amounts={MEAL_AMOUNTS}
            amountLabels={amountLabels}
            disabled={tilesDisabled}
            onSelectAmount={(amount) => pickMealAmount(slot, amount as MealAmount)}
          />
        ))}
      </Card>

      <Card>
        <SectionLabel>{t('sleep')}</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <CareTile
            label={t('nap')}
            sublabel="30min"
            tone="nap"
            disabled={tilesDisabled}
            checked={isLoggedToday(todayEvents, 'Nap', 'Nap')}
            onPress={() => void log('Nap', 'Nap', '30min')}
          />
        </View>
      </Card>

      <Card>
        <SectionLabel>{t('diapers')}</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {['Wet', 'Soiled', 'Dry'].map((d) => (
            <CareTile
              key={d}
              label={t(d.toLowerCase())}
              tone="diaper"
              disabled={tilesDisabled}
              checked={isLoggedToday(todayEvents, 'Diaper', d)}
              onPress={() => void log('Diaper', d)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionLabel>{t('mood')}</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {['Happy', 'Calm', 'Sad', 'Tired', 'Upset'].map((m) => (
            <CareTile
              key={m}
              label={t(m.toLowerCase())}
              tone="mood"
              disabled={tilesDisabled}
              checked={isLoggedToday(todayEvents, 'Mood', m)}
              onPress={() => void log('Mood', m)}
            />
          ))}
        </View>
      </Card>
    </Screen>
  );
}

