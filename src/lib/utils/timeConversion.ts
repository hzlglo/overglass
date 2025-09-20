/**
 * Convert seconds to bar and beat position
 * @param timeInSeconds - Time in seconds
 * @param bpm - Beats per minute
 * @param timeSigNumerator - Time signature numerator (e.g., 4 in 4/4)
 * @param timeSigDenominator - Time signature denominator (e.g., 4 in 4/4)
 * @returns Object with bar, beat, and barFractional positions
 */
export function secondsToBars(
  timeInSeconds: number,
  bpm: number,
  timeSigNumerator: number,
  timeSigDenominator: number,
) {
  const bps = bpm / 60;
  const beatLength = 4 / timeSigDenominator; // quarter = 1, eighth = 0.5, half = 2
  const effectiveBPS = bps * beatLength;

  const totalBeats = timeInSeconds * effectiveBPS;

  const beatsPerBar = timeSigNumerator;
  const totalBars = Math.floor(totalBeats / beatsPerBar);
  const barNumber = totalBars + 1;

  const beatInBar = (totalBeats % beatsPerBar) + 1;

  const barFractional = barNumber + beatInBar / beatsPerBar;

  return { bar: barNumber, beat: beatInBar, barFractional };
}