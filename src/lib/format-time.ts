/** m:ss.mmm, millisecond-precision — used by the trimmer's hover readout and region labels. */
export function formatMsTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}
