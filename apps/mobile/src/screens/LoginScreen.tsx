import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth';
import { fetchPublicBranding, getBaseUrl, loadBaseUrl, resolveAssetUrl, setBaseUrl } from '../api';
import { colors, space } from '../theme';
import { BrandIcon, Chip, Field, FieldLabel, LoginCard, Muted, PrimaryButton } from '../ui';
import { setAppLanguage } from '../i18n';

const demos = [
  { role: 'parent', email: 'parent@nursery.local', password: 'Parent123!' },
  { role: 'educator', email: 'educator@nursery.local', password: 'Educator123!' },
  { role: 'admin', email: 'admin@nursery.local', password: 'Admin123!' },
];

export function LoginScreen() {
  const { t } = useTranslation();
  const { login, setLanguage } = useAuth();
  const [email, setEmail] = useState('parent@nursery.local');
  const [password, setPassword] = useState('Parent123!');
  const [lang, setLang] = useState('en');
  const [apiUrl, setApi] = useState(getBaseUrl());
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    void loadBaseUrl().then(setApi);
  }, []);

  useEffect(() => {
    void fetchPublicBranding().then((b) => setLogoUrl(resolveAssetUrl(b.logoUrl)));
  }, [apiUrl]);

  const submit = async () => {
    try {
      await setBaseUrl(apiUrl);
      await login(email, password);
      await setLanguage(lang);
    } catch (e: any) {
      Alert.alert('Login', e.message ?? 'Failed');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 48, backgroundColor: colors.bg, flexGrow: 1 }}>
      <LoginCard>
        <View style={{ alignItems: 'center', marginBottom: space.md }}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={{ width: 160, height: 72, resizeMode: 'contain', marginBottom: 12 }} />
          ) : (
            <View style={{ marginBottom: 12 }}>
              <BrandIcon size={64} />
            </View>
          )}
          <Text style={{ fontSize: 20, fontWeight: '900', color: colors.inkLight, textAlign: 'center' }}>{t('appName')}</Text>
          <Muted>{t('tagline')}</Muted>
        </View>

        <FieldLabel>{t('email')}</FieldLabel>
        <Field value={email} onChangeText={setEmail} placeholder={t('email')} />
        <FieldLabel>{t('password')}</FieldLabel>
        <Field value={password} onChangeText={setPassword} placeholder={t('password')} secure />

        <FieldLabel>{t('language')}</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
          {['en', 'fr', 'ar'].map((code) => (
            <Chip
              key={code}
              label={code.toUpperCase()}
              selected={lang === code}
              variant="nav"
              onPress={() => {
                setLang(code);
                void setAppLanguage(code);
              }}
            />
          ))}
        </View>

        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.line,
            marginBottom: 8,
          }}
        >
          <FieldLabel>{t('apiUrl')}</FieldLabel>
          <Field value={apiUrl} onChangeText={setApi} placeholder={t('apiUrl')} mono />
        </View>

        <PrimaryButton label={t('login')} onPress={submit} />

        <View style={{ height: 16 }} />
        <Muted>{t('demo')}</Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {demos.map((d) => (
            <Chip
              key={d.role}
              label={t(d.role)}
              variant="soft"
              onPress={() => {
                setEmail(d.email);
                setPassword(d.password);
              }}
            />
          ))}
        </View>
      </LoginCard>
    </ScrollView>
  );
}
