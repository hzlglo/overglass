import type { MidiMapping } from '$lib/database/schema';
import { type Output } from 'webmidi';

async function sendMidiControlChangeHelper(
  output: Output,
  args: Parameters<Output['sendControlChange']>,
  logMessage?: string,
) {
  if (args[2]?.channels === 11) {
    console.log('Sending MIDI control change', output.name, logMessage, args);
  }
  output.sendControlChange(...args);
}
export async function sendMidiControlChange({
  output,
  midiMapping,
  value,
  channel,
  time,
}: {
  output: Output;
  midiMapping: MidiMapping;
  // this should be a value between 0 and 1
  value: number;
  channel: number;
  time: number;
}) {
  const {
    ccMsb,
    ccLsb,
    ccMinValue = 0,
    ccMaxValue = 127,
    nrpnMsb,
    nrpnLsb,
    nrpnMinValue,
    nrpnMaxValue,
    orientation,
  } = midiMapping;

  let scaled = value;

  if (orientation === 'negative' || orientation === 'inverted') {
    scaled = 1.0 - value;
  }

  // Scale to CC or NRPN range
  if (ccMsb != null && ccMsb >= 0) {
    value = Math.round(ccMinValue + scaled * (ccMaxValue - ccMinValue));
    // Send MSB CC
    await sendMidiControlChangeHelper(output, [ccMsb, value, { channels: channel, time: time }]);
    // Send LSB CC if defined
    if (ccLsb != null && ccLsb >= 0) {
      await sendMidiControlChangeHelper(output, [
        ccLsb,
        value & 0x7f,
        { channels: channel, time: time },
      ]);
    }
  } else if (nrpnMsb != null && nrpnLsb != null && nrpnMinValue != null && nrpnMaxValue != null) {
    value = Math.round(nrpnMinValue + scaled * (nrpnMaxValue - nrpnMinValue));
    const msbVal = (value >> 7) & 0x7f;
    const lsbVal = value & 0x7f;

    // NRPN parameter select
    await sendMidiControlChangeHelper(output, [99, nrpnMsb, { channels: channel, time: time }]); // NRPN MSB
    await sendMidiControlChangeHelper(output, [98, nrpnLsb, { channels: channel, time: time }]); // NRPN LSB

    // Data entry
    await sendMidiControlChangeHelper(output, [6, msbVal, { channels: channel, time: time }]); // Data MSB
    await sendMidiControlChangeHelper(output, [38, lsbVal, { channels: channel, time: time }]); // Data LSB
  } else {
    console.warn('No CC or NRPN config provided.');
  }
}
