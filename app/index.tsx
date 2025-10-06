import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Modal,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import createContextHook from '@nkzw/create-context-hook';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings, TrendingUp } from 'lucide-react-native';
import { useBaby } from '@/lib/baby-context';
import i18n from '@/lib/i18n';

type ActivityType = 'poop' | 'pee' | 'breast' | 'bottle' | 'sleep_start' | 'sleep_end';

interface Activity {
  id: string;
  type: ActivityType;
  timestamp: Date;
}

interface DaySummary {
  poop: number;
  pee: number;
  breast: number;
  bottle: number;
  sleepMinutes: number;
  lastSleepStart?: Date;
}

const ACTIVITIES_KEY = 'baby_activities';

const [BabyTrackerProvider, useBabyTracker] = createContextHook(() => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const timelineRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const stored = await AsyncStorage.getItem(ACTIVITIES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const activitiesWithDates = parsed.map((a: Activity) => ({
            ...a,
            timestamp: new Date(a.timestamp),
          }));
          setActivities(activitiesWithDates);
          console.log('Loaded activities:', activitiesWithDates.length);
        }
      } catch (error) {
        console.log('Error loading activities:', error);
      } finally {
        setLoading(false);
      }
    };
    loadActivities();
  }, []);

  useEffect(() => {
    if (!loading) {
      const saveActivities = async () => {
        try {
          await AsyncStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
          console.log('Saved activities:', activities.length);
        } catch (error) {
          console.log('Error saving activities:', error);
        }
      };
      saveActivities();
    }
  }, [activities, loading]);

  const addActivity = useCallback((type: ActivityType) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const when = selectedTime ?? new Date();

    const newActivity: Activity = {
      id: `${when.getTime()}-${type}`,
      type,
      timestamp: when,
    };

    setActivities(prev => [newActivity, ...prev]);
  }, [selectedTime]);

  const removeActivity = useCallback((activityId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setActivities(prev => prev.filter(a => a.id !== activityId));
  }, []);

  const calculateSummaryForDay = useCallback((targetDay: Date): DaySummary => {
    const dayActivities = activities.filter(activity => {
      const activityDate = new Date(activity.timestamp);
      return activityDate.toDateString() === targetDay.toDateString();
    });

    let sleepMinutes = 0;
    let lastSleepStart: Date | undefined;

    // Get all activities sorted by time to handle sleep across days
    const allActivitiesSorted = activities
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Find sleep sessions that affect this day
    for (let i = 0; i < allActivitiesSorted.length; i++) {
      const activity = allActivitiesSorted[i];
      const activityDate = new Date(activity.timestamp);
      
      if (activity.type === 'sleep_start') {
        lastSleepStart = activity.timestamp;
      } else if (activity.type === 'sleep_end' && lastSleepStart) {
        const sleepStartDate = new Date(lastSleepStart);
        const sleepEndDate = new Date(activity.timestamp);
        
        // Calculate sleep time that falls within the target day
        const dayStart = new Date(targetDay);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDay);
        dayEnd.setHours(23, 59, 59, 999);
        
        const effectiveStart = sleepStartDate < dayStart ? dayStart : sleepStartDate;
        const effectiveEnd = sleepEndDate > dayEnd ? dayEnd : sleepEndDate;
        
        if (effectiveStart <= dayEnd && effectiveEnd >= dayStart) {
          const diffMs = effectiveEnd.getTime() - effectiveStart.getTime();
          sleepMinutes += Math.max(0, Math.round(diffMs / 60000));
        }
        
        lastSleepStart = undefined;
      }
    }
    
    // Handle ongoing sleep that started on this day or previous day
    if (lastSleepStart) {
      const sleepStartDate = new Date(lastSleepStart);
      const now = new Date();
      const dayStart = new Date(targetDay);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDay);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Only count ongoing sleep if we're viewing today and haven't passed midnight yet
      const isToday = targetDay.toDateString() === now.toDateString();
      
      if (sleepStartDate <= dayEnd) {
        if (sleepStartDate.toDateString() === targetDay.toDateString()) {
          // Sleep started on target day
          if (isToday) {
            // For today, count until now
            const diffMs = now.getTime() - sleepStartDate.getTime();
            sleepMinutes += Math.max(0, Math.round(diffMs / 60000));
          }
          // For past days, don't count ongoing sleep (only completed sessions)
        } else if (sleepStartDate < dayStart) {
          // Sleep started before target day
          if (isToday) {
            // Count from midnight to now
            const diffMs = now.getTime() - dayStart.getTime();
            sleepMinutes += Math.max(0, Math.round(diffMs / 60000));
          } else {
            // For past days, count the full day if sleep continued
            const diffMs = dayEnd.getTime() - dayStart.getTime();
            sleepMinutes += Math.max(0, Math.round(diffMs / 60000));
          }
        }
      }
    }

    return {
      poop: dayActivities.filter(a => a.type === 'poop').length,
      pee: dayActivities.filter(a => a.type === 'pee').length,
      breast: dayActivities.filter(a => a.type === 'breast').length,
      bottle: dayActivities.filter(a => a.type === 'bottle').length,
      sleepMinutes,
      lastSleepStart,
    };
  }, [activities]);

  const calculateSummary = useCallback((): DaySummary => {
    const today = new Date();
    return calculateSummaryForDay(today);
  }, [calculateSummaryForDay]);

  const getActivitiesByDay = useCallback((day: Date) => {
    return activities
      .filter(a => new Date(a.timestamp).toDateString() === day.toDateString())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities]);

  const exportData = useCallback(() => {
    return activities;
  }, [activities]);

  const importData = useCallback((importedActivities: Activity[]) => {
    const activitiesWithDates = importedActivities.map((a) => ({
      ...a,
      timestamp: new Date(a.timestamp),
    }));
    setActivities(activitiesWithDates);
  }, []);

  const clearAllData = useCallback(async () => {
    setActivities([]);
    await AsyncStorage.removeItem(ACTIVITIES_KEY);
  }, []);

  const value = useMemo(() => ({
    activities,
    addActivity,
    removeActivity,
    calculateSummary,
    calculateSummaryForDay,
    getActivitiesByDay,
    selectedTime,
    setSelectedTime,
    timelineRef,
    exportData,
    importData,
    clearAllData,
    loading,
  }), [activities, addActivity, removeActivity, calculateSummary, calculateSummaryForDay, getActivitiesByDay, selectedTime, exportData, importData, clearAllData, loading]);

  return value;
});

