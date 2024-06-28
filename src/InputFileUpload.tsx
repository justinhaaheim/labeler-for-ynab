import {styled} from '@mui/joy';
import Button from '@mui/joy/Button';
import SvgIcon from '@mui/joy/SvgIcon';

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
  return (
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
            console.error('No file uploaded even though onChange was called');
            return;
          }
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
  );
}
