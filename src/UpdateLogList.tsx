import type {UpdateLogChunkV1} from './Sync';

import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';

type Props = {
  updateChunks: UpdateLogChunkV1[];
};
export default function UpdateLogList({updateChunks}: Props) {
  return (
    <List>
      {updateChunks.map((chunk) => {
        return <ListItem key={chunk.id}>{chunk.timestamp}</ListItem>;
      })}
    </List>
  );
}
