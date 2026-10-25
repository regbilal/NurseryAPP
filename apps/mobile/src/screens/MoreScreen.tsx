import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAuth } from '../auth';
import { setAppLanguage } from '../i18n';
import { colors, space } from '../theme';
import { FeedDetailItem, formatActivityPlan } from '../components/FeedDetailItem';
import { AddAction, AppHeader, Card, Chip, EditAction, Field, Muted, PrimaryButton, Screen, SectionLabel, Title } from '../ui';

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
  const [classrooms, setClassrooms] = useState<any[]>([]);

  const [showAnnForm, setShowAnnForm] = useState(false);
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [annForm, setAnnForm] = useState({ title: '', body: '' });

  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({ title: '', startsAt: '', endsAt: '', location: '' });

  const [showActivityForm, setShowActivityForm] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState({ classroomId: '', weekStart: '', theme: '', planJson: '{}' });

  const isAdmin = user?.role === 'Admin';
  const isStaff = user?.role === 'Educator' || isAdmin;
  const isParent = user?.role === 'Parent';
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const parentClassroomIds = isParent
    ? [...new Set(children.map((c) => c.classroomId).filter(Boolean))]
    : [];
  const visibleActivities = isParent
    ? activities.filter((a) => parentClassroomIds.includes(a.classroomId))
    : activities;

  const load = async () => {
    setAnn(await api('/api/announcements'));
    setEvents(await api('/api/events'));
    setReminders(await api('/api/reminders'));
    setActivities(await api('/api/activities'));
    setIncidents(await api('/api/incidents'));
    setChildren(await api('/api/children'));
    if (isStaff) {
      try {
        setClassrooms(await api('/api/classrooms'));
      } catch {
        setClassrooms([]);
      }
    }
  };

  useEffect(() => {
    void load();
  }, [i18n.language]);

  const saveAnnouncement = async () => {
    const body = { title: annForm.title.trim(), body: annForm.body.trim() };
    if (editingAnnId) {
      await api(`/api/announcements/${editingAnnId}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      await api('/api/announcements', { method: 'POST', body: JSON.stringify(body) });
    }
    setShowAnnForm(false);
    setEditingAnnId(null);
    setAnnForm({ title: '', body: '' });
    await load();
  };

  const saveEvent = async () => {
    const body = {
      title: eventForm.title.trim(),
      startsAt: new Date(eventForm.startsAt).toISOString(),
      endsAt: new Date(eventForm.endsAt).toISOString(),
      location: eventForm.location.trim() || null,
    };
    if (editingEventId) {
      await api(`/api/events/${editingEventId}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      await api('/api/events', { method: 'POST', body: JSON.stringify(body) });
    }
    setShowEventForm(false);
    setEditingEventId(null);
    setEventForm({ title: '', startsAt: '', endsAt: '', location: '' });
    await load();
  };

  const saveActivity = async () => {
    const body = {
      classroomId: activityForm.classroomId,
      weekStart: activityForm.weekStart.trim(),
      theme: activityForm.theme.trim(),
      planJson: activityForm.planJson.trim() || '{}',
    };
    if (editingActivityId) {
      await api(`/api/activities/${editingActivityId}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      await api('/api/activities', { method: 'POST', body: JSON.stringify(body) });
    }
    setShowActivityForm(false);
    setEditingActivityId(null);
    setActivityForm({ classroomId: classrooms[0]?.id ?? '', weekStart: '', theme: '', planJson: '{}' });
    await load();
  };

  return (
    <Screen>
      <AppHeader title={t('more')} subtitle={user?.fullName} />
      <Title>{t('more')}</Title>

      <SectionLabel>{t('language')}</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {['en', 'fr', 'ar'].map((code) => (
          <Chip
            key={code}
            label={code.toUpperCase()}
            selected={i18n.language === code}
            variant="nav"
            onPress={() => {
              void setAppLanguage(code);
              void setLanguage(code);
            }}
          />
        ))}
      </View>

      <Card>
        <SectionLabel>{t('notifications')}</SectionLabel>
        {reminders.map((r) => (
          <View key={r.id} style={{ padding: 8, backgroundColor: colors.surfaceMuted, borderRadius: 8, marginBottom: 6 }}>
            <Muted>{r.kind}: {r.title}</Muted>
          </View>
        ))}
      </Card>

      <Card>
        <SectionLabel>{t('announcements')}</SectionLabel>
        {isAdmin ? (
          <AddAction
            label={showAnnForm ? t('cancel') : t('addAnnouncement')}
            mode={showAnnForm ? 'cancel' : 'add'}
            onPress={() => {
              if (showAnnForm) {
                setShowAnnForm(false);
                setEditingAnnId(null);
                setAnnForm({ title: '', body: '' });
              } else {
                setEditingAnnId(null);
                setAnnForm({ title: '', body: '' });
                setShowAnnForm(true);
              }
            }}
          />
        ) : null}
        {showAnnForm && isAdmin ? (
          <View style={{ marginTop: space.sm }}>
            <Field value={annForm.title} onChangeText={(v) => setAnnForm({ ...annForm, title: v })} placeholder={t('title')} />
            <Field value={annForm.body} onChangeText={(v) => setAnnForm({ ...annForm, body: v })} placeholder={t('details')} />
            <PrimaryButton label={t('save')} onPress={() => void saveAnnouncement()} />
          </View>
        ) : null}
        {ann.length === 0 ? <Muted>{t('noData')}</Muted> : null}
        {ann.map((a) => (
          <FeedDetailItem
            key={a.id}
            title={a.title}
            meta={a.publishedAt ? new Date(a.publishedAt).toLocaleString() : undefined}
            detail={a.body ?? ''}
            expanded={!!expanded[`ann-${a.id}`]}
            onToggle={() => toggleExpanded(`ann-${a.id}`)}
            trailing={
              isAdmin ? (
                <EditAction
                  label={t('edit')}
                  onPress={() => {
                    setEditingAnnId(a.id);
                    setAnnForm({ title: a.title, body: a.body });
                    setShowAnnForm(true);
                  }}
                />
              ) : undefined
            }
          />
        ))}
      </Card>

      <Card>
        <SectionLabel>{t('events')}</SectionLabel>
        {isAdmin ? (
          <AddAction
            label={showEventForm ? t('cancel') : t('addEvent')}
            mode={showEventForm ? 'cancel' : 'add'}
            onPress={() => {
              if (showEventForm) {
                setShowEventForm(false);
                setEditingEventId(null);
                setEventForm({ title: '', startsAt: '', endsAt: '', location: '' });
              } else {
                setShowEventForm(true);
              }
            }}
          />
        ) : null}
        {showEventForm && isAdmin ? (
          <View style={{ marginTop: space.sm }}>
            <Field value={eventForm.title} onChangeText={(v) => setEventForm({ ...eventForm, title: v })} placeholder={t('title')} />
            <Field value={eventForm.startsAt} onChangeText={(v) => setEventForm({ ...eventForm, startsAt: v })} placeholder={t('eventStarts')} />
            <Field value={eventForm.endsAt} onChangeText={(v) => setEventForm({ ...eventForm, endsAt: v })} placeholder={t('eventEnds')} />
            <Field value={eventForm.location} onChangeText={(v) => setEventForm({ ...eventForm, location: v })} placeholder={t('location')} />
            <PrimaryButton label={t('save')} onPress={() => void saveEvent()} />
          </View>
        ) : null}
        {events.length === 0 ? <Muted>{t('noData')}</Muted> : null}
        {events.map((e) => {
          const when = `${new Date(e.startsAt).toLocaleString()} – ${new Date(e.endsAt).toLocaleString()}`;
          const detail = [when, e.location ? `${t('location')}: ${e.location}` : ''].filter(Boolean).join('\n');
          return (
            <FeedDetailItem
              key={e.id}
              title={e.title}
              meta={new Date(e.startsAt).toLocaleDateString()}
              detail={detail}
              expanded={!!expanded[`evt-${e.id}`]}
              onToggle={() => toggleExpanded(`evt-${e.id}`)}
              trailing={
                isAdmin ? (
                  <EditAction
                    label={t('edit')}
                    onPress={() => {
                      setEditingEventId(e.id);
                      setEventForm({
                        title: e.title,
                        startsAt: e.startsAt,
                        endsAt: e.endsAt,
                        location: e.location ?? '',
                      });
                      setShowEventForm(true);
                    }}
                  />
                ) : undefined
              }
            />
          );
        })}
      </Card>

      <Card>
        <SectionLabel>{t('activities')}</SectionLabel>
        {isStaff ? (
          <AddAction
            label={showActivityForm ? t('cancel') : t('addActivity')}
            mode={showActivityForm ? 'cancel' : 'add'}
            onPress={() => {
              if (showActivityForm) {
                setShowActivityForm(false);
                setEditingActivityId(null);
              } else {
                setEditingActivityId(null);
                setActivityForm({
                  classroomId: classrooms[0]?.id ?? children[0]?.classroomId ?? '',
                  weekStart: '',
                  theme: '',
                  planJson: '{}',
                });
                setShowActivityForm(true);
              }
            }}
          />
        ) : null}
        {showActivityForm && isStaff ? (
          <View style={{ marginTop: space.sm }}>
            <SectionLabel>{t('classroom')}</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {classrooms.map((r) => (
                <Chip
                  key={r.id}
                  label={r.name}
                  selected={activityForm.classroomId === r.id}
                  variant="nav"
                  onPress={() => setActivityForm({ ...activityForm, classroomId: r.id })}
                />
              ))}
            </View>
            <Field value={activityForm.weekStart} onChangeText={(v) => setActivityForm({ ...activityForm, weekStart: v })} placeholder={t('weekStart')} />
            <Field value={activityForm.theme} onChangeText={(v) => setActivityForm({ ...activityForm, theme: v })} placeholder={t('theme')} />
            <Field value={activityForm.planJson} onChangeText={(v) => setActivityForm({ ...activityForm, planJson: v })} placeholder={t('planJson')} />
            <PrimaryButton label={t('save')} onPress={() => void saveActivity()} />
          </View>
        ) : null}
        {visibleActivities.length === 0 ? <Muted>{t('noData')}</Muted> : null}
        {visibleActivities.map((a) => {
          const week =
            typeof a.weekStart === 'string' ? a.weekStart.slice(0, 10) : String(a.weekStart ?? '').slice(0, 10);
          const planText = formatActivityPlan(a.planJson);
          const detail = planText;
          return (
            <FeedDetailItem
              key={a.id}
              title={a.theme}
              meta={`${t('activityWeek')} ${week}`}
              detail={detail}
              expanded={!!expanded[`act-${a.id}`]}
              onToggle={() => toggleExpanded(`act-${a.id}`)}
              trailing={
                isStaff ? (
                  <EditAction
                    label={t('edit')}
                    onPress={() => {
                      setEditingActivityId(a.id);
                      setActivityForm({
                        classroomId: a.classroomId,
                        weekStart: week,
                        theme: a.theme,
                        planJson: a.planJson ?? '{}',
                      });
                      setShowActivityForm(true);
                    }}
                  />
                ) : undefined
              }
            />
          );
        })}
        {isStaff ? (
          <>
            <Field value={notes} onChangeText={setNotes} placeholder={t('staffNotes')} />
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
        <SectionLabel>{t('incidents')}</SectionLabel>
        {incidents.length === 0 ? <Muted>{t('noData')}</Muted> : null}
        {incidents.map((i) => (
          <FeedDetailItem
            key={i.id}
            title={`${i.child}: ${i.title}`}
            meta={i.at ? new Date(i.at).toLocaleString() : undefined}
            detail={i.details ?? ''}
            expanded={!!expanded[`inc-${i.id}`]}
            onToggle={() => toggleExpanded(`inc-${i.id}`)}
          />
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

      <PrimaryButton label={t('signOut')} color={colors.dark} onPress={logout} />
    </Screen>
  );
}
