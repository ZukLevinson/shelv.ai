import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';

interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType>({
  open: false,
  onOpenChange: () => {},
});

export interface DialogProps {
  open?: boolean;
  visible?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRequestClose?: () => void;
  children?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  visible,
  onOpenChange,
  onRequestClose,
  children,
}) => {
  const isOpen = open !== undefined ? open : Boolean(visible);
  const handleOpenChange = (val: boolean) => {
    onOpenChange?.(val);
    if (!val) onRequestClose?.();
  };

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => handleOpenChange(false)}
      >
        <View style={styles.overlay}>
          {children}
        </View>
      </Modal>
    </DialogContext.Provider>
  );
};

export interface DialogContentProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hideCloseButton?: boolean;
}

export const DialogContent: React.FC<DialogContentProps> = ({
  children,
  style,
  hideCloseButton = false,
}) => {
  const { onOpenChange } = React.useContext(DialogContext);

  return (
    <View style={[styles.content, style]} {...({ dir: 'rtl' } as any)}>
      {!hideCloseButton && (
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => onOpenChange(false)}
          activeOpacity={0.7}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      )}
      {children}
    </View>
  );
};

export const DialogHeader: React.FC<{
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => (
  <View style={[styles.header, style]}>{children}</View>
);

export const DialogTitle: React.FC<{
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
}> = ({ children, style }) => (
  <Text style={[styles.title, style]}>{children}</Text>
);

export const DialogDescription: React.FC<{
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
}> = ({ children, style }) => (
  <Text style={[styles.description, style]}>{children}</Text>
);

export const DialogFooter: React.FC<{
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => (
  <View style={[styles.footer, style]}>{children}</View>
);

export const DialogClose: React.FC<{
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ children, onPress, style }) => {
  const { onOpenChange } = React.useContext(DialogContext);
  return (
    <TouchableOpacity
      style={style}
      onPress={() => {
        onPress?.();
        onOpenChange(false);
      }}
    >
      {children}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 20,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    marginBottom: 16,
    paddingRight: 40,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'right',
  },
  description: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 8,
  },
});
