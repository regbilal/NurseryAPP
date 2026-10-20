import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { api, resolveAssetUrl, uploadBrandingLogo } from '../api';
import { colors, space } from '../theme';
import { Card, Chip, Muted, Title } from '../ui';

export function AdminScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'dash' | 'kids' | 'bill' | 'staff' | 'wait' | 'brand'>('dash');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({});
  const [children, setChildren] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any>({ staff: [], shifts: [] });
  const [wait, setWait] = useState<any[]>([]);

  const load = async () => {
    setStats(await api('/api/stats'));
    setChildren(await api('/api/children'));
    setInvoices(await api('/api/invoices'));
    setStaff(await api('/api/staff'));
    setWait(await api('/api/waitlist'));
    const brand = await api('/api/branding');
    setLogoUrl(resolveAssetUrl(brand.logoUrl));
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.md, paddingTop: 56 }}>
      <Title>{t('dashboard')}</Title>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label={t('dashboard')} selected={tab === 'dash'} onPress={() => setTab('dash')} />
        <Chip label={t('children')} selected={tab === 'kids'} onPress={() => setTab('kids')} />
        <Chip label={t('billing')} selected={tab === 'bill'} onPress={() => setTab('bill')} />
        <Chip label={t('staff')} selected={tab === 'staff'} onPress={() => setTab('staff')} />
        <Chip label={t('waitlist')} selected={tab === 'wait'} onPress={() => setTab('wait')} />
        <Chip label={t('branding')} selected={tab === 'brand'} onPress={() => setTab('brand')} />
      </View>
      {tab === 'dash' ? (
        <View>
          <Card>
            <Text style={{ fontSize: 32, fontWeight: '800', color: colors.primary }}>{stats.attendanceRate}%</Text>
            <Muted>{t('attendanceRate')}</Muted>
          </Card>
          <Card>
            <Text style={{ fontWeight: '700' }}>
              {stats.checkedIn}/{stats.children} {t('checkedIn')}
            </Text>
            <Muted>
              {t('overdueInvoices')}: {stats.overdueInvoices}
            </Muted>
            <Muted>
              {t('waitlist')}: {stats.waitlist}
            </Muted>
          </Card>
        </View>
      ) : null}
      {tab === 'kids'
        ? children.map((c) => (
            <Card key={c.id}>
              <Text style={{ fontWeight: '700' }}>
                {c.firstName} {c.lastName}
              </Text>
              <Muted>
                {c.classroom} · QR {c.qrCode}
              </Muted>
            </Card>
          ))
        : null}
      {tab === 'bill'
        ? invoices.map((i) => (
            <Card key={i.id}>
              <Text style={{ fontWeight: '700' }}>{i.child}</Text>
              <Muted>
                {i.period} · {i.amount} · {i.status}
              </Muted>
            </Card>
          ))
        : null}
      {tab === 'staff' ? (
        <View>
          {staff.staff?.map((s: any) => (
            <Card key={s.id}>
              <Text style={{ fontWeight: '700' }}>{s.fullName}</Text>
              <Muted>
                {s.role} · {s.email}
              </Muted>
            </Card>
          ))}
          {staff.shifts?.map((s: any) => (
            <Card key={s.id}>
              <Muted>
                {s.date} {s.start}–{s.end} · {s.status}
              </Muted>
            </Card>
          ))}
        </View>
      ) : null}
      {tab === 'brand' ? (
        <Card>
          <Text style={{ fontWeight: '700' }}>{t('branding')}</Text>
          <Muted>{t('logoHint')}</Muted>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={{ width: 200, height: 88, resizeMode: 'contain', marginVertical: 12 }} />
          ) : (
            <Muted>{t('noLogo')}</Muted>
          )}
          <Chip
            label={t('changeLogo')}
            onPress={async () => {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) return;
              const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
              if (pick.canceled) return;
              const asset = pick.assets[0];
              try {
                const res = await uploadBrandingLogo(asset.uri, asset.fileName ?? 'logo.png', asset.mimeType ?? 'image/png');
                setLogoUrl(resolveAssetUrl(res.logoUrl));
                Alert.alert(t('branding'), t('logoSaved'));
              } catch (e: any) {
                Alert.alert(t('branding'), e.message);
              }
            }}
          />
        </Card>
      ) : null}
      {tab === 'wait'
        ? wait.map((w) => (
            <Card key={w.id}>
              <Text style={{ fontWeight: '700' }}>{w.childName}</Text>
              <Muted>
                {w.parentName} · {w.status}
              </Muted>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Chip
                  label={t('approve')}
                  onPress={async () => {
                    await api(`/api/waitlist/${w.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Approved' }) });
                    await load();
                  }}
                />
                <Chip
                  label={t('reject')}
                  onPress={async () => {
                    await api(`/api/waitlist/${w.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Rejected' }) });
                    await load();
                  }}
                />
              </View>
            </Card>
          ))
        : null}
    </ScrollView>
  );
}
