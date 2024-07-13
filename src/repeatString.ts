export default function repeatString(str: string, nTimes: number): string {
  return Array(nTimes).fill(str).join('');
}
