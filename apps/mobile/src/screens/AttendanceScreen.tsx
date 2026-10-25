import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { colors } from '../theme';
import { AppHeader, Card, Chip, Field, Muted, PrimaryButton, Screen, Title } from '../ui';

export function AttendanceScreen() {
  const { t } = useTranslation();
  const [children, setChildren] = useState<any[]>([]);
  const [mode, setMode] = useState<'CheckIn' | 'CheckOut'>('CheckIn');
  const [scan, setScan] = useState(false);
  const [qr, setQr] = useState('');
  const [permission, requestPermission] = useCameraPermissions();

  const load = async () => setChildren(await api('/api/children'));
  useEffect(() => {
    void load();
  }, []);

  const mark = async (payload: { childId?: string; qrCode?: string }) => {
    try {
      await api('/api/children/attendance', {
        method: 'POST',
        body: JSON.stringify({ ...payload, type: mode, method: payload.qrCode ? 'Qr' : 'Tap' }),
      });
      Alert.alert(t('attendance'), `${mode} OK`);
      setScan(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <Screen>
      <AppHeader title={t('attendance')} />
      <Title>{t('attendance')}</Title>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label={t('checkIn')} selected={mode === 'CheckIn'} variant="nav" onPress={() => setMode('CheckIn')} />
        <Chip label={t('checkOut')} selected={mode === 'CheckOut'} variant="nav" onPress={() => setMode('CheckOut')} />
      </View>
      <Field value={qr} onChangeText={setQr} placeholder="QR (LINA-BENALI)" />
      <PrimaryButton label={`${t('scanQr')} / QR`} onPress={() => qr && mark({ qrCode: qr })} />
      {Platform.OS !== 'web' ? (
        <PrimaryButton
          label={t('scanQr')}
          onPress={async () => {
            if (!permission?.granted) await requestPermission();
            setScan(true);
          }}
        />
      ) : (
        <Muted>QR camera is available in the iOS/Android app. On web, tap a name or type a QR code below.</Muted>
      )}
      {scan && permission?.granted && Platform.OS !== 'web' ? (
        <View style={{ height: 260, marginVertical: 12, overflow: 'hidden', borderRadius: 16, borderWidth: 2, borderColor: colors.primary }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => mark({ qrCode: data })}
          />
        </View>
      ) : null}
      <Muted>{t('tapName')}</Muted>
      {children.map((c) => (
        <Pressable key={c.id} onPress={() => mark({ childId: c.id })}>
          <Card>
            <Text style={{ fontWeight: '800', color: colors.inkLight, fontSize: 14 }}>
              {c.firstName} {c.lastName}
            </Text>
            <Muted>QR: {c.qrCode}</Muted>
            {c.allergies?.length ? (
              <Text style={{ color: colors.danger, fontWeight: '800', marginTop: 8, fontSize: 12 }}>
                {t('allergies')}: {c.allergies.map((a: any) => a.name).join(', ')}
              </Text>
            ) : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
