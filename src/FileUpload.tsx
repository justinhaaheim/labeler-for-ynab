import type {CardProps} from '@mui/joy/Card';

import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import AspectRatio from '@mui/joy/AspectRatio';
import Box from '@mui/joy/Box';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import IconButton from '@mui/joy/IconButton';
import LinearProgress from '@mui/joy/LinearProgress';
import Typography from '@mui/joy/Typography';
import * as React from 'react';

import {type ParsedLabelFormatTypes, PRETTY_NAME_LOOKUP} from './LabelParser';

export default function FileUpload(
  props: CardProps & {
    fileName: string;
    fileSize: string;
    icon?: React.ReactElement;
    importType: ParsedLabelFormatTypes | null;
    itemCount: number;
    progress: number;
  },
) {
  const {
    icon,
    fileName,
    fileSize,
    itemCount,
    importType,
    progress,
    sx,
    ...other
  } = props;
  return (
    <Card
      orientation="horizontal"
      variant="outlined"
      {...other}
      sx={[
        {
          alignItems: 'flex-start',
          gap: 1.5,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}>
      <AspectRatio
        color="neutral"
        ratio="1"
        sx={{
          '--Icon-fontSize': '16px',
          borderRadius: '50%',
          minWidth: 32,
        }}
        variant="soft">
        <div>{icon ?? <InsertDriveFileRoundedIcon />}</div>
      </AspectRatio>
      <CardContent sx={{textAlign: 'start'}}>
        <Typography fontSize="sm">{fileName}</Typography>
        <Typography level="body-xs">{fileSize}</Typography>
        <Typography level="body-xs">{`${
          importType == null ? 'No ' : PRETTY_NAME_LOOKUP[importType]
        } format detected`}</Typography>
        <Typography level="body-xs">{itemCount} labels parsed</Typography>
        <Box sx={{alignItems: 'center', display: 'flex', gap: 1}}>
          <LinearProgress
            color="neutral"
            determinate
            sx={[
              {
                ...(progress >= 100 && {
                  color: 'var(--joy-palette-success-solidBg)',
                }),
              },
            ]}
            value={progress}
          />
          <Typography fontSize="xs">{progress}%</Typography>
        </Box>
      </CardContent>
      {progress >= 100 ? (
        <AspectRatio
          color="success"
          ratio="1"
          sx={{
            '--Icon-fontSize': '14px',
            borderRadius: '50%',
            minWidth: 20,
          }}
          variant="solid">
          <div>
            <CheckRoundedIcon />
          </div>
        </AspectRatio>
      ) : (
        <IconButton
          color="danger"
          size="sm"
          sx={{mr: -1, mt: -1}}
          variant="plain">
          <RemoveCircleOutlineRoundedIcon />
        </IconButton>
      )}
    </Card>
  );
}
