import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';

export type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'emerald'
  | 'cyan'
  | 'indigo'
  | 'amber'
  | 'purple';

export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'default',
  loading = false,
  disabled = false,
  onPress,
  children,
  style,
  textStyle,
}) => {
  const variantContainerStyle = VARIANT_STYLES[variant]?.container || VARIANT_STYLES.default.container;
  const variantTextStyle = VARIANT_STYLES[variant]?.text || VARIANT_STYLES.default.text;
  const sizeContainerStyle = SIZE_STYLES[size]?.container || SIZE_STYLES.default.container;
  const sizeTextStyle = SIZE_STYLES[size]?.text || SIZE_STYLES.default.text;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.base,
        sizeContainerStyle,
        variantContainerStyle,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantTextStyle.color || '#fff'}
          style={styles.spinner}
        />
      ) : typeof children === 'string' ? (
        <Text style={[styles.baseText, sizeTextStyle, variantTextStyle, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  baseText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  spinner: {
    marginHorizontal: 4,
  },
  disabled: {
    opacity: 0.5,
  },
});

const VARIANT_STYLES: Record<
  ButtonVariant,
  { container: ViewStyle; text: TextStyle }
> = {
  default: {
    container: {
      backgroundColor: '#10b981',
      borderColor: '#059669',
    },
    text: {
      color: '#ffffff',
    },
  },
  destructive: {
    container: {
      backgroundColor: 'rgba(244, 63, 94, 0.15)',
      borderColor: 'rgba(244, 63, 94, 0.4)',
    },
    text: {
      color: '#fda4af',
    },
  },
  outline: {
    container: {
      backgroundColor: '#111827',
      borderColor: '#374151',
    },
    text: {
      color: '#e5e7eb',
    },
  },
  secondary: {
    container: {
      backgroundColor: '#1f2937',
      borderColor: '#374151',
    },
    text: {
      color: '#e5e7eb',
    },
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    text: {
      color: '#9ca3af',
    },
  },
  emerald: {
    container: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    text: {
      color: '#6ee7b7',
    },
  },
  cyan: {
    container: {
      backgroundColor: 'rgba(6, 182, 212, 0.15)',
      borderColor: 'rgba(6, 182, 212, 0.35)',
    },
    text: {
      color: '#67e8f9',
    },
  },
  indigo: {
    container: {
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      borderColor: 'rgba(99, 102, 241, 0.35)',
    },
    text: {
      color: '#a5b4fc',
    },
  },
  amber: {
    container: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    text: {
      color: '#fcd34d',
    },
  },
  purple: {
    container: {
      backgroundColor: 'rgba(168, 85, 247, 0.15)',
      borderColor: 'rgba(168, 85, 247, 0.35)',
    },
    text: {
      color: '#d8b4fe',
    },
  },
};

const SIZE_STYLES: Record<
  ButtonSize,
  { container: ViewStyle; text: TextStyle }
> = {
  default: {
    container: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 42,
    },
    text: {
      fontSize: 13,
    },
  },
  sm: {
    container: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      minHeight: 34,
    },
    text: {
      fontSize: 12,
    },
  },
  lg: {
    container: {
      paddingHorizontal: 22,
      paddingVertical: 14,
      minHeight: 50,
    },
    text: {
      fontSize: 15,
    },
  },
  icon: {
    container: {
      width: 36,
      height: 36,
      padding: 0,
      borderRadius: 10,
    },
    text: {
      fontSize: 14,
    },
  },
};
