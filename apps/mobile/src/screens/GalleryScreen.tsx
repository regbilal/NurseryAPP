import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { api, getBaseUrl, getToken } from '../api';
import { useAuth } from '../auth';
import { colors, space } from '../theme';
import { Card, Muted, PrimaryButton, Title } from '../ui';

export function GalleryScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [childId, setChildId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    const children = await api('/api/children');
    const id = children[0]?.id;
    setChildId(id);
    if (id) setItems(await api(`/api/children/${id}/media`));
  };

  useEffect(() => {
    void load();
  }, []);

  const capture = async () => {
    if (!childId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const photo = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (photo.canceled) return;
    const uri = photo.assets[0].uri;
    const form = new FormData();
    form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
    form.append('caption', 'Nursery moment');
    form.append('kind', 'Photo');
    const headers: Record<string, string> = {};
    const tk = getToken();
    if (tk) headers.Authorization = `Bearer ${tk}`;
    await fetch(`${getBaseUrl()}/api/children/${childId}/media`, { method: 'POST', headers, body: form });
    await load();
  };

  const canUpload = user?.role === 'Educator' || user?.role === 'Admin';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.md, paddingTop: 56 }}>
      <Title>{t('photos')}</Title>
      {canUpload ? <PrimaryButton label={t('capture')} onPress={capture} /> : null}
      {items.length === 0 ? <Muted>{t('noData')}</Muted> : null}
      {items.map((m) => (
        <Card key={m.id}>
          <Image source={{ uri: `${getBaseUrl()}${m.url}` }} style={{ width: '100%', height: 180, borderRadius: 12 }} />
          {m.caption ? <Text style={{ marginTop: 8, color: colors.ink }}>{m.caption}</Text> : null}
        </Card>
      ))}
    </ScrollView>
  );
}
