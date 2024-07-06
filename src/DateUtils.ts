import dayjs from 'dayjs';

export function getDateTimeString(date?: Date): string {
  return dayjs(date).format('YYYY-MM-DD__HH-mm-ss');
}

export function getPrettyDateTimeString(date?: Date): string {
  return dayjs(date).format('MMM D, YYYY h:mm a');
}

export function getDateString(date?: Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}

export function getTimePrettyString(date?: Date): string {
  return dayjs(date).format('h:mm a');
}
