import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { parseLabelText } from './src/services/labelParser';
import { fetchRooms, submitScan, lookupItem } from './src/services/api';

type Step = 'select_room' | 'scan_masha' | 'scan_sn' | 'manual_entry' | 'summary';

export default function App() {
  const [currentStep, setCurrentStep] = useState<Step>('select_room');
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [sweeperName, setSweeperName] = useState('עובד סריקה');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Scan state
  const [scannedMasha, setScannedMasha] = useState('');
  const [scannedSn, setScannedSn] = useState('');
  const [detectedDescription, setDetectedDescription] = useState('');
  const [detectedOwner, setDetectedOwner] = useState('');
  const [scannedItemsCount, setScannedItemsCount] = useState(0);
  const [lastScannedItem, setLastScannedItem] = useState<any | null>(null);

  // Manual input state
  const [manualMasha, setManualMasha] = useState('');
  const [manualSn, setManualSn] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await fetchRooms();
      setRooms(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.log('Error loading rooms', err);
      setLoadError(err.message || 'שגיאת תקשורת עם השרת');
    } finally {
      setLoading(false);
    }
  };

  const startSweepForRoom = (room: any) => {
    setSelectedRoom(room);
    setCurrentStep('scan_masha');
    resetCurrentScan();
  };

  const resetCurrentScan = () => {
    setScannedMasha('');
    setScannedSn('');
    setDetectedDescription('');
    setDetectedOwner('');
  };

  // Simulated CV detection of Masha sticker (Top/Front sticker)
  const simulateDetectMasha = async (sampleIndex: number) => {
    let mockText = "";
    if (sampleIndex === 1) {
      mockText = "Catalog #: 943123265\nDescription: HP Elite Mini 800 G9 i712700 8GB/256";
    } else if (sampleIndex === 2) {
      mockText = "943121160\nHP EDK 800G6 DM i7-10700 16GB/512GB\nבעל מצאי: ניסים";
    } else {
      mockText = "Catalog #: 943188334\nDescription: Lenovo ThinkPad P16s G2";
    }

    const parsed = parseLabelText(mockText);
    setScannedMasha(parsed.masha || '');
    setDetectedDescription(parsed.productDescription || '');
    setDetectedOwner(parsed.stickerOwner || '');

    // Check if known in official database
    if (parsed.masha) {
      try {
        const lookup = await lookupItem(undefined, parsed.masha);
        if (lookup.found) {
          setDetectedDescription(lookup.item.description);
        }
      } catch (err) {}
    }

    // Move to step 2: Scan S/N
    setCurrentStep('scan_sn');
  };

  // Simulated CV detection of Manufacturer OEM S/N barcode (Back/Bottom label)
  const simulateDetectSn = async (sn: string) => {
    setScannedSn(sn);
    await handleCompleteItemScan(sn, scannedMasha, detectedDescription, detectedOwner);
  };

  const handleManualSubmit = async () => {
    if (!manualSn || !manualMasha) {
      Alert.alert('שגיאה', 'יש למלא מספר סידורי ומסח"א');
      return;
    }
    await handleCompleteItemScan(manualSn, manualMasha, manualDesc, '');
    setManualSn('');
    setManualMasha('');
    setManualDesc('');
  };

  const handleCompleteItemScan = async (
    sn: string,
    masha: string,
    description: string,
    ownerText: string
  ) => {
    if (!selectedRoom) return;

    try {
      setLoading(true);
      const res = await submitScan({
        roomId: selectedRoom.id,
        serialNumber: sn,
        masha,
        scannedBy: sweeperName,
        stickerOwnerText: ownerText,
        productNameDetected: description,
      });

      if (res.status === 'duplicate') {
        Alert.alert('שימו לב ⚠️', `הפריט (${sn}) כבר נסרק בסריקה זו!`);
      } else {
        setScannedItemsCount(prev => prev + 1);
        setLastScannedItem(res.item);
      }

      resetCurrentScan();
      setCurrentStep('scan_masha');
    } catch (err: any) {
      Alert.alert('שגיאה', 'נכשל ברישום הסריקה מול השרת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* App Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>shelv.ai Scanner</Text>
        <Text style={styles.headerSubtitle}>
          {selectedRoom ? `סורק ב: ${selectedRoom.name}` : 'בחר חדר לביצוע סריקה'}
        </Text>
      </View>

      {/* Screen 1: Room Selection */}
      {currentStep === 'select_room' && (
        <ScrollView style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.label}>שם העובד הסורק:</Text>
            <TextInput
              style={styles.input}
              value={sweeperName}
              onChangeText={setSweeperName}
              placeholder="הזן שם עובד..."
              placeholderTextColor="#666"
            />
          </View>

          <Text style={styles.sectionTitle}>בחר חדר לסריקת מלאי (Sweep):</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#10b981" />
          ) : loadError ? (
            <View style={[styles.card, { borderColor: '#ef4444' }]}>
              <Text style={[styles.label, { color: '#f87171', textAlign: 'center' }]}>
                {loadError}
              </Text>
              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#10b981', marginTop: 10 }]}
                onPress={loadRooms}
              >
                <Text style={styles.simButtonText}>🔄 נסה שוב</Text>
              </TouchableOpacity>
            </View>
          ) : (
            rooms.map((room) => (
              <TouchableOpacity
                key={room.id}
                style={styles.roomItem}
                onPress={() => startSweepForRoom(room)}
              >
                <View>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <Text style={styles.roomHolder}>בעל מצאי: {room.holder_name}</Text>
                </View>
                <View style={styles.roomBadge}>
                  <Text style={styles.roomBadgeText}>{room.code}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Screen 2: Guided CV Step 1 (Masha Scan) */}
      {currentStep === 'scan_masha' && (
        <View style={styles.scanContainer}>
          <View style={styles.stepBanner}>
            <Text style={styles.stepBadge}>שלב 1 מתוך 2</Text>
            <Text style={styles.stepTitle}>כוון את המצלמה למדבקת המסח"א (Catalog #)</Text>
            <Text style={styles.stepHint}>
              חפש את המדבקה הלבנה בחזית או בחלק העליון של המחשב / הציוד
            </Text>
          </View>

          {/* Camera Viewfinder Mockup with CV Bounding Box */}
          <View style={styles.viewfinder}>
            <View style={styles.reticle} />
            <Text style={styles.viewfinderText}>מזהה תוויות וברקודים בזמן אמת...</Text>
          </View>

          {/* Quick Simulation Buttons for Demo / Testing */}
          <View style={styles.simControls}>
            <Text style={styles.simLabel}>סימולציית זיהוי מדבקה (Computer Vision):</Text>
            <TouchableOpacity
              style={styles.simButton}
              onPress={() => simulateDetectMasha(1)}
            >
              <Text style={styles.simButtonText}>📷 זהה: HP Elite Mini (מדבקת ספק)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.simButton}
              onPress={() => simulateDetectMasha(2)}
            >
              <Text style={styles.simButtonText}>📷 זהה: מדבקה בעברית (בעל מצאי: ניסים)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simButton, { backgroundColor: '#374151' }]}
              onPress={() => setCurrentStep('manual_entry')}
            >
              <Text style={styles.simButtonText}>⌨️ הקלדה ידנית</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Live Bar */}
          <View style={styles.bottomBar}>
            <Text style={styles.bottomBarText}>סה"כ נסרקו בסשן זה: {scannedItemsCount}</Text>
            <TouchableOpacity
              onPress={() => setCurrentStep('select_room')}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>סיום סריקה</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Screen 3: Guided CV Step 2 (S/N Scan) */}
      {currentStep === 'scan_sn' && (
        <View style={styles.scanContainer}>
          {/* Recognition Pill showing Step 1 Result */}
          <View style={styles.recognizedCard}>
            <Text style={styles.recognizedTag}>✅ מסח"א זוהה בהצלחה</Text>
            <Text style={styles.recognizedTitle}>
              {detectedDescription || 'HP Elite Business Equipment'}
            </Text>
            <Text style={styles.recognizedMasha}>מסח"א: {scannedMasha}</Text>
            {detectedOwner ? (
              <Text style={styles.recognizedOwner}>בעל מצאי מקורי: {detectedOwner}</Text>
            ) : null}
          </View>

          <View style={[styles.stepBanner, { backgroundColor: '#1e3a8a' }]}>
            <Text style={styles.stepBadge}>שלב 2 מתוך 2</Text>
            <Text style={styles.stepTitle}>כעת כוון לברקוד המספר הסידורי (S/N)</Text>
            <Text style={styles.stepHint}>
              נמצא בדרך כלל במדבקת היצרן השחורה בגב המכשיר או בתחתיתו
            </Text>
          </View>

          <View style={styles.viewfinder}>
            <View style={[styles.reticle, { borderColor: '#3b82f6' }]} />
            <Text style={styles.viewfinderText}>סורק ברקוד Serial No...</Text>
          </View>

          <View style={styles.simControls}>
            <Text style={styles.simLabel}>סימולציית זיהוי S/N היצרן:</Text>
            <TouchableOpacity
              style={[styles.simButton, { backgroundColor: '#2563eb' }]}
              onPress={() => simulateDetectSn('2UA80920XS')}
            >
              <Text style={styles.simButtonText}>⚡ ברקוד זוהה: S/N: 2UA80920XS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.simButton, { backgroundColor: '#2563eb' }]}
              onPress={() => simulateDetectSn('2UA4192N4X')}
            >
              <Text style={styles.simButtonText}>⚡ ברקוד זוהה: S/N: 2UA4192N4X</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Screen 4: Manual Entry Form */}
      {currentStep === 'manual_entry' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>הזנה ידנית של פריט</Text>
          <View style={styles.card}>
            <Text style={styles.label}>מסח"א (Catalog #):</Text>
            <TextInput
              style={styles.input}
              value={manualMasha}
              onChangeText={setManualMasha}
              placeholder="לדוגמה: 943121160"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />

            <Text style={styles.label}>מספר סידורי (S/N):</Text>
            <TextInput
              style={styles.input}
              value={manualSn}
              onChangeText={setManualSn}
              placeholder="לדוגמה: 2UA80920XS"
              placeholderTextColor="#666"
              autoCapitalize="characters"
            />

            <Text style={styles.label}>תיאור פריט (אופציונלי):</Text>
            <TextInput
              style={styles.input}
              value={manualDesc}
              onChangeText={setManualDesc}
              placeholder="לדוגמה: HP EliteDesk 800 G6"
              placeholderTextColor="#666"
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleManualSubmit}>
              <Text style={styles.submitButtonText}>שמור פריט בסריקה</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { marginTop: 12 }]}
              onPress={() => setCurrentStep('scan_masha')}
            >
              <Text style={styles.cancelButtonText}>חזרה לסורק המצלמה</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: '#0b0f19',
  },
  header: {
    padding: 16,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 16,
  },
  label: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#e5e7eb',
    marginBottom: 12,
    textAlign: 'right',
  },
  roomItem: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'right',
  },
  roomHolder: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
    textAlign: 'right',
  },
  roomBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  roomBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: 'bold',
  },
  scanContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  stepBanner: {
    backgroundColor: '#064e3b',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#059669',
  },
  stepBadge: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  stepTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 2,
    textAlign: 'right',
  },
  stepHint: {
    color: '#a7f3d0',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  viewfinder: {
    height: 180,
    backgroundColor: '#030712',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  reticle: {
    width: 140,
    height: 80,
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 8,
  },
  viewfinderText: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 10,
  },
  recognizedCard: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10b981',
    marginBottom: 8,
  },
  recognizedTag: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  recognizedTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 2,
  },
  recognizedMasha: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'right',
  },
  recognizedOwner: {
    color: '#fbbf24',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 2,
  },
  simControls: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  simLabel: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 8,
    textAlign: 'right',
  },
  simButton: {
    backgroundColor: '#059669',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    alignItems: 'center',
  },
  simButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  bottomBarText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  cancelButton: {
    padding: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});