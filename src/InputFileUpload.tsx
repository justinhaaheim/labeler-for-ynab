import type {ParsedLabelsTyped} from './LabelParser';

import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import {styled} from '@mui/joy';
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import Card from '@mui/joy/Card';
import Divider from '@mui/joy/Divider';
import FormControl from '@mui/joy/FormControl';
import FormHelperText from '@mui/joy/FormHelperText';
import FormLabel from '@mui/joy/FormLabel';
import Input from '@mui/joy/Input';
import Stack from '@mui/joy/Stack';
import SvgIcon from '@mui/joy/SvgIcon';
import Typography from '@mui/joy/Typography';
import _ from 'lodash';
import {useEffect, useMemo, useState} from 'react';

import FileUpload from './FileUpload';
import {getParsedLabelsFromCsv} from './LabelParser';

const LABEL_PREFIX_CHANGE_DEBOUNCE_WAIT_MS = 500;

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

type Props = {
  labelCount: number | null;
  onLabelPrefixChange: (prefix: string) => void;
  onNewLabelData: (labels: ParsedLabelsTyped) => void;
};

export default function InputFileUpload({
  onNewLabelData,
  onLabelPrefixChange,
  labelCount,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [labelData, setLabelData] = useState<ParsedLabelsTyped | null>(null);
  const [labelPrefix, setLabelPrefix] = useState<string>('');

  const onLabelPrefixChangeDebounced = useMemo(() => {
    return _.debounce(
      onLabelPrefixChange,
      LABEL_PREFIX_CHANGE_DEBOUNCE_WAIT_MS,
    );
  }, [onLabelPrefixChange]);

  useEffect(() => {
    return () => {
      // Prevent the debounced function from being called after the component unmounts
      onLabelPrefixChangeDebounced.cancel();
    };
  }, [onLabelPrefixChangeDebounced]);

  return (
    <Card sx={{maxWidth: '35em'}}>
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
          onClick={() => {
            setFile(null);
            setLabelData(null);
            setUploadProgress(0);
          }}
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
              setUploadProgress(80);

              const reader = new FileReader();

              // TODO: set some kind of timeout timer in case load doesn't get called in time or never gets called
              reader.addEventListener(
                'load',
                () => {
                  // this will then display a text file
                  const fileText = reader.result as string;
                  console.debug('File text', fileText);

                  const newParsedLabels = getParsedLabelsFromCsv(fileText);
                  setLabelData(newParsedLabels);
                  onNewLabelData(newParsedLabels);
                  setUploadProgress(100);
                },
                false,
              );

              reader.readAsText(f);

              // We want the user to be able to reupload the same file. If we don't do this then onChange is never called if they upload the same file.
              e.target.value = '';
            }}
            type="file"
          />
        </Button>

        {file != null && (
          <FileUpload
            fileName={file.name}
            fileSize={`${Math.round(file.size / 1000)}kb`}
            icon={<InsertDriveFileRoundedIcon />}
            importRowsCount={labelData?.labels.length ?? null}
            importType={labelData?._type ?? null}
            labelCount={labelCount}
            progress={uploadProgress}
            sx={{maxWidth: '35em'}}
          />
        )}

        <Box>
          <FormControl sx={{maxWidth: '25em'}}>
            <FormLabel>Label Prefix</FormLabel>
            <Input
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setLabelPrefix(e.target.value);
                onLabelPrefixChangeDebounced(e.target.value);
              }}
              placeholder="Prefix"
              value={labelPrefix}
            />
            <FormHelperText>
              Add a prefix to help distinguish transactions from different
              sources (ie multiple people's Amazon accounts)
            </FormHelperText>
          </FormControl>
        </Box>
      </Stack>
    </Card>
  );
}
