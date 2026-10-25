import React, { useEffect, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api, openWeeklySummaryDocument } from '../api';
import { colors } from '../theme';
import { AllergyBanner, AppHeader, Card, Chip, Muted, PrimaryButton, Screen, SectionLabel, Title } from '../ui';
import { useAuth } from '../auth';
import { localizeCareLine } from '../localizeEntity';

type CareEventRow = { id: string; type: string; subtype?: string; amount?: string; notes?: string; at: string };

/** One row per subtype (e.g. Breakfast) — keeps the most recent log for that day. */
function latestCareBySubtype(events: CareEventRow[], type: string): CareEventRow[] {
  const latest = new Map<string, CareEventRow>();
  for (const e of events) {
    if (e.type !== type) continue;
    const key = (e.subtype ?? '').trim() || type;
    const prev = latest.get(key);
    if (!prev || new Date(e.at).getTime() > new Date(prev.at).getTime()) latest.set(key, e);
  }
  return [...latest.values()].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

function latestAttendance(records: { type: string; at: string }[], type: string) {
  return records
    .filter((a) => a.type === type)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
}

export function TodayScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [children, setChildren] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [child, setChild] = useState<any>(null);
  const [care, setCare] = useState<any>({ events: [], attendance: [] });
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const loadChildDay = async (c: { id: string; firstName: string; lastName: string }) => {
    setChild(c);
    const d = new Date();
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = await api(`/api/children/${c.id}/care?day=${dayKey}`);
    setCare(day);
    const s = await api(`/api/children/${c.id}/weekly-summary?lang=${i18n.language}`);
    setSummary(s.summary);
  };

  const load = async () => {
    setLoading(true);
    try {
      const list = await api<{ id: string; firstName: string; lastName: string }[]>('/api/children');
      setChildren(list);
      if (!list.length) {
        setChild(null);
        return;
      }
      const c = list.find((x) => x.id === selectedId) ?? list[0];
      setSelectedId(c.id);
      await loadChildDay(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [i18n.language]);

  const attendance = care.attendance ?? [];
  const check = latestAttendance(attendance, 'CheckIn');
  const out = latestAttendance(attendance, 'CheckOut');
  const allergyText = child?.allergies?.length
    ? `${t('allergies')}: ${child.allergies.map((a: any) => a.name).join(', ')}`
    : null;

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}>
      <AppHeader title={t('appName')} subtitle={user?.fullName} />
      <Title>{child ? `${child.firstName} ${child.lastName}` : t('today')}</Title>

      {children.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
          {children.map((c) => (
            <Chip
              key={c.id}
              label={`${c.firstName} ${c.lastName}`}
              selected={c.id === selectedId}
              variant="nav"
              onPress={() => {
                setSelectedId(c.id);
                void loadChildDay(c);
              }}
            />
          ))}
        </View>
      ) : null}

      {allergyText ? <AllergyBanner text={allergyText} /> : null}

      <Card>
        <SectionLabel>{t('attendance')}</SectionLabel>
        <Muted>{check ? `${t('arrived')} ${new Date(check.at).toLocaleTimeString()}` : t('noData')}</Muted>
        {out ? <Muted>{`${t('left')} ${new Date(out.at).toLocaleTimeString()}`}</Muted> : null}
      </Card>

      {['Meal', 'Nap', 'Diaper', 'Mood'].map((type) => (
        <Card key={type}>
          <SectionLabel>
            {t(type === 'Meal' ? 'meals' : type === 'Nap' ? 'sleep' : type === 'Diaper' ? 'diapers' : 'mood')}
          </SectionLabel>
          {latestCareBySubtype(care.events ?? [], type).map((e) => (
              <View
                key={`${e.type}-${e.subtype ?? ''}`}
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.line,
                  padding: 12,
                  marginTop: 8,
                }}
              >
                <Muted>
                  {new Date(e.at).toLocaleTimeString()} · {localizeCareLine(t, { subtype: e.subtype, amount: e.amount, notes: e.notes })}
                </Muted>
              </View>
            ))}
          {latestCareBySubtype(care.events ?? [], type).length === 0 ? <Muted>{t('noData')}</Muted> : null}
        </Card>
      ))}

      <Card>
        <SectionLabel>{t('weeklySummary')}</SectionLabel>
        <Muted>{summary}</Muted>
        {child ? (
          <PrimaryButton label={t('viewReport')} onPress={() => void openWeeklySummaryDocument(child.id, i18n.language)} />
        ) : null}
      </Card>
    </Screen>
  );
}
