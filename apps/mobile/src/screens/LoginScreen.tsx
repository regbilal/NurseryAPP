import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth';
import { getBaseUrl, loadBaseUrl, setBaseUrl } from '../api';
import { colors, space } from '../theme';
import { Chip, Field, PrimaryButton, Title, Muted } from '../ui';
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

  useEffect(() => {
    loadBaseUrl().then(setApi);
  }, []);

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
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 72, backgroundColor: colors.bg, flexGrow: 1 }}>
      <Text style={{ fontSize: 36, color: colors.primary, fontWeight: '800' }}>{t('appName')}</Text>
      <Muted>{t('tagline')}</Muted>
      <View style={{ height: 20 }} />
      <Title>{t('login')}</Title>
      <Field value={email} onChangeText={setEmail} placeholder={t('email')} />
      <Field value={password} onChangeText={setPassword} placeholder={t('password')} secure />
      <Muted>{t('language')}</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
        {['en', 'fr', 'ar'].map((code) => (
          <Chip
            key={code}
            label={code.toUpperCase()}
            selected={lang === code}
            onPress={() => {
              setLang(code);
              void setAppLanguage(code);
            }}
          />
        ))}
      </View>
      <Muted>{t('apiUrl')}</Muted>
      <Field value={apiUrl} onChangeText={setApi} placeholder={t('apiUrl')} />
      <PrimaryButton label={t('login')} onPress={submit} />
      <View style={{ height: 16 }} />
      <Muted>{t('demo')}</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {demos.map((d) => (
          <Chip
            key={d.role}
            label={t(d.role)}
            onPress={() => {
              setEmail(d.email);
              setPassword(d.password);
            }}
          />
        ))}
      </View>
    </ScrollView>
  );
}
