import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import {styled} from '@mui/joy';
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import Card from '@mui/joy/Card';
import Divider from '@mui/joy/Divider';
import Stack from '@mui/joy/Stack';
import SvgIcon from '@mui/joy/SvgIcon';
import Typography from '@mui/joy/Typography';
import {useState} from 'react';

import FileUpload from './FileUpload';

type Props = {
  onFileText: (text: string) => void;
};

const VisuallyHiddenInput = styled('input')`
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  bottom: 0;
  left: 0;
  white-space: nowrap;
  width: 1px;
`;

export default function InputFileUpload({onFileText}: Props) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <Card>
      <Box sx={{mb: 1}}>
        <Typography level="title-md">Upload Labels</Typography>
        <Typography level="body-sm">
          Upload a .csv file containing the labels to apply to your YNAB
          transactions.
        </Typography>
      </Box>
      <Divider />
      <Stack alignItems="center" spacing={2} sx={{my: 1}}>
        <Button
          color="neutral"
          component="label"
          role={undefined}
          startDecorator={
            <SvgIcon>
              <svg
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </SvgIcon>
          }
          sx={{width: 'fit-content'}}
          tabIndex={-1}
          variant="outlined">
          Upload csv file
          <VisuallyHiddenInput
            accept=".csv"
            onChange={(e) => {
              console.log('File uploaded', e);
              console.log(e.target.files?.[0]);
              const f = e.target.files?.[0];
              if (f == null) {
                console.error(
                  'No file uploaded even though onChange was called',
                );
                return;
              }

              setFile(f);

              const reader = new FileReader();
              reader.addEventListener(
                'load',
                () => {
                  // this will then display a text file
                  const fileText = reader.result as string;
                  console.debug('File text', fileText);
                  onFileText(fileText);
                },
                false,
              );

              reader.readAsText(f);
            }}
            type="file"
          />
        </Button>
        {file != null && (
          <FileUpload
            fileName={file.name}
            fileSize={`${Math.round(file.size / 1000)}kb`}
            icon={<InsertDriveFileRoundedIcon />}
            itemCount={50}
            progress={100}
            sx={{maxWidth: '35em'}}
          />
        )}
      </Stack>
    </Card>
  );
}
