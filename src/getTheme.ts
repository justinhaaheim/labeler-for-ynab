import {createTheme, responsiveFontSizes} from '@mui/material/styles';

function getTheme({mode}: {mode: 'dark' | 'light'}) {
  return responsiveFontSizes(
    createTheme({
      palette: {
        // background: {default: mode === 'light' ? '#F6F6F6' : undefined},
        mode: mode,
      },
      typography: {
        fontFamily: [
          'Helvetica Neue',
          'Roboto',
          '-apple-system',
          'sans-serif',
        ].join(','),
        fontSize: 12,
        // h1: {
        //   fontSize: '4rem',
        // },
        // h2: {fontSize: '3rem'},
      },
    }),
  );
}

export default getTheme;
