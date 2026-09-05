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
  Modal,
  Image,
} from 'react-native';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { createWorker } from 'tesseract.js';
import { parseLabelText } from './src/services/labelParser';
import { fetchRooms, submitScan, lookupItem, scanWithGemini } from './src/services/api';

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
  const [recognizedLiveText, setRecognizedLiveText] = useState<string>('');
  const [lastOcrDiagnosis, setLastOcrDiagnosis] = useState<string>('');
  const [geminiAttempts, setGeminiAttempts] = useState(0);
  const [showScanGuideModal, setShowScanGuideModal] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [frozenImage, setFrozenImage] = useState<string | null>(null);
  const [isProcessingFound, setIsProcessingFound] = useState(false);
  const [foundInfoText, setFoundInfoText] = useState<string>('');
  const geminiAttemptsRef = useRef(0);

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

  // Video, camera, and file input refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<any>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isHandlingBarcodeRef = useRef<boolean>(false);
  const liveOcrIntervalRef = useRef<any>(null);
  const isOcrRunningRef = useRef<boolean>(false);
  const ocrWorkerRef = useRef<any>(null);
  const isWorkerInitializingRef = useRef<boolean>(false);

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
    setRecognizedLiveText('');
    setLastOcrDiagnosis('');
    setScanError(null);
    setFrozenImage(null);
    setIsProcessingFound(false);
    setFoundInfoText('');
    setGeminiAttempts(0);
    geminiAttemptsRef.current = 0;
    isHandlingBarcodeRef.current = false;
  };

  const stopLiveOcrStream = () => {
    if (liveOcrIntervalRef.current) {
      clearInterval(liveOcrIntervalRef.current);
      liveOcrIntervalRef.current = null;
    }
    isOcrRunningRef.current = false;
  };

  const stopLiveCamera = () => {
    stopLiveOcrStream();
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
    setScanningStatus(currentStep === 'scan_sn' ? 'מכוון לברקוד סידורי (S/N)...' : 'מכוון למדבקת מסח"א / Catalog # (זיהוי טקסט בלבד)...');

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
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          // @ts-ignore
          advanced: [{ focusMode: 'continuous' }],
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      // Start appropriate scanner based on current step
      if (currentStep === 'scan_sn') {
        const controls = await readerRef.current.decodeFromVideoElement(
          videoRef.current,
          (result, error) => {
            if (result && !isHandlingBarcodeRef.current) {
              handleLiveBarcodeScanned(result.getText());
            }
          }
        );
        controlsRef.current = controls;
      } else if (currentStep === 'scan_masha') {
        // Start high-speed real-time Text Stream Detector (Hardware Accelerated)
        startLiveTextStreamScanner();
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraPermissionError(err.message || 'אין הרשאת גישה למצלמה בדפדפן');
    }
  };

  // Lazily get or create single shared Tesseract Worker (fast, no re-initialization lag)
  const getOrCreateOcrWorker = async () => {
    if (ocrWorkerRef.current) {
      return ocrWorkerRef.current;
    }
    if (isWorkerInitializingRef.current) {
      // Wait if already being created
      while (isWorkerInitializingRef.current) {
        await new Promise(res => setTimeout(res, 50));
      }
      return ocrWorkerRef.current;
    }

    try {
      isWorkerInitializingRef.current = true;
      const worker = await createWorker(['eng', 'heb']);
      ocrWorkerRef.current = worker;
      return worker;
    } catch (err) {
      console.warn('Failed to create OCR worker:', err);
      return null;
    } finally {
      isWorkerInitializingRef.current = false;
    }
  };

  // Continuous Hands-Free Gemini Vision Stream Detector
  // Runs continuously in the background whenever camera is pointed at equipment label!
  const startLiveTextStreamScanner = () => {
    stopLiveOcrStream();
    if (typeof window === 'undefined') return;

    // Canvas for live cropped frame extraction
    const streamCanvas = document.createElement('canvas');
    const streamCtx = streamCanvas.getContext('2d', { willReadFrequently: true });

    liveOcrIntervalRef.current = setInterval(async () => {
      if (currentStepRef.current !== 'scan_masha' || !videoRef.current || isOcrRunningRef.current) {
        return;
      }

      if (geminiAttemptsRef.current >= 10) {
        stopLiveOcrStream();
        setCameraActive(false);
        setShowScanGuideModal(true);
        return;
      }

      const video = videoRef.current;
      if (video.readyState < 2 || video.paused || video.ended) {
        return;
      }

      isOcrRunningRef.current = true;

      try {
        if (!streamCtx) return;

        const vw = video.videoWidth || 1280;
        const vh = video.videoHeight || 720;

        // Crop centered reticle area (75% of view) for focused high-detail extraction
        const cropW = Math.round(vw * 0.75);
        const cropH = Math.round(vh * 0.75);
        const cropX = Math.round((vw - cropW) / 2);
        const cropY = Math.round((vh - cropH) / 2);

        // Scale to 800px width for fast upload & instant Gemini Vision inference
        const targetW = 800;
        const targetH = Math.round((cropH / cropW) * targetW);

        if (streamCanvas.width !== targetW || streamCanvas.height !== targetH) {
          streamCanvas.width = targetW;
          streamCanvas.height = targetH;
        }

        streamCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
        const base64Jpg = streamCanvas.toDataURL('image/jpeg', 0.82);

        geminiAttemptsRef.current += 1;
        const attemptNum = geminiAttemptsRef.current;
        setGeminiAttempts(attemptNum);

        setScanningStatus(`✨ Gemini סורק (${attemptNum}/10)...`);
        const geminiRes = await scanWithGemini(base64Jpg);

        if (currentStepRef.current !== 'scan_masha') return;

        if (geminiRes.rawText) {
          setRecognizedLiveText(geminiRes.rawText);
        }

        if (geminiRes.masha) {
          // Freeze the live frame immediately!
          setFrozenImage(base64Jpg);
          setIsProcessingFound(true);
          setFoundInfoText(`מסח"א ${geminiRes.masha}${geminiRes.productDescription ? ` • ${geminiRes.productDescription}` : ''}`);
          stopLiveOcrStream();
          setScanningStatus(`⚡ נתונים זוהו! מעבד פרטי מסח"א: ${geminiRes.masha}...`);
          setLastOcrDiagnosis(`✨ [Gemini Vision] זוהה מסח"א: ${geminiRes.masha}${geminiRes.productDescription ? ` | ${geminiRes.productDescription}` : ''}`);

          await onMashaRecognized({
            masha: geminiRes.masha,
            productDescription: geminiRes.productDescription,
            stickerOwner: geminiRes.stickerOwner,
            serialNumber: geminiRes.serialNumber,
          });
          return;
        } else if (geminiRes.rawText) {
          setLastOcrDiagnosis(`👀 נקלט טקסט: ${geminiRes.rawText}`);
        } else {
          setScanningStatus(`סורק פעיל (${attemptNum}/10) - כוון למדבקה / מסח"א...`);
        }

        // If after this attempt we hit 10 and still haven't recognized
        if (geminiAttemptsRef.current >= 10) {
          stopLiveOcrStream();
          setCameraActive(false);
          setShowScanGuideModal(true);
          return;
        }
      } catch (streamErr: any) {
        console.warn('Live Gemini scan tick warning:', streamErr.message);
        const errMsg = streamErr?.message || 'שגיאה בתקשורת עם שירות הפענוח';
        setScanError(`שגיאה בפענוח: ${errMsg}`);
        setScanningStatus(`⚠️ שגיאה בפענוח: ${errMsg}`);
      } finally {
        isOcrRunningRef.current = false;
      }
    }, 750); // Continuous live inspection every 750ms
  };

  const handleLiveBarcodeScanned = async (barcodeText: string) => {
    if (!barcodeText || isHandlingBarcodeRef.current) return;
    // Disallow ANY barcode scanning when in Masha step. Masha MUST be recognized via OCR/Text only!
    if (currentStepRef.current !== 'scan_sn') {
      return;
    }

    const cleanText = barcodeText.trim();
    if (!cleanText) return;

    isHandlingBarcodeRef.current = true;
    
    // Stop barcode decoding while processing
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {}
      controlsRef.current = null;
    }

    // Capture frozen frame snapshot of the video feed for smooth UX feedback
    if (videoRef.current) {
      try {
        const video = videoRef.current;
        const vw = video.videoWidth || 1280;
        const vh = video.videoHeight || 720;
        const canvas = document.createElement('canvas');
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, vw, vh);
          setFrozenImage(canvas.toDataURL('image/jpeg', 0.85));
        }
      } catch (e) {
        console.warn('Could not capture freeze frame for SN:', e);
      }
    }

    // Parse serial number from scanned barcode
    const parsed = parseLabelText(cleanText);
    const snVal = parsed.serialNumber || cleanText.toUpperCase();

    // Show processing feedback matching Masha detection UX
    setIsProcessingFound(true);
    setFoundInfoText(`מספר סידורי (S/N): ${snVal}`);
    setScanningStatus(`⚡ ברקוד נקלט: ${snVal}! מעבד ושומר במערכת...`);

    // Provide haptic feedback if available on mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(80);
      } catch (e) {}
    }

    setScannedSn(snVal);

    // Give user time to see the frozen snapshot and success overlay
    await new Promise(res => setTimeout(res, 850));

    await handleCompleteItemScan(
      snVal,
      scannedMashaRef.current,
      detectedDescRef.current,
      detectedOwnerRef.current
    );

    isHandlingBarcodeRef.current = false;
  };

  // Shared handler when valid Masha is recognized (via stream, snapshot, or photo upload)
  const onMashaRecognized = async (parsed: ReturnType<typeof parseLabelText>) => {
    if (!parsed.masha) return;
    stopLiveOcrStream();

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
      setIsProcessingFound(false);
      setFrozenImage(null);
      setCurrentStep('scan_sn');
    }, 1200);
  };

  // Process any image source (canvas or image element) with Tesseract across multiple angles
  // Process any image source (canvas or image element) with Gemini Vision
  const processImageForOcr = async (sourceCanvas: HTMLCanvasElement) => {
    if (geminiAttemptsRef.current >= 10) {
      stopLiveOcrStream();
      setCameraActive(false);
      setShowScanGuideModal(true);
      return;
    }

    try {
      setOcrLoading(true);
      geminiAttemptsRef.current += 1;
      const attemptNum = geminiAttemptsRef.current;
      setGeminiAttempts(attemptNum);

      setScanningStatus(`✨ שולח לפענוח ראייה ממוחשבת באמצעות Gemini Vision (${attemptNum}/10)...`);

      const base64Jpg = sourceCanvas.toDataURL('image/jpeg', 0.88);
      const geminiRes = await scanWithGemini(base64Jpg);

      if (geminiRes.rawText) {
        setRecognizedLiveText(geminiRes.rawText);
      }

      if (geminiRes.masha) {
        setFrozenImage(base64Jpg);
        setIsProcessingFound(true);
        setFoundInfoText(`מסח"א ${geminiRes.masha}${geminiRes.productDescription ? ` • ${geminiRes.productDescription}` : ''}`);
        stopLiveOcrStream();
        setScanningStatus(`⚡ נתונים זוהו! מעבד פרטי מסח"א: ${geminiRes.masha}...`);
        setLastOcrDiagnosis(`✨ [Gemini Vision] זוהה מסח"א: ${geminiRes.masha}${geminiRes.productDescription ? ` | ${geminiRes.productDescription}` : ''}${geminiRes.stickerOwner ? ` | בעלים: ${geminiRes.stickerOwner}` : ''}`);
        await onMashaRecognized({
          masha: geminiRes.masha,
          productDescription: geminiRes.productDescription,
          stickerOwner: geminiRes.stickerOwner,
          serialNumber: geminiRes.serialNumber,
        });
      } else {
        setScanningStatus(`לא זוהה מסח"א ברור (${attemptNum}/10). נסה שוב או קרב את העדשה למדבקה`);
        setLastOcrDiagnosis(`⚠️ נקלט טקסט: ${geminiRes.rawText || 'לא זוהה טקסט ברור'}`);
        if (geminiAttemptsRef.current >= 10) {
          stopLiveOcrStream();
          setCameraActive(false);
          setShowScanGuideModal(true);
        }
      }
    } catch (err: any) {
      console.error('Gemini Vision scan error:', err);
      const errMsg = err?.message || 'פענוח נכשל';
      setScanError(`שגיאה בפענוח Gemini: ${errMsg}`);
      setScanningStatus(`שגיאה במהלך פענוח Gemini Vision: ${errMsg}`);
      setLastOcrDiagnosis(`❌ שגיאה בפענוח: ${errMsg}`);
      Alert.alert('שגיאת פענוח', `אירעה שגיאה בסריקה: ${errMsg}`);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleResumeScanning = () => {
    setShowScanGuideModal(false);
    setScanError(null);
    geminiAttemptsRef.current = 0;
    setGeminiAttempts(0);
    setCameraActive(true);
    setScanningStatus('מאתחל סריקה... כוון את המצלמה למדבקה');
  };

  // Multi-angle capture directly from live video frame
  const captureAndRecognizeHandwrittenMasha = async () => {
    if (!videoRef.current) {
      Alert.alert('שגיאה', 'המצלמה אינה פעילה');
      return;
    }

    try {
      const video = videoRef.current;
      const srcWidth = video.videoWidth || 1920;
      const srcHeight = video.videoHeight || 1080;

      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = srcWidth;
      baseCanvas.height = srcHeight;
      const baseCtx = baseCanvas.getContext('2d');
      if (!baseCtx) throw new Error('Failed to get 2D context');
      baseCtx.drawImage(video, 0, 0, srcWidth, srcHeight);

      await processImageForOcr(baseCanvas);
    } catch (err: any) {
      console.error('Video capture error:', err);
      Alert.alert('שגיאה בצילום פריים', err.message || 'לא ניתן לצלם מהמצלמה החיה');
    }
  };

  // High-Resolution Native Camera / Photo File Handler
  const handlePhotoSelected = async (event: any) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    try {
      setOcrLoading(true);
      setScanningStatus('טוען תמונת HD מהמכשיר...');

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;

      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = (e) => reject(new Error('טעינת התמונה נכשלה'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);

      // Reset file input value so user can take another photo if needed
      if (event.target) event.target.value = '';

      await processImageForOcr(canvas);
    } catch (err: any) {
      console.error('File photo error:', err);
      Alert.alert('שגיאה בטעינת תמונה', err.message || 'לא ניתן לעבד את התמונה');
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
            <Text style={styles.stepTitle}>כוון את המצלמה למדבקה (סריקה אוטומטית)</Text>
            <Text style={styles.stepHint}>
              זיהוי רציף אוטומטי ללא לחיצה: כוון את העדשה למסח"א / Catalog #, המערכת תזהה ותעבור מיד לשלב הבא!
            </Text>
          </View>

          {/* Real Camera Viewfinder */}
          <View style={styles.viewfinder}>
            {frozenImage ? (
              <Image
                source={{ uri: frozenImage }}
                style={styles.frozenImageStyle}
                resizeMode="cover"
              />
            ) : cameraActive ? (
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

            {/* Processing Overlay when Gemini finds something */}
            {isProcessingFound ? (
              <View style={styles.processingOverlay}>
                <View style={styles.processingModalCard}>
                  <View style={styles.processingPulseBadge}>
                    <ActivityIndicator size="large" color="#10b981" />
                  </View>
                  <Text style={styles.processingTitle}>✨ זוהה בהצלחה!</Text>
                  <Text style={styles.processingSubtitle}>התמונה הוקפאה והנתונים נבדקים ומעובדים במערכת...</Text>
                  {foundInfoText ? (
                    <View style={styles.processingDetailsBox}>
                      <Text style={styles.processingDetailsText}>{foundInfoText}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              /* Viewfinder Reticle Overlay */
              <View style={styles.reticleOverlay} pointerEvents="none">
                <View style={styles.reticle} />
                <View style={styles.scanLaser} />
              </View>
            )}

            {cameraPermissionError && !frozenImage ? (
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

          {/* User Scan Error Notification Banner */}
          {scanError ? (
            <View style={styles.scanErrorNotification}>
              <Text style={styles.scanErrorNotificationText}>⚠️ {scanError}</Text>
              <TouchableOpacity
                style={styles.dismissScanErrorBtn}
                onPress={() => setScanError(null)}
              >
                <Text style={styles.dismissScanErrorText}>סגור ✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Live Scanner Real-time Status Badge */}
          <View style={styles.statusPill}>
            {ocrLoading ? (
              <ActivityIndicator size="small" color="#34d399" style={{ marginRight: 8 }} />
            ) : (
              <View style={[styles.liveDot, { backgroundColor: '#10b981', marginRight: 8 }]} />
            )}
            <Text style={styles.statusPillText}>{scanningStatus}</Text>
          </View>

          {/* OCR Action Buttons (Secondary backup if needed) */}
          <View style={styles.ocrButtonsContainer}>
            <TouchableOpacity
              style={[styles.nativeCameraButton, { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 }]}
              onPress={() => fileInputRef.current?.click()}
              disabled={ocrLoading}
            >
              <Text style={[styles.nativeCameraText, { color: '#94a3b8' }]}>📷 גיבוי: צילום תמונת HD ידנית</Text>
            </TouchableOpacity>

            {/* Hidden native camera/gallery file input */}
            <input
              type="file"
              ref={fileInputRef as any}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handlePhotoSelected}
            />
          </View>

          {/* Real-time OCR Text Inspection Panel */}
          {(recognizedLiveText || lastOcrDiagnosis) ? (
            <View style={styles.ocrInspectionCard}>
              <View style={styles.ocrInspectionHeader}>
                <Text style={styles.ocrInspectionTitle}>🔍 טקסט שפוענח מהמדבקה בזמן אמת:</Text>
                <TouchableOpacity onPress={() => { setRecognizedLiveText(''); setLastOcrDiagnosis(''); }}>
                  <Text style={styles.ocrInspectionClear}>נקה ✕</Text>
                </TouchableOpacity>
              </View>

              {lastOcrDiagnosis ? (
                <View style={styles.ocrDiagnosisBox}>
                  <Text style={styles.ocrDiagnosisText}>{lastOcrDiagnosis}</Text>
                </View>
              ) : null}

              {recognizedLiveText ? (
                <ScrollView style={styles.ocrRawTextScroll} nestedScrollEnabled>
                  <Text style={styles.ocrRawTextContent}>{recognizedLiveText}</Text>
                </ScrollView>
              ) : null}

              <Text style={styles.ocrInspectionTip}>
                💡 אם המסח"א לא מזוהה: ודא שהמספר ברור ומואר, או לחץ על כפתור הצילום הכחול כדי לצלם תמונת HD חדה.
              </Text>
            </View>
          ) : null}

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

          {/* User Scan Error Notification Banner */}
          {scanError ? (
            <View style={styles.scanErrorNotification}>
              <Text style={styles.scanErrorNotificationText}>⚠️ {scanError}</Text>
              <TouchableOpacity
                style={styles.dismissScanErrorBtn}
                onPress={() => setScanError(null)}
              >
                <Text style={styles.dismissScanErrorText}>סגור ✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Live Scanner Real-time Status */}
          <View style={[styles.statusPill, { borderColor: '#3b82f6', flexDirection: 'row', justifyContent: 'center' }]}>
            <View style={[styles.liveDot, { backgroundColor: '#3b82f6', marginRight: 8 }]} />
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

      {/* Modal: Teaching User How To Scan Correctly (Triggered after 10 failed Gemini calls) */}
      <Modal
        visible={showScanGuideModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowScanGuideModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>💡</Text>
              <Text style={styles.modalTitle}>איך לסרוק נכון ומדויק?</Text>
              <Text style={styles.modalSubtitle}>
                הסריקה האוטומטית נעצרה לאחר 10 ניסיונות לחיסכון בעלויות AI
              </Text>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.tipItem}>
                <Text style={styles.tipNumber}>1️⃣</Text>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>תאורה טובה וללא השתקפות</Text>
                  <Text style={styles.tipDesc}>
                    ודא שהמדבקה מוארת היטב. הימנע מהשתקפות ישירה של פלורסנט או פלאש שמסתירה את הספרות.
                  </Text>
                </View>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipNumber}>2️⃣</Text>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>קרב את המצלמה למדבקה (10-15 ס"מ)</Text>
                  <Text style={styles.tipDesc}>
                    קרב את העדשה כך שמספר המסח"א (Catalog #) יתפוס את מרכז המסגרת ויהיה בפוקוס חד.
                  </Text>
                </View>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipNumber}>3️⃣</Text>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>החזק את המכשיר יציב לשנייה אחת</Text>
                  <Text style={styles.tipDesc}>
                    טשטוש תנועה מונע מבינת ה-AI לפענח את המספר. עצור את התנועה לרגע מול המדבקה.
                  </Text>
                </View>
              </View>

              <View style={styles.tipItem}>
                <Text style={styles.tipNumber}>4️⃣</Text>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>מדבקה שחוקה או מטושטשת?</Text>
                  <Text style={styles.tipDesc}>
                    אם המדבקה פגומה, ניתן תמיד להשתמש בכפתור "הקלדה ידנית" במקום להמשיך לסרוק.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={handleResumeScanning}
              >
                <Text style={styles.modalPrimaryBtnText}>🔄 הבנתי, הפעל מצלמה ונסה שוב</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => {
                  setShowScanGuideModal(false);
                  setCurrentStep('manual_entry');
                }}
              >
                <Text style={styles.modalSecondaryBtnText}>⌨️ מעבר להזנה ידנית</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    height: 380,
    backgroundColor: '#030712',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
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
    width: 290,
    height: 170,
    borderWidth: 2.5,
    borderColor: '#10b981',
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  scanLaser: {
    position: 'absolute',
    width: 260,
    height: 2,
    backgroundColor: '#10b981',
    opacity: 0.85,
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
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderWidth: 1.5,
    borderColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  statusPillText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700',
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
  ocrButtonsContainer: {
    marginBottom: 8,
    gap: 6,
  },
  ocrCaptureButton: {
    backgroundColor: '#0d9488',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#14b8a6',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  nativeCameraButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#60a5fa',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  nativeCameraText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
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
  ocrInspectionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    padding: 12,
    marginBottom: 10,
  },
  ocrInspectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ocrInspectionTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  ocrInspectionClear: {
    color: '#94a3b8',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ocrDiagnosisBox: {
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
  },
  ocrDiagnosisText: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 18,
  },
  ocrRawTextScroll: {
    maxHeight: 110,
    backgroundColor: '#020617',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ocrRawTextContent: {
    color: '#a5f3fc',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'left',
    lineHeight: 16,
  },
  ocrInspectionTip: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'right',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    padding: 20,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 14,
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 19,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    color: '#f59e0b',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 18,
  },
  modalBody: {
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderRightWidth: 3,
    borderRightColor: '#38bdf8',
  },
  tipNumber: {
    fontSize: 20,
    marginLeft: 10,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 4,
  },
  tipDesc: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
  modalActions: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  modalPrimaryBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalSecondaryBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  scanErrorNotification: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scanErrorNotificationText: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  dismissScanErrorBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  dismissScanErrorText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: 'bold',
  },
  frozenImageStyle: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3, 7, 18, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    zIndex: 20,
  },
  processingModalCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#10b981',
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    width: '90%',
    maxWidth: 320,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  processingPulseBadge: {
    marginBottom: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 50,
    padding: 10,
  },
  processingTitle: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  processingSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  processingDetailsBox: {
    marginTop: 12,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#374151',
    width: '100%',
  },
  processingDetailsText: {
    color: '#e5e7eb',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});