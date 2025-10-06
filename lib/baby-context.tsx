import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BABY_NAME_KEY = 'baby_name';
const FEEDING_TYPE_KEY = 'feeding_type';

type FeedingType = 'breast' | 'bottle' | 'mixed';

export const [BabyProvider, useBaby] = createContextHook(() => {
  const [babyName, setBabyName] = useState<string | null>(null);
  const [feedingType, setFeedingType] = useState<FeedingType>('mixed');
  const [loading, setLoading] = useState<boolean>(true);

  const loadBabyName = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(BABY_NAME_KEY);
      if (stored) {
        setBabyName(stored);
      }
      const storedFeedingType = await AsyncStorage.getItem(FEEDING_TYPE_KEY);
      if (storedFeedingType) {
        setFeedingType(storedFeedingType as FeedingType);
      }
    } catch (error) {
      console.log('Error loading baby name:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBabyName();
  }, [loadBabyName]);

  const saveBabyName = useCallback(async (name: string, feedingTypeValue?: FeedingType) => {
    try {
      await AsyncStorage.setItem(BABY_NAME_KEY, name);
      setBabyName(name);
      if (feedingTypeValue) {
        await AsyncStorage.setItem(FEEDING_TYPE_KEY, feedingTypeValue);
        setFeedingType(feedingTypeValue);
      }
    } catch (error) {
      console.log('Error saving baby name:', error);
      throw error;
    }
  }, []);

  const updateBabyName = useCallback(async (name: string) => {
    try {
      await AsyncStorage.setItem(BABY_NAME_KEY, name);
      setBabyName(name);
    } catch (error) {
      console.log('Error updating baby name:', error);
      throw error;
    }
  }, []);

  const updateFeedingType = useCallback(async (type: FeedingType) => {
    try {
      await AsyncStorage.setItem(FEEDING_TYPE_KEY, type);
      setFeedingType(type);
    } catch (error) {
      console.log('Error updating feeding type:', error);
      throw error;
    }
  }, []);

  return useMemo(
    () => ({
      babyName,
      feedingType,
      loading,
      saveBabyName,
      updateBabyName,
      updateFeedingType,
      hasCompletedOnboarding: !!babyName,
    }),
    [babyName, feedingType, loading, saveBabyName, updateBabyName, updateFeedingType]
  );
});
