import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { createWorker } from 'tesseract.js';
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

  // Real Camera & Scanner state
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [scanningStatus, setScanningStatus] = useState<string>('סורק פעיל וממתין לברקוד...');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [ocrLoading, setOcrLoading] = useState(false);

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

  // Video and barcode reader refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<any>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const isHandlingBarcodeRef = useRef<boolean>(false);

  // Keep a ref of the current step for barcode callback
  const currentStepRef = useRef<Step>(currentStep);
  currentStepRef.current = currentStep;

  const scannedMashaRef = useRef<string>(scannedMasha);
  scannedMashaRef.current = scannedMasha;

  const detectedDescRef = useRef<string>(detectedDescription);
  detectedDescRef.current = detectedDescription;

  const detectedOwnerRef = useRef<string>(detectedOwner);
  detectedOwnerRef.current = detectedOwner;

  useEffect(() => {
    loadRooms();
  }, []);

  // Initialize and clean up camera when entering / leaving scanning steps
  useEffect(() => {
    const isScanningStep = currentStep === 'scan_masha' || currentStep === 'scan_sn';
    if (isScanningStep && cameraActive) {
      startLiveCamera();
    } else {
      stopLiveCamera();
    }

    return () => {
      stopLiveCamera();
    };
  }, [currentStep, cameraActive, facingMode]);

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
    setScanningStatus('סורק פעיל וממתין לברקוד מסח"א...');
  };

  const resetCurrentScan = () => {
    setScannedMasha('');
    setScannedSn('');
    setDetectedDescription('');
    setDetectedOwner('');
    isHandlingBarcodeRef.current = false;
  };

  const stopLiveCamera = () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {}
      controlsRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      streamRef.current = null;
    }
  };

  const startLiveCamera = async () => {
    if (Platform.OS !== 'web' && typeof navigator === 'undefined') {
      return;
    }

    setCameraPermissionError(null);
    setScanningStatus(currentStep === 'scan_sn' ? 'מכוון לברקוד סידורי (S/N)...' : 'מכוון למדבקת מסח"א / ברקוד...');

    try {
      stopLiveCamera();

      if (!readerRef.current) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.ITF,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        readerRef.current = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 250,
        });
      }

      // Allow DOM video element to attach if not yet mounted
      await new Promise(res => setTimeout(res, 80));

      if (!videoRef.current) {
        // Find existing video element in DOM if ref didn't catch it
        const domVideo = document.getElementById('shelv-scanner-video') as HTMLVideoElement;
        if (domVideo) {
          videoRef.current = domVideo;
        }
      }

      if (!videoRef.current) {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      // Start continuous scanning
      const controls = await readerRef.current.decodeFromVideoElement(
        videoRef.current,
        (result, error) => {
          if (result && !isHandlingBarcodeRef.current) {
            handleLiveBarcodeScanned(result.getText());
          }
        }
      );
      controlsRef.current = controls;
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraPermissionError(err.message || 'אין הרשאת גישה למצלמה בדפדפן');
    }
  };

  const handleLiveBarcodeScanned = async (barcodeText: string) => {
    if (!barcodeText || isHandlingBarcodeRef.current) return;
    const cleanText = barcodeText.trim();
    if (!cleanText) return;

    isHandlingBarcodeRef.current = true;
    setScanningStatus(`ברקוד נקלט: ${cleanText}`);

    // Provide haptic feedback if available on mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(80);
      } catch (e) {}
    }

    if (currentStepRef.current === 'scan_masha') {
      // Step 1: Masha scan
      const parsed = parseLabelText(cleanText);
      const detectedMashaVal = parsed.masha || (cleanText.length >= 6 && cleanText.length <= 15 ? cleanText : '');
      
      let desc = parsed.productDescription || '';
      if (detectedMashaVal) {
        try {
          const lookup = await lookupItem(undefined, detectedMashaVal);
          if (lookup.found && lookup.item) {
            desc = lookup.item.description;
          }
        } catch (e) {}
      }

      setScannedMasha(detectedMashaVal || cleanText);
      setDetectedDescription(desc);
      setDetectedOwner(parsed.stickerOwner || '');

      setScanningStatus(`מסח"א ${detectedMashaVal || cleanText} זוהה! עבור לברקוד S/N...`);

      setTimeout(() => {
        setCurrentStep('scan_sn');
        isHandlingBarcodeRef.current = false;
      }, 500);

    } else if (currentStepRef.current === 'scan_sn') {
      // Step 2: S/N scan
      const parsed = parseLabelText(cleanText);
      const snVal = parsed.serialNumber || cleanText.toUpperCase();

      setScannedSn(snVal);
      setScanningStatus(`S/N ${snVal} נסרק! שומר במערכת...`);

      await handleCompleteItemScan(
        snVal,
        scannedMashaRef.current,
        detectedDescRef.current,
        detectedOwnerRef.current
      );

      isHandlingBarcodeRef.current = false;
    }
  };

  // Real OCR capture for handwritten or printed label text from live video frame
  const captureAndRecognizeHandwrittenMasha = async () => {
    if (!videoRef.current) {
      Alert.alert('שגיאה', 'המצלמה אינה פעילה');
      return;
    }

    try {
      setOcrLoading(true);
      setScanningStatus('מבצע צילום וסריקת OCR (זיהוי כתב יד / טקסט)...');

      const video = videoRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context');

      ctx.drawImage(video, 0, 0, width, height);

      // Apply image enhancement for handwriting (grayscale + contrast boost)
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const contrast = (v - 128) * 1.5 + 128;
        const finalVal = Math.min(255, Math.max(0, contrast));
        d[i] = finalVal;
        d[i + 1] = finalVal;
        d[i + 2] = finalVal;
      }
      ctx.putImageData(imgData, 0, 0);

      // Run Tesseract OCR on processed canvas
      const worker = await createWorker(['eng', 'heb']);
      const ret = await worker.recognize(canvas);
      await worker.terminate();

      const recognizedText = ret.data.text || '';
      console.log('[OCR Result]:', recognizedText);

      const parsed = parseLabelText(recognizedText);

      if (parsed.masha) {
        let desc = parsed.productDescription || '';
        try {
          const lookup = await lookupItem(undefined, parsed.masha);
          if (lookup.found && lookup.item) {
            desc = lookup.item.description;
          }
        } catch (e) {}

        setScannedMasha(parsed.masha);
        setDetectedDescription(desc);
        setDetectedOwner(parsed.stickerOwner || '');
        setScanningStatus(`מסח"א ${parsed.masha} פוענח בהצלחה! עבור ל-S/N...`);

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(80); } catch (e) {}
        }

        setTimeout(() => {
          setCurrentStep('scan_sn');
        }, 600);
      } else {
        setScanningStatus('לא זוהה מסח"א ברור בתמונה. נסה שוב או הקלד ידנית');
        Alert.alert(
          'זיהוי טקסט (OCR)',
          recognizedText.trim()
            ? `הטקסט שנקלט:\n"${recognizedText.trim().substring(0, 150)}"\n\nלא אותר מספר מסח"א (8-10 ספרות). ודא שהמספר ברור ומואר היטב.`
            : 'לא זוהה טקסט בפריים. קרב את המצלמה למדבקה ונסה שוב.'
        );
      }
    } catch (err: any) {
      console.error('OCR error:', err);
      setScanningStatus('שגיאה במהלך פענוח OCR');
      Alert.alert('שגיאה בסריקת כתב יד', err.message || 'פענוח OCR נכשל');
    } finally {
      setOcrLoading(false);
    }
  };

  // Simulated CV detection of Masha sticker (Fallback/Demo helper)
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

    if (parsed.masha) {
      try {
        const lookup = await lookupItem(undefined, parsed.masha);
        if (lookup.found && lookup.item) {
          setDetectedDescription(lookup.item.description);
        }
      } catch (err) {}
    }

    setCurrentStep('scan_sn');
  };

  // Simulated CV detection of Manufacturer OEM S/N barcode (Fallback/Demo helper)
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
            <View style={styles.stepBadgeRow}>
              <View style={styles.liveIndicator}>
                <View style={[styles.liveDot, { backgroundColor: cameraActive ? '#10b981' : '#ef4444' }]} />
                <Text style={styles.liveText}>{cameraActive ? 'מצלמה חיה פעילה' : 'מצלמה כבויה'}</Text>
              </View>
              <Text style={styles.stepBadge}>שלב 1 מתוך 2</Text>
            </View>
            <Text style={styles.stepTitle}>כוון את המצלמה למדבקת המסח"א (Catalog #)</Text>
            <Text style={styles.stepHint}>
              חפש את הברקוד או המספר במדבקה הלבנה בחזית המכשיר
            </Text>
          </View>

          {/* Real Camera Viewfinder */}
          <View style={styles.viewfinder}>
            {cameraActive ? (
              <video
                id="shelv-scanner-video"
                ref={videoRef as any}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 14,
                } as any}
                autoPlay
                playsInline
                muted
              />
            ) : (
              <View style={styles.cameraPausedView}>
                <Text style={styles.cameraPausedText}>המצלמה מושהית</Text>
              </View>
            )}

            {/* Viewfinder Reticle Overlay */}
            <View style={styles.reticleOverlay} pointerEvents="none">
              <View style={styles.reticle} />
              <View style={styles.scanLaser} />
            </View>

            {cameraPermissionError ? (
              <View style={styles.cameraErrorBanner}>
                <Text style={styles.cameraErrorText}>⚠️ {cameraPermissionError}</Text>
                <TouchableOpacity
                  style={styles.retryCameraButton}
                  onPress={startLiveCamera}
                >
                  <Text style={styles.retryCameraText}>🔄 אשר גישה ונסה שוב</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Live Scanner Real-time Status */}
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{scanningStatus}</Text>
          </View>

          {/* Prominent OCR Action Button for Handwritten Stickers */}
          <TouchableOpacity
            style={[styles.ocrCaptureButton, ocrLoading && styles.ocrCaptureButtonDisabled]}
            onPress={captureAndRecognizeHandwrittenMasha}
            disabled={ocrLoading}
          >
            {ocrLoading ? (
              <View style={styles.ocrLoadingRow}>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.ocrCaptureButtonText}>מפענח טקסט וכתב יד מתוך הפריים (OCR)...</Text>
              </View>
            ) : (
              <Text style={styles.ocrCaptureButtonText}>✍️ צלם וזהה מסח"א כתוב ידנית (OCR)</Text>
            )}
          </TouchableOpacity>

          {/* Real Scanner Controls + Fallback Tools */}
          <View style={styles.scannerControls}>
            <View style={styles.quickToolsRow}>
              <TouchableOpacity
                style={styles.quickToolBtn}
                onPress={() => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))}
              >
                <Text style={styles.quickToolBtnText}>🔄 הפוך מצלמה</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickToolBtn}
                onPress={() => setCameraActive(prev => !prev)}
              >
                <Text style={styles.quickToolBtnText}>{cameraActive ? '⏸️ השהה מצלמה' : '▶️ הפעל מצלמה'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickToolBtn, { backgroundColor: '#374151' }]}
                onPress={() => setCurrentStep('manual_entry')}
              >
                <Text style={styles.quickToolBtnText}>⌨️ הקלדה ידנית</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Demo Helpers if testing in desktop browser without barcode labels */}
            <View style={styles.simControls}>
              <Text style={styles.simLabel}>דוגמאות מהירות לבדיקה בלחיצה אחת:</Text>
              <View style={styles.quickSimRow}>
                <TouchableOpacity
                  style={styles.simButtonCompact}
                  onPress={() => simulateDetectMasha(1)}
                >
                  <Text style={styles.simButtonText}>🏷️ 943123265 (HP Mini)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.simButtonCompact}
                  onPress={() => simulateDetectMasha(2)}
                >
                  <Text style={styles.simButtonText}>🏷️ 943121160 (ניסים)</Text>
                </TouchableOpacity>
              </View>
            </View>
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
              {detectedDescription || 'פריט מזוהה'}
            </Text>
            <Text style={styles.recognizedMasha}>מסח"א: {scannedMasha}</Text>
            {detectedOwner ? (
              <Text style={styles.recognizedOwner}>בעל מצאי מקורי: {detectedOwner}</Text>
            ) : null}
          </View>

          <View style={[styles.stepBanner, { backgroundColor: '#1e3a8a' }]}>
            <View style={styles.stepBadgeRow}>
              <View style={styles.liveIndicator}>
                <View style={[styles.liveDot, { backgroundColor: cameraActive ? '#3b82f6' : '#ef4444' }]} />
                <Text style={styles.liveText}>{cameraActive ? 'מצלמה חיה פעילה' : 'מצלמה כבויה'}</Text>
              </View>
              <Text style={[styles.stepBadge, { color: '#93c5fd' }]}>שלב 2 מתוך 2</Text>
            </View>
            <Text style={styles.stepTitle}>כעת כוון לברקוד המספר הסידורי (S/N)</Text>
            <Text style={[styles.stepHint, { color: '#bfdbfe' }]}>
              נמצא בדרך כלל במדבקת היצרן בגב המכשיר או בתחתיתו
            </Text>
          </View>

          {/* Real Camera Viewfinder */}
          <View style={styles.viewfinder}>
            {cameraActive ? (
              <video
                id="shelv-scanner-video"
                ref={videoRef as any}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 14,
                } as any}
                autoPlay
                playsInline
                muted
              />
            ) : (
              <View style={styles.cameraPausedView}>
                <Text style={styles.cameraPausedText}>המצלמה מושהית</Text>
              </View>
            )}

            <View style={styles.reticleOverlay} pointerEvents="none">
              <View style={[styles.reticle, { borderColor: '#3b82f6' }]} />
              <View style={[styles.scanLaser, { backgroundColor: '#3b82f6' }]} />
            </View>

            {cameraPermissionError ? (
              <View style={styles.cameraErrorBanner}>
                <Text style={styles.cameraErrorText}>⚠️ {cameraPermissionError}</Text>
                <TouchableOpacity
                  style={styles.retryCameraButton}
                  onPress={startLiveCamera}
                >
                  <Text style={styles.retryCameraText}>🔄 אשר גישה ונסה שוב</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Live Scanner Real-time Status */}
          <View style={[styles.statusPill, { borderColor: '#3b82f6' }]}>
            <Text style={[styles.statusPillText, { color: '#93c5fd' }]}>{scanningStatus}</Text>
          </View>

          {/* Real Scanner Controls + Fallback Tools */}
          <View style={styles.scannerControls}>
            <View style={styles.quickToolsRow}>
              <TouchableOpacity
                style={styles.quickToolBtn}
                onPress={() => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))}
              >
                <Text style={styles.quickToolBtnText}>🔄 הפוך מצלמה</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickToolBtn, { backgroundColor: '#1e40af' }]}
                onPress={() => setCurrentStep('manual_entry')}
              >
                <Text style={styles.quickToolBtnText}>⌨️ הקלדת S/N ידנית</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickToolBtn, { backgroundColor: '#374151' }]}
                onPress={() => setCurrentStep('scan_masha')}
              >
                <Text style={styles.quickToolBtnText}>↩️ חזרה למסח"א</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.simControls}>
              <Text style={styles.simLabel}>דוגמאות S/N לבדיקה בלחיצה:</Text>
              <View style={styles.quickSimRow}>
                <TouchableOpacity
                  style={[styles.simButtonCompact, { backgroundColor: '#2563eb' }]}
                  onPress={() => simulateDetectSn('2UA80920XS')}
                >
                  <Text style={styles.simButtonText}>⚡ 2UA80920XS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.simButtonCompact, { backgroundColor: '#2563eb' }]}
                  onPress={() => simulateDetectSn('2UA4192N4X')}
                >
                  <Text style={styles.simButtonText}>⚡ 2UA4192N4X</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  stepBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  liveText: {
    color: '#e5e7eb',
    fontSize: 11,
    fontWeight: '500',
  },
  viewfinder: {
    height: 240,
    backgroundColor: '#030712',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraPausedView: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  cameraPausedText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  reticleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticle: {
    width: 220,
    height: 120,
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  scanLaser: {
    position: 'absolute',
    width: 200,
    height: 2,
    backgroundColor: '#10b981',
    opacity: 0.8,
  },
  cameraErrorBanner: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cameraErrorText: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  retryCameraButton: {
    marginTop: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  retryCameraText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusPill: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  statusPillText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scannerControls: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  quickToolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 8,
  },
  quickToolBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickToolBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
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
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  simLabel: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 6,
    textAlign: 'right',
  },
  quickSimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  simButtonCompact: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  simButtonText: {
    color: '#fff',
    fontSize: 11,
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
  ocrCaptureButton: {
    backgroundColor: '#0d9488',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#14b8a6',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  ocrCaptureButtonDisabled: {
    backgroundColor: '#134e4a',
    borderColor: '#0f766e',
    opacity: 0.7,
  },
  ocrCaptureButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  ocrLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simButton: {
    backgroundColor: '#059669',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    alignItems: 'center',
  },
});