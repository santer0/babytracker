import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useBaby } from '@/lib/baby-context';
import i18n from '@/lib/i18n';

type FeedingType = 'breast' | 'bottle' | 'mixed';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [babyName, setBabyName] = useState<string>('');
  const [feedingType, setFeedingType] = useState<FeedingType>('mixed');
  const [loading, setLoading] = useState<boolean>(false);
  const { saveBabyName } = useBaby();

  const handleCreateBaby = async () => {
    if (!babyName.trim()) {
      Alert.alert(i18n.t('error'), i18n.t('enterBabyName'));
      return;
    }

    try {
      setLoading(true);
      await saveBabyName(babyName.trim(), feedingType);
      router.replace('/');
    } catch (error) {
      console.log('Error creating baby:', error);
      Alert.alert(i18n.t('error'), i18n.t('couldNotSaveName'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.safeContainer, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#f8fafc', '#eef2f7', '#e2e8f0']}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.emoji}>👶</Text>
            <Text style={styles.title}>{i18n.t('welcome')}</Text>
            <Text style={styles.subtitle}>
              {i18n.t('babyNamePrompt')}
            </Text>
          </View>

          <BlurView intensity={20} tint="light" style={styles.card}>
            <Text style={styles.cardTitle}>{i18n.t('babyNameLabel')}</Text>
            <TextInput
              style={styles.textInput}
              value={babyName}
              onChangeText={setBabyName}
              placeholder={i18n.t('babyNamePlaceholder')}
              autoFocus
              maxLength={30}
            />
            
            <Text style={styles.cardTitle}>{i18n.t('feedingType')}</Text>
            <View style={styles.feedingTypeContainer}>
              <TouchableOpacity
                style={[styles.feedingTypeButton, feedingType === 'breast' && styles.feedingTypeButtonActive]}
                onPress={() => setFeedingType('breast')}
              >
                <Text style={styles.feedingTypeEmoji}>🤱</Text>
                <Text style={[styles.feedingTypeText, feedingType === 'breast' && styles.feedingTypeTextActive]}>{i18n.t('breast')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.feedingTypeButton, feedingType === 'bottle' && styles.feedingTypeButtonActive]}
                onPress={() => setFeedingType('bottle')}
              >
                <Text style={styles.feedingTypeEmoji}>🍼</Text>
                <Text style={[styles.feedingTypeText, feedingType === 'bottle' && styles.feedingTypeTextActive]}>{i18n.t('bottle')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.feedingTypeButton, feedingType === 'mixed' && styles.feedingTypeButtonActive]}
                onPress={() => setFeedingType('mixed')}
              >
                <Text style={styles.feedingTypeEmoji}>🤱🍼</Text>
                <Text style={[styles.feedingTypeText, feedingType === 'mixed' && styles.feedingTypeTextActive]}>{i18n.t('mixed')}</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleCreateBaby}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? i18n.t('saving') : i18n.t('continue')}</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    color: '#1e293b',
    marginBottom: 20,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4f46e5',
  },
  feedingTypeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  feedingTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    alignItems: 'center',
  },
  feedingTypeButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  feedingTypeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  feedingTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  feedingTypeTextActive: {
    color: '#4f46e5',
  },
});
