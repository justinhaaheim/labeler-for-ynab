import Button from '@mui/joy/Button';
import List from '@mui/joy/List';
import ListDivider from '@mui/joy/ListDivider';
import ListItem from '@mui/joy/ListItem';
import ListItemContent from '@mui/joy/ListItemContent';
import ListItemDecorator from '@mui/joy/ListItemDecorator';
import Typography from '@mui/joy/Typography';

import {getPrettyDateTimeString} from './DateUtils';
import {UPDATE_TYPE_PRETTY_STRING, type UpdateLogChunkV1} from './Sync';

type Props = {
  updateChunks: UpdateLogChunkV1[];
};
export default function UpdateLogList({updateChunks}: Props) {
  return (
    <List>
      {updateChunks.map((chunk, i) => {
        return (
          <>
            <ListItem key={chunk.id}>
              <ListItemContent>
                <Typography level="title-sm">{`${
                  UPDATE_TYPE_PRETTY_STRING[chunk.type]
                } of ${chunk.logs.length} labels`}</Typography>
                <Typography level="body-sm" noWrap>
                  {getPrettyDateTimeString(new Date(chunk.timestamp))}
                </Typography>
              </ListItemContent>
              <ListItemDecorator>
                <Button size="sm">Undo</Button>
              </ListItemDecorator>
            </ListItem>
            {i !== updateChunks.length - 1 && <ListDivider />}
          </>
        );
      })}
    </List>
  );
}
