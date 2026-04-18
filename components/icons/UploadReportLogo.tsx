import { Colors, FontWeights } from '@/constants/theme';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

export default function UploadReportLogo({
  size = 40,
  bgColor = Colors.primaryLight,
  color = Colors.primary,
  style,
}: {
  size?: number;
  bgColor?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const fontSize = Math.round(size * 0.45);
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: Math.round(size * 0.18), backgroundColor: bgColor }, style]}>
      <Text style={[styles.text, { color, fontSize }]}>R</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: FontWeights.heavy as any,
    includeFontPadding: false as any,
  },
});
