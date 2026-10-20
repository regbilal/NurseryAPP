import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAuth } from '../auth';
import { setAppLanguage } from '../i18n';
import { colors, space } from '../theme';
import { Card, Chip, Field, Muted, PrimaryButton, Title } from '../ui';

export function MoreScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout, setLanguage } = useAuth();
  const [ann, setAnn] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [incident, setIncident] = useState({ title: '', details: '' });
  const [children, setChildren] = useState<any[]>([]);

  const load = async () => {
    setAnn(await api('/api/announcements'));
    setEvents(await api('/api/events'));
    setReminders(await api('/api/reminders'));
    setActivities(await api('/api/activities'));
    setIncidents(await api('/api/incidents'));
    setChildren(await api('/api/children'));
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.md, paddingTop: 56 }}>
      <Title>{t('more')}</Title>
      <Muted>{t('language')}</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
        {['en', 'fr', 'ar'].map((code) => (
          <Chip
            key={code}
            label={code.toUpperCase()}
            selected={i18n.language === code}
            onPress={() => {
              void setAppLanguage(code);
              void setLanguage(code);
            }}
          />
        ))}
      </View>
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('notifications')}</Text>
        {reminders.map((r) => (
          <Muted key={r.id}>
            {r.kind}: {r.title}
          </Muted>
        ))}
      </Card>
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('announcements')}</Text>
        {ann.map((a) => (
          <View key={a.id} style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: '600' }}>{a.title}</Text>
            <Muted>{a.body}</Muted>
          </View>
        ))}
      </Card>
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('events')}</Text>
        {events.map((e) => (
          <Muted key={e.id}>
            {e.title} · {new Date(e.startsAt).toLocaleString()}
          </Muted>
        ))}
      </Card>
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('activities')}</Text>
        {activities.map((a) => (
          <Muted key={a.id}>
            {t('theme')}: {a.theme}
          </Muted>
        ))}
        {user?.role !== 'Parent' ? (
          <>
            <Field value={notes} onChangeText={setNotes} placeholder={t('details')} />
            <PrimaryButton
              label={t('save')}
              onPress={async () => {
                if (!children[0]) return;
                await api(`/api/children/${children[0].id}/notes`, { method: 'POST', body: JSON.stringify({ body: notes }) });
                setNotes('');
                Alert.alert(t('activities'), t('save'));
              }}
            />
          </>
        ) : null}
      </Card>
      <Card>
        <Text style={{ fontWeight: '700' }}>{t('incidents')}</Text>
        {incidents.map((i) => (
          <Muted key={i.id}>
            {i.child}: {i.title}
          </Muted>
        ))}
        {user?.role !== 'Parent' ? (
          <>
            <Field value={incident.title} onChangeText={(title) => setIncident({ ...incident, title })} placeholder={t('title')} />
            <Field value={incident.details} onChangeText={(details) => setIncident({ ...incident, details })} placeholder={t('details')} />
            <PrimaryButton
              label={t('reportIncident')}
              color={colors.danger}
              onPress={async () => {
                if (!children[0]) return;
                await api('/api/incidents', {
                  method: 'POST',
                  body: JSON.stringify({ childId: children[0].id, ...incident }),
                });
                setIncident({ title: '', details: '' });
                await load();
              }}
            />
          </>
        ) : null}
      </Card>
      <PrimaryButton label={t('signOut')} onPress={logout} />
    </ScrollView>
  );
}
