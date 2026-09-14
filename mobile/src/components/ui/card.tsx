import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';

export interface CardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const CardHeader: React.FC<CardProps> = ({ children, style }) => (
  <View style={[styles.cardHeader, style]}>{children}</View>
);

export const CardTitle: React.FC<{
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
}> = ({ children, style }) => (
  <Text style={[styles.cardTitle, style]}>{children}</Text>
);

export const CardDescription: React.FC<{
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
}> = ({ children, style }) => (
  <Text style={[styles.cardDescription, style]}>{children}</Text>
);

export const CardContent: React.FC<CardProps> = ({ children, style }) => (
  <View style={[styles.cardContent, style]}>{children}</View>
);

export const CardFooter: React.FC<CardProps> = ({ children, style }) => (
  <View style={[styles.cardFooter, style]}>{children}</View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'right',
  },
  cardDescription: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'right',
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cardFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
