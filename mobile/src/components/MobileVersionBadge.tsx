import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import {
  APP_VERSION,
  BRANCH_NAME,
  COMMIT_SHA,
  getFormattedBuildTime,
  getFullVersionSummary,
} from '../version';

interface MobileVersionBadgeProps {
  variant?: 'compact' | 'detailed';
}

export const MobileVersionBadge: React.FC<MobileVersionBadgeProps> = ({
  variant = 'compact',
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const formattedTime = getFormattedBuildTime();
  const hasCommit = Boolean(COMMIT_SHA && COMMIT_SHA !== 'dev' && COMMIT_SHA !== 'production');
  const hasBranch = Boolean(BRANCH_NAME && BRANCH_NAME !== 'main');

  const copyDetails = async () => {
    const summary = getFullVersionSummary();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      Alert.alert('הועתק בהצלחה ✓', summary);
    } catch {
      Alert.alert('פרטי גרסה', summary);
    }
  };

  const renderModal = () => (
    <Modal
      visible={modalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard} {...({ dir: 'rtl' } as any)}>
          <Text style={styles.modalTitle}>📦 מידע על גרסת המערכת</Text>

          <View style={styles.modalInfoRow}>
            <Text style={styles.modalLabel}>גרסת אפליקציה:</Text>
            <Text style={styles.modalValue}>v{APP_VERSION}</Text>
          </View>

          <View style={styles.modalInfoRow}>
            <Text style={styles.modalLabel}>ענף (Branch):</Text>
            <Text style={styles.modalValue}>{BRANCH_NAME || 'main'}</Text>
          </View>

          {COMMIT_SHA ? (
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalLabel}>Commit SHA:</Text>
              <Text style={[styles.modalValue, { fontFamily: 'monospace' }]}>{COMMIT_SHA}</Text>
            </View>
          ) : null}

          {formattedTime ? (
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalLabel}>זמן בנייה:</Text>
              <Text style={styles.modalValue}>{formattedTime}</Text>
            </View>
          ) : null}

          <View style={styles.modalActionsRow}>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={copyDetails}
              activeOpacity={0.8}
            >
              <Text style={styles.copyBtnText}>
                {copied ? '✓ הועתק!' : '📋 העתק פרטים'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeBtnText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (variant === 'detailed') {
    return (
      <View style={styles.detailedWrapper}>
        <TouchableOpacity
          style={styles.detailedContainer}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.detailedContentRow}>
            <Text style={styles.detailedBrand}>shelv.ai Scanner</Text>
            <View style={styles.detailedVersionBadge}>
              <Text style={styles.detailedVersionText}>v{APP_VERSION}</Text>
            </View>
            {hasCommit && (
              <Text style={styles.detailedCommitText}>({COMMIT_SHA})</Text>
            )}
          </View>
          <Text style={styles.detailedHelpText}>גע לפרטי גרסה מלאים והעתקה ⓘ</Text>
        </TouchableOpacity>
        {renderModal()}
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.compactBadge}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.compactTag}>v{APP_VERSION}</Text>
        {hasBranch && (
          <Text style={styles.compactSubTag}>{BRANCH_NAME}</Text>
        )}
      </TouchableOpacity>
      {renderModal()}
    </>
  );
};

const styles = StyleSheet.create({
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 4,
  },
  compactTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34d399',
    fontFamily: 'monospace',
  },
  compactSubTag: {
    fontSize: 9,
    color: '#38bdf8',
    fontWeight: '600',
  },
  detailedWrapper: {
    width: '100%',
    paddingHorizontal: 12,
    marginTop: 16,
    marginBottom: 12,
  },
  detailedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  detailedContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  detailedBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
  },
  detailedVersionBadge: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  detailedVersionText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#10b981',
    fontFamily: 'monospace',
  },
  detailedCommitText: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  detailedHelpText: {
    fontSize: 10,
    color: '#4b5563',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f9fafb',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  modalLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  modalValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34d399',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  copyBtn: {
    flex: 1,
    backgroundColor: '#047857',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  closeBtn: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#d1d5db',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
