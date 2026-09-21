import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { View, StyleSheet } from 'react-native';

type Point = { year: number; score: number };

type Props = {
  data: Point[];
  color: string;
  /** Optional OLS projection points (rendered dashed, lighter). */
  projectionData?: Point[];
  width?: number;
  height?: number;
};

/** Web sparkline via recharts — historical solid + projection dashed. */
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

  const last = data[data.length - 1];
  const years = new Set<number>([
    ...data.map((p) => p.year),
    ...projectionData.map((p) => p.year),
  ]);
  if (projectionData.length > 0) {
    years.add(last.year);
  }
  const sortedYears = Array.from(years).sort((a, b) => a - b);

  const histByYear = new Map(data.map((p) => [p.year, p.score]));
  const projBridge =
    projectionData.length > 0
      ? [{ year: last.year, score: last.score }, ...projectionData]
      : [];
  const projByYear = new Map(projBridge.map((p) => [p.year, p.score]));

  const chartData = sortedYears.map((year) => ({
    year,
    score: histByYear.has(year) ? histByYear.get(year)! : null,
    projected: projByYear.has(year) ? projByYear.get(year)! : null,
  }));

  return (
    <View style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <YAxis domain={[0, 100]} hide />
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {projectionData.length > 0 ? (
            <Line
              type="monotone"
              dataKey="projected"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeOpacity={0.55}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { backgroundColor: 'transparent' },
});
