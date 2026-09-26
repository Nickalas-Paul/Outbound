import { View, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

type Point = { year: number; score: number };

type Props = {
  data: Point[];
  color: string;
  /** Optional OLS projection points (rendered dashed, lighter). */
  projectionData?: Point[];
  width?: number;
  height?: number;
};

function buildPolylinePoints(
  points: Point[],
  width: number,
  height: number,
  pad: number,
  yearMin: number,
  yearMax: number
): string {
  if (points.length === 0) return '';
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const yearSpan = Math.max(1, yearMax - yearMin);

  return points
    .map((p) => {
      const x = pad + ((p.year - yearMin) / yearSpan) * innerW;
      const y = pad + (1 - Math.min(100, Math.max(0, p.score)) / 100) * innerH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

/** Native sparkline via react-native-svg — historical solid + projection dashed. */
export default function TrendSparkline({
  data,
  color,
  projectionData = [],
  width = 200,
  height = 56,
}: Props) {
  if (!data.length) {
    return <View style={[styles.empty, { width, height }]} />;
  }

  const pad = 4;
  const last = data[data.length - 1];
  const allYears = [
    ...data.map((p) => p.year),
    ...projectionData.map((p) => p.year),
  ];
  const yearMin = Math.min(...allYears);
  const yearMax = Math.max(...allYears);

  const histPoints = buildPolylinePoints(
    data,
    width,
    height,
    pad,
    yearMin,
    yearMax
  );

  const projBridge =
    projectionData.length > 0
      ? [{ year: last.year, score: last.score }, ...projectionData]
      : [];
  const projPoints = buildPolylinePoints(
    projBridge,
    width,
    height,
    pad,
    yearMin,
    yearMax
  );

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Polyline
          points={histPoints}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {projBridge.length > 1 ? (
          <Polyline
            points={projPoints}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeOpacity={0.55}
            strokeDasharray="4 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { backgroundColor: 'transparent' },
});
