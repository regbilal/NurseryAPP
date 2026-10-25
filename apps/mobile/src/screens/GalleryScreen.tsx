import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Platform, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { api, downloadGalleryImage, resolveAssetUrl, uploadGalleryPhoto } from '../api';
import { useAuth } from '../auth';
import { colors, radius, space } from '../theme';
import {
  AppHeader,
  Card,
  Chip,
  Field,
  InlineAction,
  Muted,
  PrimaryButton,
  RowActions,
  Screen,
  SecondaryButton,
  SectionLabel,
  Title,
} from '../ui';

type ChildRow = { id: string; firstName: string; lastName: string };
type MediaFeedItem = {
  id: string;
  url: string;
  caption?: string;
  createdAt: string;
  children: { childId: string; name: string }[];
};
type PickedPhoto = { uri: string; fileName: string; mimeType: string };

export function GalleryScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canUpload = user?.role === 'Educator' || user?.role === 'Admin';

  const [children, setChildren] = useState<ChildRow[]>([]);
  const [filterChildId, setFilterChildId] = useState<string | null>(null);
  const [uploadChildIds, setUploadChildIds] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [pending, setPending] = useState<PickedPhoto | null>(null);
  const [items, setItems] = useState<MediaFeedItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const kids = await api<ChildRow[]>('/api/children');
    setChildren(kids);
    const path = filterChildId ? `/api/media?childId=${filterChildId}` : '/api/media';
    setItems(await api(path));
  }, [filterChildId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (children.length === 1 && uploadChildIds.length === 0) {
      setUploadChildIds([children[0].id]);
    }
  }, [children, uploadChildIds.length]);

  const toggleUploadChild = (id: string) => {
    setUploadChildIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const pickPhoto = async (useCamera: boolean) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('photos'), t('photoPermissionRequired'));
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
          allowsEditing: false,
        });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPending({
      uri: asset.uri,
      fileName: asset.fileName ?? 'photo.jpg',
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  };

  const submitUpload = async () => {
    if (!pending) {
      Alert.alert(t('photos'), t('photoPickFirst'));
      return;
    }
    if (uploadChildIds.length === 0) {
      Alert.alert(t('photos'), t('photoSelectChildRequired'));
      return;
    }
    setUploading(true);
    setStatusMsg(null);
    try {
      await uploadGalleryPhoto(
        pending.uri,
        uploadChildIds,
        caption.trim() || undefined,
        pending.fileName,
        pending.mimeType,
      );
      setCaption('');
      setPending(null);
      await load();
      setStatusMsg({ kind: 'ok', text: t('photoUploaded') });
      if (Platform.OS !== 'web') Alert.alert(t('photos'), t('photoUploaded'));
    } catch (e: any) {
      const text = e.message ?? 'Upload failed';
      setStatusMsg({ kind: 'err', text });
      Alert.alert(t('photos'), text);
    } finally {
      setUploading(false);
    }
  };

  const downloadPhoto = async (item: MediaFeedItem) => {
    setDownloadingId(item.id);
    try {
      await downloadGalleryImage(item.url, `nursery-${item.id}.jpg`);
      if (Platform.OS !== 'web') Alert.alert(t('photos'), t('photoDownloaded'));
    } catch (e: any) {
      Alert.alert(t('photos'), e.message ?? t('photoDownloadFailed'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Screen>
      <AppHeader title={t('photos')} />
      <Title>{t('photos')}</Title>

      {canUpload ? (
        <Card>
          <SectionLabel>{t('photoShareNew')}</SectionLabel>
          <Muted>{t('photoTagChildrenHint')}</Muted>

          {children.length === 0 ? <Muted>{t('photoNoChildrenInRoom')}</Muted> : null}
          {children.length > 0 ? (
            <>
              <SectionLabel>{t('photoTagChildren')}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm }}>
                {children.map((c) => (
                  <Chip
                    key={c.id}
                    label={`${c.firstName} ${c.lastName}`}
                    selected={uploadChildIds.includes(c.id)}
                    variant="soft"
                    onPress={() => toggleUploadChild(c.id)}
                  />
                ))}
              </View>
            </>
          ) : null}

          <SecondaryButton label={t('photoSelectFromGallery')} onPress={() => void pickPhoto(false)} />
          {Platform.OS !== 'web' ? (
            <SecondaryButton label={t('photoTakePicture')} onPress={() => void pickPhoto(true)} />
          ) : null}

          {pending ? (
            <View style={{ marginTop: space.md }}>
              <SectionLabel>{t('photoPreview')}</SectionLabel>
              <Image
                source={{ uri: pending.uri }}
                style={{
                  width: '100%',
                  height: 240,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceMuted,
                  marginBottom: space.sm,
                }}
                resizeMode="cover"
              />
              <SecondaryButton label={t('photoChange')} onPress={() => void pickPhoto(false)} />
            </View>
          ) : (
            <View style={{ marginTop: space.sm }}><Muted>{t('photoPickFirst')}</Muted></View>
          )}

          <Field value={caption} onChangeText={setCaption} placeholder={t('photoCaption')} />
          {statusMsg ? (
            <View
              style={{
                marginTop: space.sm,
                padding: space.sm,
                borderRadius: radius.sm,
                backgroundColor: statusMsg.kind === 'ok' ? colors.sageSoft : colors.dangerSoft,
                borderWidth: 1,
                borderColor: statusMsg.kind === 'ok' ? colors.sageBorder : colors.dangerBorder,
              }}
            >
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{statusMsg.text}</Text>
            </View>
          ) : null}
          <PrimaryButton
            label={uploading ? t('photoUploading') : t('uploadPhoto')}
            color={colors.sage}
            onPress={() => void submitUpload()}
          />
        </Card>
      ) : null}

      <SectionLabel>{t('photoGallery')}</SectionLabel>
      {children.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm }}>
          <Chip label={t('all')} selected={filterChildId === null} variant="nav" onPress={() => setFilterChildId(null)} />
          {children.map((c) => (
            <Chip
              key={c.id}
              label={`${c.firstName} ${c.lastName}`}
              selected={filterChildId === c.id}
              variant="nav"
              onPress={() => setFilterChildId(c.id)}
            />
          ))}
        </View>
      ) : null}

      {items.length === 0 ? <Muted>{t('noData')}</Muted> : null}
      {items.map((m) => {
        const uri = resolveAssetUrl(m.url);
        const names = m.children?.map((c) => c.name).join(', ') ?? '';
        return (
          <Card key={String(m.id)}>
            {uri ? (
              <Image
                source={{ uri }}
                style={{ width: '100%', height: 220, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted }}
                resizeMode="cover"
              />
            ) : (
              <Muted>{t('photoLoadFailed')}</Muted>
            )}
            {names ? <Muted>{names}</Muted> : null}
            {m.caption ? <Text style={{ marginTop: 6, color: colors.ink, fontWeight: '600', fontSize: 14 }}>{m.caption}</Text> : null}
            <Muted>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</Muted>
            {uri ? (
              <RowActions>
                <InlineAction
                  label={downloadingId === m.id ? t('photoDownloading') : t('downloadPhoto')}
                  onPress={() => void downloadPhoto(m)}
                />
              </RowActions>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
