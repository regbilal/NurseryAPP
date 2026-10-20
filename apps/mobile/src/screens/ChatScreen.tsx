import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAuth } from '../auth';
import { colors, space } from '../theme';
import { Field, PrimaryButton, Title } from '../ui';

export function ChatScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [conv, setConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');

  const load = async () => {
    const list = await api('/api/conversations');
    const c = list[0];
    setConv(c);
    if (c) setMessages(await api(`/api/conversations/${c.id}/messages`));
  };

  useEffect(() => {
    void load();
  }, []);

  const send = async () => {
    if (!conv || !body.trim()) return;
    await api(`/api/conversations/${conv.id}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
    setBody('');
    setMessages(await api(`/api/conversations/${conv.id}/messages`));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ padding: space.md, paddingTop: 56, flex: 1 }}>
        <Title>{conv?.title ?? t('chat')}</Title>
        <ScrollView style={{ flex: 1 }}>
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
                }}
              >
                <Text style={{ color: mine ? colors.white : colors.muted, fontSize: 11 }}>{m.senderName}</Text>
                <Text style={{ color: mine ? colors.white : colors.ink }}>{m.body}</Text>
              </View>
            );
          })}
        </ScrollView>
        <Field value={body} onChangeText={setBody} placeholder={t('message')} />
        <PrimaryButton label={t('send')} onPress={send} />
      </View>
    </KeyboardAvoidingView>
  );
}
