import type {IconButtonProps} from '@mui/joy/IconButton';

import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeIcon from '@mui/icons-material/LightMode';
import IconButton from '@mui/joy/IconButton';
import {useColorScheme} from '@mui/joy/styles';
import * as React from 'react';

export default function ColorSchemeToggle(props: IconButtonProps) {
  const {onClick, sx, ...other} = props;
  const {mode, setMode} = useColorScheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return (
      <IconButton
        color="neutral"
        size="sm"
        variant="outlined"
        {...other}
        disabled
        sx={sx}
      />
    );
  }
  return (
    <IconButton
      color="neutral"
      id="toggle-mode"
      size="sm"
      variant="outlined"
      {...other}
      onClick={(event) => {
        if (mode === 'light') {
          setMode('dark');
        } else {
          setMode('light');
        }
        onClick?.(event);
      }}
      sx={[
        {
          '& > *:first-of-type': {
            display: mode === 'dark' ? 'none' : 'initial',
          },
          '& > *:last-of-type': {
            display: mode === 'light' ? 'none' : 'initial',
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}>
      <DarkModeRoundedIcon />
      <LightModeIcon />
    </IconButton>
  );
}