function BabyTrackerScreen() {
  const insets = useSafeAreaInsets();
  const { calculateSummary, calculateSummaryForDay, getActivitiesByDay, selectedTime, setSelectedTime, timelineRef, removeActivity, activities } = useBabyTracker();
  const { babyName, feedingType } = useBaby();
  const [showWeeklyChart, setShowWeeklyChart] = useState<boolean>(false);

  const [dayOffset, setDayOffset] = useState<number>(0);
  const currentDay = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(12,0,0,0);
    return d;
  }, [dayOffset]);

  const summary = useMemo(() => calculateSummaryForDay(currentDay), [calculateSummaryForDay, currentDay]);
  const dayActivities = getActivitiesByDay(currentDay);

  useEffect(() => {
    setSelectedTime(null);
  }, [currentDay, setSelectedTime]);

  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        setCurrentTime(new Date());
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  const slots: string[] = useMemo(() => {
    const arr: string[] = [];
    for (let h = 0; h < 24; h++) {
      arr.push(`${String(h).padStart(2,'0')}:00`);
      arr.push(`${String(h).padStart(2,'0')}:15`);
      arr.push(`${String(h).padStart(2,'0')}:30`);
      arr.push(`${String(h).padStart(2,'0')}:45`);
    }
    return arr;
  }, []);

  const scrollToNow = useCallback(() => {
    if (dayOffset !== 0) return;
    
    const now = new Date();
    const minutes = now.getMinutes();
    let slotIndex = 0;
    if (minutes < 15) slotIndex = 0;
    else if (minutes < 30) slotIndex = 1;
    else if (minutes < 45) slotIndex = 2;
    else slotIndex = 3;
    
    const targetIndex = now.getHours() * 4 + slotIndex;
    const itemSize = 40;
    const viewport = 500;
    const offset = Math.max(0, targetIndex * itemSize - (viewport / 2) + (itemSize / 2));
    if (timelineRef.current) {
      timelineRef.current.scrollTo({ y: offset, animated: false });
    }
  }, [timelineRef, dayOffset]);

  useEffect(() => {
    scrollToNow();
  }, [scrollToNow, currentDay]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        return Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 10;
      },
      onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        if (gesture.dx > 50) {
          setDayOffset(prev => prev - 1);
        } else if (gesture.dx < -50) {
          setDayOffset(prev => prev + 1);
        }
      },
    })
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(i18n.locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'poop': return '💩';
      case 'pee': return '💧';
      case 'breast': return '🤱';
      case 'bottle': return '🍼';
      case 'sleep_start': return '😴';
      case 'sleep_end': return '😊';
    }
  };

  const getActivityLabel = (type: ActivityType) => {
    switch (type) {
      case 'poop': return i18n.t('poop');
      case 'pee': return i18n.t('pee');
      case 'breast': return i18n.t('breast');
      case 'bottle': return i18n.t('bottle');
      case 'sleep_start': return i18n.t('fellAsleep');
      case 'sleep_end': return i18n.t('wokeUp');
    }
  };

  return (
    <View style={[styles.safeContainer, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#f8fafc', '#eef2f7', '#e2e8f0']}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>{babyName || i18n.t('myBaby')}</Text>
                <Text style={styles.headerDate}>
                  {currentDay.toLocaleDateString(i18n.locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
              <View style={styles.headerButtons}>
                <TouchableOpacity 
                  style={styles.settingsButton} 
                  onPress={() => setShowWeeklyChart(true)}
                  testID="chart-button"
                >
                  <BlurView intensity={30} tint="light" style={styles.settingsButtonBlur}>
                    <TrendingUp size={20} color="#0f172a" />
                  </BlurView>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.settingsButton} 
                  onPress={() => router.push('/settings')}
                  testID="settings-button"
                >
                  <BlurView intensity={30} tint="light" style={styles.settingsButtonBlur}>
                    <Settings size={20} color="#0f172a" />
                  </BlurView>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.summaryContainer}>
            <BlurView intensity={20} tint="light" style={styles.summaryCardSmall}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}><Text style={styles.summaryEmoji}>💩</Text><Text style={styles.summaryNumberSmall}>{summary.poop}</Text><Text style={styles.summaryLabel}>{i18n.t('poop')}</Text></View>
                <View style={styles.summaryItem}><Text style={styles.summaryEmoji}>💧</Text><Text style={styles.summaryNumberSmall}>{summary.pee}</Text><Text style={styles.summaryLabel}>{i18n.t('pee')}</Text></View>
                {(feedingType === 'breast' || feedingType === 'mixed') && (
                  <View style={styles.summaryItem}><Text style={styles.summaryEmoji}>🤱</Text><Text style={styles.summaryNumberSmall}>{summary.breast}</Text><Text style={styles.summaryLabel}>{i18n.t('breast')}</Text></View>
                )}
                {(feedingType === 'bottle' || feedingType === 'mixed') && (
                  <View style={styles.summaryItem}><Text style={styles.summaryEmoji}>🍼</Text><Text style={styles.summaryNumberSmall}>{summary.bottle}</Text><Text style={styles.summaryLabel}>{i18n.t('bottle')}</Text></View>
                )}
                <View style={styles.summaryItem}><Text style={styles.summaryEmoji}>😴</Text><Text style={styles.summaryNumberSmall}>{`${Math.floor(summary.sleepMinutes/60)}h ${summary.sleepMinutes%60}m`}</Text><Text style={styles.summaryLabel}>{i18n.t('sleeping')}</Text></View>
              </View>
            </BlurView>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroller} testID="day-scroll">
            {[-3,-2,-1,0,1,2,3].map((offset) => {
              if (typeof offset !== 'number') return null;
              const d = new Date(); 
              d.setDate(d.getDate() + offset);
              const label = offset === 0 ? i18n.t('today') : d.toLocaleDateString(i18n.locale, { weekday: 'short', day: 'numeric' });
              const active = offset === dayOffset;
              return (
                <TouchableOpacity 
                  key={`day-${offset}`} 
                  style={[styles.dayChip, active ? styles.dayChipActive : undefined]} 
                  onPress={() => {
                    if (typeof offset === 'number') {
                      setDayOffset(offset);
                    }
                  }}
                >
                  <Text style={[styles.dayChipText, active ? styles.dayChipTextActive : undefined]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.timelineContainer} {...panResponder.current.panHandlers} testID="timeline-gesture">
            <Text style={styles.historyTitle}>{i18n.t('schedule')}</Text>
            <BlurView intensity={20} tint="light" style={styles.timelineCard}>
              <ScrollView
                ref={timelineRef}
                style={styles.timelineScroll}
                contentContainerStyle={styles.timelineContent}
                showsVerticalScrollIndicator={false}
                testID="timeline-scroll"
              >
                {slots.map((h) => {
                  const cellTime = new Date(currentDay);
                  const [hr, min] = h.split(':');
                  cellTime.setHours(parseInt(hr,10), parseInt(min,10), 0, 0);
                  
                  const minutes = currentTime.getMinutes();
                  let currentSlotMin = '00';
                  if (minutes < 15) currentSlotMin = '00';
                  else if (minutes < 30) currentSlotMin = '15';
                  else if (minutes < 45) currentSlotMin = '30';
                  else currentSlotMin = '45';
                  
                  const isNowSlot = dayOffset===0 && currentTime.getHours() === parseInt(hr,10) && min === currentSlotMin;
                  const isSelected = selectedTime?.getHours() === parseInt(hr,10) && selectedTime?.getMinutes() === parseInt(min,10) && selectedTime?.toDateString() === currentDay.toDateString();
                  
                  const activitiesInSlot = dayActivities.filter(a => {
                    const d = new Date(a.timestamp);
                    const activityHour = d.getHours();
                    const activityMin = d.getMinutes();
                    const slotMin = parseInt(min,10);
                    
                    if (activityHour !== parseInt(hr,10)) return false;
                    
                    if (slotMin === 0) return activityMin < 15;
                    if (slotMin === 15) return activityMin >= 15 && activityMin < 30;
                    if (slotMin === 30) return activityMin >= 30 && activityMin < 45;
                    if (slotMin === 45) return activityMin >= 45;
                    return false;
                  });
                  
                  return (
                    <TouchableOpacity
                      key={`slot-${h}`}
                      onPress={() => setSelectedTime(cellTime)}
                      style={[styles.slotRow, isSelected ? styles.slotRowActive : undefined, isNowSlot ? styles.slotRowNow : undefined]}
                      testID={`slot-${h}`}
                    >
                      <View style={styles.slotDivider} />
                      <Text style={[styles.slotLabel, isSelected ? styles.slotLabelActive : undefined, isNowSlot ? styles.slotLabelNow : undefined]}>{h}</Text>
                      <View style={styles.pillsRow}>
                        {activitiesInSlot.map(a => (
                          <TouchableOpacity 
                            key={a.id} 
                            style={styles.activityPill}
                            onPress={() => {
                              Alert.alert(
                                i18n.t('confirmDelete'),
                                i18n.t('deleteActivityWarning'),
                                [
                                  { text: i18n.t('cancel'), style: 'cancel' },
                                  { text: i18n.t('delete'), style: 'destructive', onPress: () => removeActivity(a.id) },
                                ]
                              );
                            }}
                            testID={`activity-${a.id}`}
                          >
                            <Text style={styles.activityPillText}>{getActivityIcon(a.type)} {getActivityLabel(a.type)}</Text>
                            <Text style={styles.activityPillTime}>{formatTime(a.timestamp)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </BlurView>
          </View>



          <View style={styles.bottomSpacer} />
        </ScrollView>
      </LinearGradient>

      <FloatingPlus />
      <WeeklyChartModal visible={showWeeklyChart} onClose={() => setShowWeeklyChart(false)} activities={activities} calculateSummaryForDay={calculateSummaryForDay} />
    </View>
  );
}

function FloatingPlus() {
  const { addActivity } = useBabyTracker();
  const { feedingType } = useBaby();
  const [open, setOpen] = useState<boolean>(false);
  return (
    <>
      <View pointerEvents="box-none" style={styles.fabContainer}>
        <TouchableOpacity onPress={() => setOpen(true)} style={styles.fab} testID="fab-plus">
          <BlurView intensity={30} tint="light" style={styles.fabBlur}>
            <Text style={styles.fabText}>＋</Text>
          </BlurView>
        </TouchableOpacity>
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{i18n.t('add')}</Text>
            <View style={styles.modalGrid}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => { addActivity('poop'); setOpen(false); }} testID="modal-poop">
                <Text style={styles.modalEmoji}>💩</Text>
                <Text style={styles.modalLabel}>{i18n.t('poop')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={() => { addActivity('pee'); setOpen(false); }} testID="modal-pee">
                <Text style={styles.modalEmoji}>💧</Text>
                <Text style={styles.modalLabel}>{i18n.t('pee')}</Text>
              </TouchableOpacity>
              {(feedingType === 'breast' || feedingType === 'mixed') && (
                <TouchableOpacity style={styles.modalBtn} onPress={() => { addActivity('breast'); setOpen(false); }} testID="modal-breast">
                  <Text style={styles.modalEmoji}>🤱</Text>
                  <Text style={styles.modalLabel}>{i18n.t('breast')}</Text>
                </TouchableOpacity>
              )}
              {(feedingType === 'bottle' || feedingType === 'mixed') && (
                <TouchableOpacity style={styles.modalBtn} onPress={() => { addActivity('bottle'); setOpen(false); }} testID="modal-bottle">
                  <Text style={styles.modalEmoji}>🍼</Text>
                  <Text style={styles.modalLabel}>{i18n.t('bottle')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.modalBtn} onPress={() => { addActivity('sleep_start'); setOpen(false); }} testID="modal-sleep-start">
                <Text style={styles.modalEmoji}>😴</Text>
                <Text style={styles.modalLabel}>{i18n.t('fellAsleep')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={() => { addActivity('sleep_end'); setOpen(false); }} testID="modal-sleep-end">
                <Text style={styles.modalEmoji}>😊</Text>
                <Text style={styles.modalLabel}>{i18n.t('wokeUp')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.modalClose} testID="modal-close">
              <Text style={styles.modalCloseText}>{i18n.t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

interface WeeklyChartModalProps {
  visible: boolean;
  onClose: () => void;
  activities: Activity[];
  calculateSummaryForDay: (day: Date) => DaySummary;
}

function WeeklyChartModal({ visible, onClose, activities, calculateSummaryForDay }: WeeklyChartModalProps) {
  const [weekOffset, setWeekOffset] = useState<number>(0);

  const weekData = useMemo(() => {
    const data: Array<{ day: string; poop: number; pee: number; feedings: number; sleepHours: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i - (weekOffset * 7));
      const summary = calculateSummaryForDay(d);
      data.push({
        day: d.toLocaleDateString(i18n.locale, { weekday: 'short' }),
        poop: summary.poop,
        pee: summary.pee,
        feedings: summary.breast + summary.bottle,
        sleepHours: summary.sleepMinutes / 60,
      });
    }
    return data;
  }, [activities, calculateSummaryForDay, weekOffset]);

  const maxPoop = Math.max(...weekData.map(d => d.poop), 1);
  const maxPee = Math.max(...weekData.map(d => d.pee), 1);
  const maxFeedings = Math.max(...weekData.map(d => d.feedings), 1);
  const maxSleep = Math.max(...weekData.map(d => d.sleepHours), 1);

  const chartHeight = 200;
  const chartWidth = 300;
  const padding = 40;

  const getY = (value: number, max: number) => {
    return chartHeight - padding - ((value / max) * (chartHeight - padding * 2));
  };

  const getX = (index: number) => {
    return padding + (index * ((chartWidth - padding * 2) / 6));
  };

  const createPath = (data: number[], max: number) => {
    if (data.length === 0) return '';
    let path = `M ${getX(0)} ${getY(data[0], max)}`;
    for (let i = 1; i < data.length; i++) {
      path += ` L ${getX(i)} ${getY(data[i], max)}`;
    }
    return path;
  };

  const getWeekLabel = () => {
    if (weekOffset === 0) return i18n.t('thisWeek');
    if (weekOffset === 1) return i18n.t('lastWeek');
    return `${weekOffset} ${i18n.t('weeksAgo')}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.chartModalBackdrop}>
        <BlurView intensity={40} tint="dark" style={styles.chartModalBlur}>
          <View style={styles.chartModalContent}>
            <View style={styles.chartHeader}>
              <TouchableOpacity 
                onPress={() => setWeekOffset(prev => prev + 1)} 
                style={styles.weekNavButton}
                testID="week-prev"
              >
                <Text style={styles.weekNavText}>←</Text>
              </TouchableOpacity>
              <View style={styles.chartTitleContainer}>
                <Text style={styles.chartModalTitle}>{i18n.t('weeklyChart')}</Text>
                <Text style={styles.chartWeekLabel}>{getWeekLabel()}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setWeekOffset(prev => Math.max(0, prev - 1))} 
                style={styles.weekNavButton}
                disabled={weekOffset === 0}
                testID="week-next"
              >
                <Text style={[styles.weekNavText, weekOffset === 0 && styles.weekNavTextDisabled]}>→</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
              <View style={styles.chartContainer}>
                <View style={styles.chartLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                    <Text style={styles.legendText}>{i18n.t('poop')}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                    <Text style={styles.legendText}>{i18n.t('pee')}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
                    <Text style={styles.legendText}>{i18n.t('feedings')}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                    <Text style={styles.legendText}>{i18n.t('sleepHours')}</Text>
                  </View>
                </View>

                {Platform.OS !== 'web' ? (
                  <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
                    <Path
                      d={createPath(weekData.map(d => d.poop), maxPoop)}
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="none"
                    />
                    <Path
                      d={createPath(weekData.map(d => d.pee), maxPee)}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="none"
                    />
                    <Path
                      d={createPath(weekData.map(d => d.feedings), maxFeedings)}
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="none"
                    />
                    <Path
                      d={createPath(weekData.map(d => d.sleepHours), maxSleep)}
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="none"
                    />
                    {weekData.map((d, i) => (
                      <SvgText
                        key={`label-${i}`}
                        x={getX(i)}
                        y={chartHeight - 10}
                        fontSize="12"
                        fill="#64748b"
                        textAnchor="middle"
                      >
                        {d.day}
                      </SvgText>
                    ))}
                  </Svg>
                ) : (
                  <View style={[styles.chart, { width: chartWidth, height: chartHeight }]}>
                    <Text style={styles.webChartText}>{i18n.t('chartAvailableOnMobile')}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity onPress={onClose} style={styles.chartModalClose}>
              <Text style={styles.chartModalCloseText}>{i18n.t('close')}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

export default function BabyTracker() {
  return (
    <BabyTrackerProvider>
      <BabyTrackerScreen />
    </BabyTrackerProvider>
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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 16,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  summaryContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  summaryCardSmall: {
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  summaryNumberSmall: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  historyContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  historyCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  historyEmoji: {
    fontSize: 20,
    marginRight: 16,
  },
  historyLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  historyTime: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  settingsButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsButtonBlur: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dayScroller: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginRight: 8,
  },
  dayChipActive: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderColor: 'rgba(99,102,241,0.35)',
  },
  dayChipText: {
    color: '#334155',
    fontWeight: '600',
  },
  dayChipTextActive: {
    color: '#4f46e5',
  },
  timelineContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  timelineCard: {
    height: 500,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  timelineScroll: { flex: 1 },
  timelineContent: {
    paddingVertical: 8,
  },
  slotRow: {
    height: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotRowActive: {
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  slotRowNow: {
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  slotLabel: {
    position: 'absolute',
    left: 16,
    top: 10,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'left',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  slotLabelActive: {
    color: '#4f46e5',
  },
  slotLabelNow: {
    color: '#ef4444',
    fontWeight: '700',
  },
  slotDivider: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.15)',
  },

  activityPill: {
    alignSelf: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityPillText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
    textAlign: 'center',
  },
  activityPillTime: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 120,
  },
  pillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start', paddingHorizontal: 8, marginLeft: 70 },
  fabContainer: { position: 'absolute', right: 24, bottom: 24 },
  fab: { borderRadius: 28, overflow: 'hidden' },
  fabBlur: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  fabText: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: 'rgba(255,255,255,0.85)', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingBottom: 24, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', textAlign: 'center', marginBottom: 12 },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  modalBtn: { width: '48%', borderRadius: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  modalEmoji: { fontSize: 22, marginBottom: 6 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  modalClose: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  modalCloseText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  chartModalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chartModalBlur: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  chartModalContent: { width: '90%', maxWidth: 400, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  chartModalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  chartTitleContainer: { flex: 1, alignItems: 'center' },
  chartWeekLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  weekNavButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(99,102,241,0.1)' },
  weekNavText: { fontSize: 20, color: '#4f46e5', fontWeight: '600' },
  weekNavTextDisabled: { color: '#cbd5e1' },
  chartScroll: { marginBottom: 20 },
  chartContainer: { alignItems: 'center' },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  chart: { marginVertical: 10 },
  webChartText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 80 },
  chartModalClose: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  chartModalCloseText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
});