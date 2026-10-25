import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAuth } from '../auth';
import { colors, space } from '../theme';
import { AppHeader, Card, Field, Muted, SecondaryButton, SectionLabel, Title } from '../ui';

type Conversation = {
  id: string;
  title: string;
  kind?: 'parent' | 'staff';
  childId?: string;
  childName?: string;
  staffName?: string;
  parentName?: string;
  staffRole?: string;
  otherStaffName?: string;
  otherStaffRole?: string;
  classroomName?: string;
  lastMessage?: string;
};

type ViewMode = 'list' | 'compose' | 'thread';

export function ChatScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isParent = user?.role === 'Parent';
  const isAdmin = user?.role === 'Admin';
  const isEducator = user?.role === 'Educator';

  const [view, setView] = useState<ViewMode>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');

  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<{ userId: string; fullName: string; role: string }[]>([]);
  const [parentRows, setParentRows] = useState<
    { childId: string; childName: string; parentId: string; parentName: string }[]
  >([]);
  const [teacherRows, setTeacherRows] = useState<
    { userId: string; fullName: string; role: string; classroomName?: string }[]
  >([]);
  const [directorRows, setDirectorRows] = useState<{ userId: string; fullName: string; role: string }[]>([]);

  const loadConversations = useCallback(async () => {
    const list = await api('/api/conversations');
    setConversations(list);
  }, []);

  const openThread = async (c: Conversation) => {
    setConv(c);
    setMessages(await api(`/api/conversations/${c.id}/messages`));
    setView('thread');
  };

  const loadMessages = async () => {
    if (!conv) return;
    setMessages(await api(`/api/conversations/${conv.id}/messages`));
  };

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const startCompose = async () => {
    setView('compose');
    if (isParent) {
      const data = await api('/api/conversations/contacts');
      const kids = data.children ?? [];
      setChildren(kids);
      if (kids.length === 1) {
        const childId = kids[0].id;
        setSelectedChildId(childId);
        const staffData = await api(`/api/conversations/contacts?childId=${childId}`);
        setContacts(staffData.contacts ?? []);
      } else {
        setSelectedChildId(null);
        setContacts([]);
      }
    } else {
      const data = await api('/api/conversations/contacts');
      setParentRows(data.parents ?? []);
      setTeacherRows(data.teachers ?? []);
      setDirectorRows(data.directors ?? []);
    }
  };

  const pickChild = async (childId: string) => {
    setSelectedChildId(childId);
    const staffData = await api(`/api/conversations/contacts?childId=${childId}`);
    setContacts(staffData.contacts ?? []);
  };

  const startParentChat = async (staffUserId: string) => {
    if (!selectedChildId) return;
    const created = await api('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ childId: selectedChildId, staffUserId }),
    });
    await openConversationById(created.id);
  };

  const startStaffChat = async (childId: string, parentUserId: string) => {
    const created = await api('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ childId, parentUserId }),
    });
    await openConversationById(created.id);
  };

  const startStaffPeerChat = async (staffUserId: string) => {
    const created = await api('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ staffUserId }),
    });
    await openConversationById(created.id);
  };

  const send = async () => {
    if (!conv || !body.trim()) return;
    await api(`/api/conversations/${conv.id}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
    setBody('');
    await loadMessages();
    void loadConversations();
  };

  const childShort = (name?: string) => (name ? name.trim().split(/\s+/)[0] : '');

  const partnerDisplayName = (c: Conversation) => {
    if (isParent) return c.staffName ?? c.title;
    if (c.kind === 'staff') {
      if (isAdmin) return c.staffName ?? c.title;
      return c.otherStaffName ?? c.title;
    }
    return c.parentName ?? c.title;
  };

  const partnerRoleLine = (c: Conversation) => {
    if (c.kind === 'staff') {
      if (isAdmin) {
        return c.classroomName ? t('chatTeacherClassroom', { classroom: c.classroomName }) : t('educator');
      }
      return t('admin');
    }
    const child = childShort(c.childName);
    if (!child) return '';
    if (isParent) {
      if (c.staffRole === 'Admin') return t('chatDirectorOf', { child });
      if (c.staffRole === 'Educator') return t('chatTeacherOf', { child });
      return t('educator');
    }
    return t('chatParentOf', { child });
  };

  const contactRoleLine = (role: string, childName?: string) => {
    const child = childShort(childName);
    if (!child) return roleLabel(role);
    if (role === 'Admin') return t('chatDirectorOf', { child });
    if (role === 'Educator') return t('chatTeacherOf', { child });
    return roleLabel(role);
  };

  const roleLabel = (role: string) => {
    if (role === 'Admin') return t('admin');
    if (role === 'Educator') return t('educator');
    return role;
  };

  const openConversationById = async (id: string) => {
    const list = await api('/api/conversations');
    setConversations(list);
    const full = list.find((x: Conversation) => x.id === id);
    if (full) await openThread(full);
  };

  const listHeader = (
    <>
      <AppHeader title={t('chat')} subtitle={user?.fullName} />
      <Title>{t('chatSelect')}</Title>
      <SecondaryButton label={t('chatNew')} onPress={() => void startCompose()} />
    </>
  );

  if (view === 'list') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.md, paddingTop: space.lg }}>
        {listHeader}
        <ScrollView style={{ flex: 1, marginTop: space.sm }}>
          {conversations.length === 0 ? <Muted>{t('noData')}</Muted> : null}
          {conversations.map((c) => (
            <Pressable key={c.id} onPress={() => void openThread(c)}>
              <Card style={{ marginBottom: space.sm }}>
                <Text style={{ fontWeight: '700', color: colors.ink }}>{partnerDisplayName(c)}</Text>
                {partnerRoleLine(c) ? <Muted>{partnerRoleLine(c)}</Muted> : null}
                {c.lastMessage ? (
                  <Text style={{ color: colors.muted, marginTop: 4 }} numberOfLines={2}>{c.lastMessage}</Text>
                ) : null}
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (view === 'compose') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.md, paddingTop: space.lg }}>
        <AppHeader title={t('chatNew')} subtitle={user?.fullName} />
        <SecondaryButton label={t('chatBack')} onPress={() => setView('list')} />
        <ScrollView style={{ flex: 1, marginTop: space.sm }}>
          {isParent ? (
            <>
              {children.length > 1 ? (
                <>
                  <Title>{t('child')}</Title>
                  {children.map((ch) => (
                    <Pressable key={ch.id} onPress={() => void pickChild(ch.id)}>
                      <Card
                        style={{
                          marginBottom: space.sm,
                          borderColor: selectedChildId === ch.id ? colors.primary : colors.line,
                          borderWidth: selectedChildId === ch.id ? 2 : 1,
                        }}
                      >
                        <Text style={{ fontWeight: '600', color: colors.ink }}>{ch.name}</Text>
                      </Card>
                    </Pressable>
                  ))}
                </>
              ) : null}
              {selectedChildId ? (
                <>
                  <Title>{t('chatWith')}</Title>
                  {contacts.map((c) => {
                    const childName = children.find((ch) => ch.id === selectedChildId)?.name;
                    return (
                      <Pressable key={c.userId} onPress={() => void startParentChat(c.userId)}>
                        <Card style={{ marginBottom: space.sm }}>
                          <Text style={{ fontWeight: '700', color: colors.ink }}>{c.fullName}</Text>
                          <Muted>{contactRoleLine(c.role, childName)}</Muted>
                        </Card>
                      </Pressable>
                    );
                  })}
                </>
              ) : null}
            </>
          ) : (
            <>
              {parentRows.length > 0 ? (
                <>
                  <SectionLabel>{t('chatParentsSection')}</SectionLabel>
                  {parentRows.map((p) => (
                    <Pressable key={`${p.childId}-${p.parentId}`} onPress={() => void startStaffChat(p.childId, p.parentId)}>
                      <Card style={{ marginBottom: space.sm }}>
                        <Text style={{ fontWeight: '700', color: colors.ink }}>{p.parentName}</Text>
                        <Muted>{t('chatParentOf', { child: childShort(p.childName) || p.childName })}</Muted>
                      </Card>
                    </Pressable>
                  ))}
                </>
              ) : null}
              {isAdmin && teacherRows.length > 0 ? (
                <>
                  <SectionLabel>{t('chatTeachersSection')}</SectionLabel>
                  {teacherRows.map((te) => (
                    <Pressable key={te.userId} onPress={() => void startStaffPeerChat(te.userId)}>
                      <Card style={{ marginBottom: space.sm }}>
                        <Text style={{ fontWeight: '700', color: colors.ink }}>{te.fullName}</Text>
                        <Muted>
                          {te.classroomName ? t('chatTeacherClassroom', { classroom: te.classroomName }) : t('educator')}
                        </Muted>
                      </Card>
                    </Pressable>
                  ))}
                </>
              ) : null}
              {isEducator && directorRows.length > 0 ? (
                <>
                  <SectionLabel>{t('chatDirectorsSection')}</SectionLabel>
                  {directorRows.map((d) => (
                    <Pressable key={d.userId} onPress={() => void startStaffPeerChat(d.userId)}>
                      <Card style={{ marginBottom: space.sm }}>
                        <Text style={{ fontWeight: '700', color: colors.ink }}>{d.fullName}</Text>
                        <Muted>{t('admin')}</Muted>
                      </Card>
                    </Pressable>
                  ))}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ padding: space.md, paddingTop: space.lg, flex: 1 }}>
        <AppHeader
          title={conv ? partnerDisplayName(conv) : t('chat')}
          subtitle={conv ? partnerRoleLine(conv) : user?.fullName}
        />
        <SecondaryButton label={t('chatBack')} onPress={() => { setView('list'); void loadConversations(); }} />
        <ScrollView style={{ flex: 1, backgroundColor: 'rgba(250, 250, 249, 0.6)', borderRadius: 16, padding: 8, marginTop: space.sm }}>
          {messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <View
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  backgroundColor: mine ? colors.primary : colors.card,
                  padding: 12,
                  borderRadius: 14,
                  marginBottom: 8,
                  maxWidth: '80%',
                  borderWidth: mine ? 0 : 1,
                  borderColor: colors.line,
                }}
              >
                <Text style={{ color: mine ? colors.white : colors.muted, fontSize: 11, fontWeight: '600' }}>{m.senderName}</Text>
                <Text style={{ color: mine ? colors.white : colors.ink }}>{m.body}</Text>
              </View>
            );
          })}
        </ScrollView>
        <Field value={body} onChangeText={setBody} placeholder={t('message')} />
        <SecondaryButton label={t('send')} onPress={() => void send()} />
      </View>
    </KeyboardAvoidingView>
  );
}
