import dayjs from 'dayjs';

export default function getDateTimeString(date?: Date) {
  return dayjs(date).format('YYYY-MM-DD__HH-mm-ss');
}
