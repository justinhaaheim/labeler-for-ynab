import {extendTheme} from '@mui/joy/styles';

// eslint-disable-next-line no-empty-pattern
function getTheme({}: {mode: 'dark' | 'light'}) {
  return extendTheme({});
}

export default getTheme;
