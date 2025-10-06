import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useBaby } from '@/lib/baby-context';
import { Edit2, Download } from 'lucide-react-native';
import i18n from '@/lib/i18n';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';


export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { babyName, updateBabyName, feedingType, updateFeedingType } = useBaby();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>(babyName || '');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleSave = async () => {
    if (!newName.trim()) {
      Alert.alert(i18n.t('error'), i18n.t('enterName'));
      return;
    }

    try {
      await updateBabyName(newName.trim());
      setIsEditing(false);
      Alert.alert(i18n.t('success'), i18n.t('nameUpdated'));
    } catch (error) {
      console.log('Error updating baby name:', error);
      Alert.alert(i18n.t('error'), i18n.t('couldNotUpdateName'));
    }
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      console.log('Starting export...');

      const activitiesData = await AsyncStorage.getItem('baby_activities');
      console.log('Activities data:', activitiesData);

      if (!activitiesData) {
        Alert.alert(i18n.t('error'), i18n.t('noDataToExport'));
        setIsExporting(false);
        return;
      }

      const activities = JSON.parse(activitiesData);
      console.log('Parsed activities:', activities.length);

      if (activities.length === 0) {
        Alert.alert(i18n.t('error'), i18n.t('noDataToExport'));
        setIsExporting(false);
        return;
      }

      let txtContent = `Baby Activities Export\n`;
      txtContent += `Baby Name: ${babyName || 'N/A'}\n`;
      txtContent += `Export Date: ${new Date().toLocaleString(i18n.locale)}\n`;
      txtContent += `Total Activities: ${activities.length}\n`;
      txtContent += `\n${'='.repeat(50)}\n\n`;

      activities.forEach((activity: any, index: number) => {
        const date = new Date(activity.timestamp);
        const activityType = activity.type;
        const typeLabel = getActivityLabel(activityType);
        
        txtContent += `Activity ${index + 1}:\n`;
        txtContent += `  Type: ${typeLabel} (${activityType})\n`;
        txtContent += `  Date: ${date.toLocaleDateString(i18n.locale)}\n`;
        txtContent += `  Time: ${date.toLocaleTimeString(i18n.locale)}\n`;
        txtContent += `  Timestamp: ${activity.timestamp}\n`;
        txtContent += `\n`;
      });

      console.log('TXT content created, length:', txtContent.length);

      if (Platform.OS === 'web') {
        const blob = new Blob([txtContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `baby_activities_${new Date().getTime()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert(i18n.t('success'), i18n.t('dataExported'));
      } else {
        const fileName = `baby_activities_${new Date().getTime()}.txt`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        console.log('Writing to file:', fileUri);

        await FileSystem.writeAsStringAsync(fileUri, txtContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        console.log('File written, checking if sharing is available...');
        const isAvailable = await Sharing.isAvailableAsync();
        console.log('Sharing available:', isAvailable);

        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/plain',
            dialogTitle: i18n.t('exportData'),
          });
          Alert.alert(i18n.t('success'), i18n.t('dataExported'));
        } else {
          Alert.alert(i18n.t('error'), 'Sharing is not available on this device');
        }
      }
    } catch (error) {
      console.log('Error exporting data:', error);
      Alert.alert(i18n.t('error'), i18n.t('couldNotExportData'));
    } finally {
      setIsExporting(false);
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'poop': return i18n.t('poop');
      case 'pee': return i18n.t('pee');
      case 'breast': return i18n.t('breast');
      case 'bottle': return i18n.t('bottle');
      case 'sleep_start': return i18n.t('fellAsleep');
      case 'sleep_end': return i18n.t('wokeUp');
      default: return type;
    }
  };



  return (
    <View style={[styles.safeContainer, { paddingTop: insets.top }]}>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: i18n.t('settings'),
          headerStyle: {
            backgroundColor: '#f8fafc',
          },
        }} 
      />
      
      <LinearGradient
        colors={['#f8fafc', '#eef2f7', '#e2e8f0']}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <BlurView intensity={20} tint="light" style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{i18n.t('babyName')}</Text>
              {!isEditing && (
                <TouchableOpacity 
                  style={styles.editButton} 
                  onPress={() => {
                    setNewName(babyName || '');
                    setIsEditing(true);
                  }}
                >
                  <Edit2 size={20} color="#4f46e5" />
                </TouchableOpacity>
              )}
            </View>
            
            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.textInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder={i18n.t('babyNameLabel')}
                  autoFocus
                  maxLength={30}
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={[styles.button, styles.cancelButton]} 
                    onPress={() => {
                      setIsEditing(false);
                      setNewName(babyName || '');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>{i18n.t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.button, styles.saveButton]} 
                    onPress={handleSave}
                  >
                    <Text style={styles.saveButtonText}>{i18n.t('save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.babyNameText}>{babyName}</Text>
            )}
          </BlurView>

          <BlurView intensity={20} tint="light" style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{i18n.t('feedingType')}</Text>
            </View>
            
            <View style={styles.feedingTypeContainer}>
              <TouchableOpacity
                style={[styles.feedingTypeButton, feedingType === 'breast' && styles.feedingTypeButtonActive]}
                onPress={() => updateFeedingType('breast')}
              >
                <Text style={styles.feedingTypeEmoji}>🤱</Text>
                <Text style={[styles.feedingTypeText, feedingType === 'breast' && styles.feedingTypeTextActive]}>{i18n.t('breast')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.feedingTypeButton, feedingType === 'bottle' && styles.feedingTypeButtonActive]}
                onPress={() => updateFeedingType('bottle')}
              >
                <Text style={styles.feedingTypeEmoji}>🍼</Text>
                <Text style={[styles.feedingTypeText, feedingType === 'bottle' && styles.feedingTypeTextActive]}>{i18n.t('bottle')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.feedingTypeButton, feedingType === 'mixed' && styles.feedingTypeButtonActive]}
                onPress={() => updateFeedingType('mixed')}
              >
                <Text style={styles.feedingTypeEmoji}>🤱🍼</Text>
                <Text style={[styles.feedingTypeText, feedingType === 'mixed' && styles.feedingTypeTextActive]}>{i18n.t('mixed')}</Text>
              </TouchableOpacity>
            </View>
          </BlurView>

          <BlurView intensity={20} tint="light" style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{i18n.t('dataManagement')}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.exportButton}
              onPress={handleExportData}
              disabled={isExporting}
            >
              <View style={styles.exportButtonContent}>
                <View style={styles.exportIconContainer}>
                  <Download size={20} color="#4f46e5" />
                </View>
                <View style={styles.exportTextContainer}>
                  <Text style={styles.exportButtonTitle}>{i18n.t('exportData')}</Text>
                  <Text style={styles.exportButtonDesc}>{i18n.t('exportDataDesc')}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </BlurView>
        </View>
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  babyNameText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
  },
  editContainer: {
    gap: 12,
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
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  saveButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
  },
  exportButton: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    padding: 16,
  },
  exportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exportIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportTextContainer: {
    flex: 1,
  },
  exportButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  exportButtonDesc: {
    fontSize: 13,
    color: '#64748b',
  },

  feedingTypeContainer: {
    flexDirection: 'row',
    gap: 8,
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
