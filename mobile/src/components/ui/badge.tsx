import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'emerald'
  | 'purple'
  | 'blue'
  | 'cyan'
  | 'amber'
  | 'rose';

export interface BadgeProps {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  style,
  textStyle,
}) => {
  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.default;

  return (
    <View style={[styles.badge, variantStyle.container, style]}>
      {typeof children === 'string' ? (
        <Text style={[styles.badgeText, variantStyle.text, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

const VARIANT_STYLES: Record<
  BadgeVariant,
  { container: ViewStyle; text: TextStyle }
> = {
  default: {
    container: {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    text: {
      color: '#6ee7b7',
    },
  },
  secondary: {
    container: {
      backgroundColor: '#1f2937',
      borderColor: '#374151',
    },
    text: {
      color: '#d1d5db',
    },
  },
  destructive: {
    container: {
      backgroundColor: 'rgba(244, 63, 94, 0.2)',
      borderColor: 'rgba(244, 63, 94, 0.3)',
    },
    text: {
      color: '#fda4af',
    },
  },
  outline: {
    container: {
      backgroundColor: 'transparent',
      borderColor: '#4b5563',
    },
    text: {
      color: '#d1d5db',
    },
  },
  emerald: {
    container: {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    text: {
      color: '#34d399',
    },
  },
  purple: {
    container: {
      backgroundColor: 'rgba(168, 85, 247, 0.2)',
      borderColor: 'rgba(168, 85, 247, 0.4)',
    },
    text: {
      color: '#d8b4fe',
    },
  },
  blue: {
    container: {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    text: {
      color: '#93c5fd',
    },
  },
  cyan: {
    container: {
      backgroundColor: 'rgba(6, 182, 212, 0.2)',
      borderColor: 'rgba(6, 182, 212, 0.4)',
    },
    text: {
      color: '#67e8f9',
    },
  },
  amber: {
    container: {
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    text: {
      color: '#fcd34d',
    },
  },
  rose: {
    container: {
      backgroundColor: 'rgba(244, 63, 94, 0.2)',
      borderColor: 'rgba(244, 63, 94, 0.3)',
    },
    text: {
      color: '#fda4af',
    },
  },
};
