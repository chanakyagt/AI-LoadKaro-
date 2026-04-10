import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { useTranslation } from '../i18n/LanguageContext';

export default function LandingScreen({ navigation }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <PrimaryButton
        title={t('create_account')}
        onPress={() => navigation.navigate('Register')}
      />
      <View style={styles.gap} />
      <PrimaryButton
        title={t('sign_in')}
        onPress={() => navigation.navigate('SignIn')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  gap: { height: 12 },
});
