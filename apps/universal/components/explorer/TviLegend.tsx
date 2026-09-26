import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { SCORE_COLOR_STOPS, SCORE_STOP_MAX, SCORE_STOP_MIN } from '@outbound/core';

type Props = {
  style?: object;
};

export default function TviLegend({ style }: Props) {
  const stops = SCORE_COLOR_STOPS;
  return (
    <View style={StyleSheet.flatten([styles.wrap, style])} pointerEvents="none">
      <Text style={styles.caption}>TRAVEL VIABILITY INDEX</Text>
      <View style={styles.barRow}>
        <Text style={styles.edge}>{SCORE_STOP_MIN}</Text>
        <View style={styles.barHost}>
          <Svg width="100%" height="8" viewBox="0 0 100 8" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="tviLegendGrad" x1="0" y1="0" x2="1" y2="0">
                {stops.map(([score, color], i) => {
                  const offset =
                    (score - SCORE_STOP_MIN) / (SCORE_STOP_MAX - SCORE_STOP_MIN);
                  return (
                    <Stop
                      key={`${score}-${i}`}
                      offset={`${Math.round(offset * 100)}%`}
                      stopColor={color}
                    />
                  );
                })}
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="8" rx="4" fill="url(#tviLegendGrad)" />
          </Svg>
        </View>
        <Text style={styles.edge}>{SCORE_STOP_MAX}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(12, 12, 20, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 220,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  caption: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  edge: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    width: 22,
    textAlign: 'center',
  },
  barHost: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
