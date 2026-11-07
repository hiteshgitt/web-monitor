import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, toneColor } from './theme';

const RING = { good: '#3CC48C', warn: '#E3B23C', bad: '#E5536A', muted: '#AAB7F0' };

export function ScoreRing({ value, tone = 'muted', size = 88, label }) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = value == null ? 0 : Math.max(0, Math.min(100, value));
  // SVG sits absolutely behind the score so the number always renders centered inside the ring.
  return (
    <View style={[styles.ringWrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={RING[tone] || RING.muted}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[styles.ringValue, size < 80 && styles.ringValueSm]}>{value ?? '--'}</Text>
      {label ? <Text style={styles.ringLabel}>{label}</Text> : null}
    </View>
  );
}

export function Sparkline({ series, height = 132 }) {
  const [width, setWidth] = useState(0);
  if (!series || series.length < 2) {
    return <Text style={styles.chartEmpty}>Collecting response-time history…</Text>;
  }
  const values = series.map((point) => point.response);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const step = width > 0 ? width / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - 16 - ((value - min) / span) * (height - 28);
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#6C80E0" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#6C80E0" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#latencyFill)" />
          <Path d={line} stroke={colors.brand} strokeWidth={2.5} fill="none" />
        </Svg>
      ) : <View style={{ height }} />}
      <View style={styles.chartScale}>
        <Text style={styles.chartScaleText}>{max.toLocaleString()} ms</Text>
        <Text style={styles.chartScaleText}>{series[0].time} – {series[series.length - 1].time}</Text>
        <Text style={styles.chartScaleText}>{min.toLocaleString()} ms</Text>
      </View>
    </View>
  );
}

export function ProgressBar({ value, tone = 'muted' }) {
  const width = value == null ? 0 : Math.max(4, Math.min(100, value));
  const color = RING[tone] || RING.muted;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${width}%`, backgroundColor: color }]} />
    </View>
  );
}

export function MetricCard({ title, value, tone = 'muted', progress, detail, footer }) {
  const palette = toneColor[tone] || toneColor.muted;
  return (
    <View style={styles.metric}>
      <Text style={styles.kicker}>{title}</Text>
      <Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
      <ProgressBar value={progress} tone={tone} />
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const EMPTY_VALUE = /^(unknown|n\/?a|not available|not reported|none|null|undefined|--|—)$/i;

function isUsefulValue(value) {
  if (value == null) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  const text = String(value).trim();
  if (!text) return false;
  return !EMPTY_VALUE.test(text);
}

/** Drop empty / “unknown” rows so score cards stay tight. Returns { rows, hidden }. */
export function splitMetricRows(rows = []) {
  const useful = [];
  let hidden = 0;
  rows.forEach((row) => {
    if (!row || row[0] == null) return;
    if (isUsefulValue(row[1])) useful.push(row);
    else hidden += 1;
  });
  return { rows: useful, hidden };
}

export function KeyValue({ rows, compact = false, hideEmpty = true, emptyNote = 'Not reported by this site yet.' }) {
  const source = rows || [];
  const { rows: visible, hidden } = hideEmpty
    ? splitMetricRows(source)
    : { rows: source.filter((row) => row && row[0] != null), hidden: 0 };
  if (visible.length === 0 && hidden === 0) {
    return <Text style={styles.kvEmpty}>No details yet.</Text>;
  }
  return (
    <View>
      {visible.map(([label, value], index) => (
        <View key={label} style={[styles.kv, compact && styles.kvCompact, index === 0 && styles.kvFirst]}>
          <Text style={styles.kvLabel}>{label}</Text>
          <Text style={styles.kvValue} numberOfLines={2}>{String(value)}</Text>
        </View>
      ))}
      {hideEmpty && hidden > 0 ? (
        <Text style={styles.kvNote}>
          {hidden} more field{hidden === 1 ? '' : 's'} {emptyNote.toLowerCase()}
        </Text>
      ) : null}
    </View>
  );
}

export function Panel({ title, children, style }) {
  return (
    <View style={[styles.panel, style]}>
      {title ? <Text style={styles.panelTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 24, fontWeight: '800', color: colors.ink, lineHeight: 28 },
  ringValueSm: { fontSize: 20, lineHeight: 24 },
  ringLabel: { marginTop: 1, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.inkMuted },
  chartEmpty: { color: colors.inkMuted, fontSize: 13, fontWeight: '700', paddingVertical: 28, textAlign: 'center' },
  chartScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  chartScaleText: { color: colors.inkMuted, fontSize: 10, fontWeight: '700' },
  track: { height: 3, borderRadius: 99, backgroundColor: colors.line, overflow: 'hidden', marginTop: 10 },
  fill: { height: 3, borderRadius: 99 },
  metric: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', color: colors.ink },
  metricValue: { marginTop: 8, fontSize: 28, fontWeight: '800' },
  detail: { marginTop: 10, color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  footer: { marginTop: 10, color: colors.brandDark, fontSize: 12, fontWeight: '700' },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  kvFirst: { borderTopWidth: 0, paddingTop: 0 },
  kvCompact: { paddingVertical: 7 },
  kvLabel: { color: colors.ink, fontSize: 13, fontWeight: '800', flexShrink: 0, maxWidth: '46%' },
  kvValue: { color: colors.inkSoft, fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1 },
  kvEmpty: { color: colors.inkMuted, fontSize: 13, fontWeight: '600' },
  kvNote: { marginTop: 10, color: colors.inkMuted, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  panel: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  panelTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.inkSoft, marginBottom: 8 },
});
