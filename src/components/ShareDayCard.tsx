import type { ReactElement } from 'react';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { ShareDayCardModel } from '@/services/shareDay';
import { formatNumber } from '@/utils/format';

/** Story format. The card is drawn in these units and scaled to fit. */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 640;
/** Smallest text on the card, in card units: stays ≥ 12 pt down to a 270 pt wide card. */
const SMALL = 16;
/** Panels live between the ring and the footer divider. */
const PANELS_START = 296;
const PANELS_END = 536;

/** Splits a line at the space nearest its middle when it is too long for the card. */
export function twoLines(text: string, max: number): [string] | [string, string] {
  if (text.length <= max) return [text];
  const middle = text.length / 2;
  let best = -1;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === ' ' && (best < 0 || Math.abs(index - middle) < Math.abs(best - middle))) best = index;
  }
  return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

const range = ([low, high]: [number, number], locale: string) =>
  low === high ? formatNumber(low, locale) : `${formatNumber(low, locale)}–${formatNumber(high, locale)}`;

/**
 * The 9:16 day card, drawn entirely with react-native-svg so it scales as one
 * picture. It shows only what the model carries; the model decides privacy.
 */
export function ShareDayCard({ card, dateLabel, weightLabel, width }: {
  card: ShareDayCardModel;
  dateLabel: string;
  /** Pre-formatted change in the person's unit, e.g. "−1,2 kg". Only used when the card carries a change. */
  weightLabel: string | null;
  width: number;
}) {
  const { colors } = useTheme();
  const { locale, t } = useLanguage();
  const copy = t.shareDay;
  const height = Math.round((width * SHARE_CARD_HEIGHT) / SHARE_CARD_WIDTH);

  const showWeight = card.weightChangeKg !== null && Boolean(weightLabel);
  // Ring and panels move down together by half the unused room, so a card
  // with fewer panels sits balanced instead of leaving a hole above the footer.
  const stack = (card.protein ? 72 : 0) + (showWeight ? 64 : 0) + (card.next ? 92 : 52);
  const shift = Math.max(0, Math.round((PANELS_END - PANELS_START - stack) / 2));

  // Ring
  const cx = SHARE_CARD_WIDTH / 2;
  const cy = 184 + shift;
  const r = 92;
  const stroke = 18;
  const circumference = 2 * Math.PI * r;
  const over = card.overCalories > 0;
  const ringColor = over ? colors.attention : colors.accentText;

  // Panels flow from under the ring; the footer is fixed.
  let cursor = PANELS_START + shift;
  const panels: ReactElement[] = [];
  if (card.protein) {
    const top = cursor;
    const ratio = card.protein.target > 0 ? Math.min(1, card.protein.current / card.protein.target) : 0;
    panels.push(
      <G key="protein">
        <Rect fill={colors.surface} height={60} rx={18} stroke={colors.border} strokeWidth={1} width={320} x={20} y={top} />
        <SvgText fill={colors.muted} fontSize={SMALL} fontWeight="700" letterSpacing={1} x={38} y={top + 26}>{copy.cardProtein}</SvgText>
        <SvgText fill={colors.text} fontSize={20} fontWeight="700" textAnchor="end" x={322} y={top + 27}>
          {`${formatNumber(card.protein.current, locale)} / ${formatNumber(card.protein.target, locale)} g`}
        </SvgText>
        <Rect fill={colors.neutralSoft} height={6} rx={3} width={284} x={38} y={top + 40} />
        <Rect fill={colors.macroProtein} height={6} rx={3} width={Math.max(6, 284 * ratio)} x={38} y={top + 40} />
      </G>,
    );
    cursor += 72;
  }
  if (showWeight && weightLabel) {
    const top = cursor;
    panels.push(
      <G key="weight">
        <Rect fill={colors.surface} height={52} rx={18} stroke={colors.border} strokeWidth={1} width={320} x={20} y={top} />
        <SvgText fill={colors.muted} fontSize={SMALL} fontWeight="700" letterSpacing={1} x={38} y={top + 32}>{copy.cardWeightLabel}</SvgText>
        <SvgText fill={colors.text} fontSize={17} fontWeight="700" textAnchor="end" x={322} y={top + 33}>{copy.cardWeight(weightLabel)}</SvgText>
      </G>,
    );
    cursor += 64;
  }
  if (card.next) {
    const top = cursor;
    panels.push(
      <G key="next">
        <Rect fill={colors.accentSoft} height={92} rx={18} stroke={colors.accent} strokeWidth={1.5} width={320} x={20} y={top} />
        <SvgText fill={colors.muted} fontSize={SMALL} fontWeight="700" letterSpacing={1} x={38} y={top + 28}>{copy.cardNext}</SvgText>
        <SvgText fill={colors.text} fontSize={19} fontWeight="700" x={38} y={top + 55}>{copy.ideasFor(card.next.slot)}</SvgText>
        <SvgText fill={colors.text} fontSize={SMALL} x={38} y={top + 78}>{copy.cardRange(range(card.next.calories, locale), range(card.next.protein, locale))}</SvgText>
      </G>,
    );
  } else {
    twoLines(copy.cardTagline, 26).forEach((line, index) => panels.push(
      <SvgText fill={colors.text} fontSize={19} fontWeight="700" key={`tagline-${index}`} textAnchor="middle" x={cx} y={cursor + 30 + index * 26}>{line}</SvgText>,
    ));
  }

  return (
    <Svg height={height} viewBox={`0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}`} width={width}>
      <Rect fill={colors.background} height={SHARE_CARD_HEIGHT} rx={28} width={SHARE_CARD_WIDTH} x={0} y={0} />
      {/* A quiet brand echo: one large soft disc and the pistachio dot. */}
      <Circle cx={318} cy={44} fill={colors.neutralSoft} r={96} />
      <Circle cx={316} cy={120} fill={colors.accent} r={7} />

      {/* Header: the mark, the name, the day. */}
      <G transform="translate(22 22) scale(0.5)">
        <Path d="M 47.56 16.44 A 22 22 0 1 1 16.44 16.44" fill="none" stroke={colors.accentText} strokeLinecap="round" strokeWidth={6.5} />
        <Circle cx={32} cy={7.5} fill={colors.accent} r={4.8} />
      </G>
      <SvgText fill={colors.text} fontSize={22} fontWeight="800" letterSpacing={-0.4} x={62} y={47}>Kandro</SvgText>
      <SvgText fill={colors.muted} fontSize={SMALL} fontWeight="600" x={62} y={68}>{dateLabel}</SvgText>

      {/* The ring: what is left of today. */}
      <Circle cx={cx} cy={cy} fill="none" r={r} stroke={colors.border} strokeWidth={stroke} />
      <Circle
        cx={cx}
        cy={cy}
        fill="none"
        r={r}
        stroke={ringColor}
        strokeDasharray={`${circumference * card.ringRatio} ${circumference}`}
        strokeLinecap="round"
        strokeWidth={stroke}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {card.dayDone && over ? (
        <>
          <SvgText fill={colors.text} fontSize={22} fontWeight="800" letterSpacing={-0.4} textAnchor="middle" x={cx} y={cy + 2}>{copy.cardDayDone}</SvgText>
          <SvgText fill={colors.muted} fontSize={SMALL} fontWeight="600" textAnchor="middle" x={cx} y={cy + 26}>{copy.cardDayDoneText}</SvgText>
        </>
      ) : (
        <>
          <SvgText fill={colors.text} fontSize={50} fontWeight="800" letterSpacing={-1.6} textAnchor="middle" x={cx} y={cy + 12}>
            {formatNumber(card.remainingCalories, locale)}
          </SvgText>
          <SvgText fill={colors.muted} fontSize={18} fontWeight="600" textAnchor="middle" x={cx} y={cy + 40}>{copy.cardLeft}</SvgText>
        </>
      )}

      {panels}

      {/* Footer: how to find the app, and the honest note. */}
      <Line stroke={colors.border} strokeWidth={1} x1={20} x2={340} y1={548} y2={548} />
      <SvgText fill={colors.text} fontSize={18} fontWeight="800" x={20} y={584}>{copy.appStoreHint}</SvgText>
      <SvgText fill={colors.muted} fontSize={SMALL} x={20} y={612}>{copy.cardEstimate}</SvgText>
      <G transform="translate(306 562) scale(0.5)">
        <Path d="M 47.56 16.44 A 22 22 0 1 1 16.44 16.44" fill="none" stroke={colors.accentText} strokeLinecap="round" strokeWidth={6.5} />
        <Circle cx={32} cy={7.5} fill={colors.accent} r={4.8} />
      </G>
    </Svg>
  );
}
