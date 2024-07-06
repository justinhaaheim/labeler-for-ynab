import type {YNABErrorType} from './YnabHelpers';
import type * as ynab from 'ynab';

import Button from '@mui/joy/Button';
import List from '@mui/joy/List';
import ListDivider from '@mui/joy/ListDivider';
import ListItem from '@mui/joy/ListItem';
import ListItemContent from '@mui/joy/ListItemContent';
import ListItemDecorator from '@mui/joy/ListItemDecorator';
import Typography from '@mui/joy/Typography';
import React from 'react';

import {getPrettyDateTimeStringWithSeconds} from './DateUtils';
import {
  undoSyncLabelsToYnab,
  UPDATE_TYPE_PRETTY_STRING,
  type UpdateLogChunkV1,
} from './Sync';
import {getYNABErrorHandler} from './YnabHelpers';

type Props = {
  onNewUpdateLogs: (updateLogs: UpdateLogChunkV1) => void;
  onYNABAuthError: (error: YNABErrorType) => void;
  updateChunks: UpdateLogChunkV1[];
  ynabApi: ynab.API | null;
};
export default function UpdateLogList({
  onNewUpdateLogs,
  updateChunks,
  onYNABAuthError,
  ynabApi,
}: Props) {
  return (
    <List>
      {updateChunks.map((chunk, i) => {
        const succeededCount = chunk.logs.filter(
          (log) => log.updateSucceeded,
        ).length;

        const onClick = () => {
          if (ynabApi == null) {
            console.error(
              '📡❌ [UpdateLogList] ynabApi is nullish. Unable to undo logs.',
            );
            return;
          }

          undoSyncLabelsToYnab({
            accountID: chunk.accountID,
            budgetID: chunk.budgetID,
            updateLogChunk: chunk,
            ynabAPI: ynabApi,
          })
            .then((undoUpdateLogs) => {
              onNewUpdateLogs(undoUpdateLogs);
            })
            .catch((error) => {
              console.error('📡❌ Error undoing the YNAB label sync.', error);
              getYNABErrorHandler(onYNABAuthError)(error);
            });
        };

        return (
          <React.Fragment key={chunk.updateID}>
            <ListItem key={chunk.updateID}>
              <ListItemContent>
                <Typography level="title-sm">{`${
                  UPDATE_TYPE_PRETTY_STRING[chunk.type]
                }${
                  chunk.revertSourceInfo != null
                    ? ` ${getPrettyDateTimeStringWithSeconds(
                        new Date(chunk.revertSourceInfo.timestamp),
                      )}`
                    : ''
                } ${chunk.logs.length} labels`}</Typography>

                <Typography level="body-sm">{`${succeededCount} of ${chunk.logs.length} updates successful`}</Typography>

                <Typography level="body-sm" noWrap>
                  {getPrettyDateTimeStringWithSeconds(
                    new Date(chunk.timestamp),
                  )}
                </Typography>
              </ListItemContent>
              <ListItemDecorator>
                <Button disabled={ynabApi == null} onClick={onClick} size="sm">
                  Undo
                </Button>
              </ListItemDecorator>
            </ListItem>
            {i !== updateChunks.length - 1 && <ListDivider />}
          </React.Fragment>
        );
      })}
    </List>
  );
}
