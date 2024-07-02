import dayjs from 'dayjs';

export function getDateTimeString(date?: Date): string {
  return dayjs(date).format('YYYY-MM-DD__HH-mm-ss');
}

export function getDateString(date?: Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}