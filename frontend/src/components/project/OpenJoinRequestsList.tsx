import {
  Avatar,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  List,
  Button,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";

import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const Wrapper = styled("section")(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

export type OpenJoinRequest = {
  id: number;
  user_profile: { url_slug: string; first_name: string; last_name: string; image?: string };
  message?: string;
  requested_at?: string;
};

type Props = {
  requests: OpenJoinRequest[];
  // eslint-disable-next-line no-unused-vars
  onSelect: (id: number) => void;
};

export default function OpenJoinRequestsList({ requests, onSelect }: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  if (!requests || requests.length === 0) return null;

  return (
    <Wrapper aria-labelledby="open-join-requests-title">
      <Typography id="open-join-requests-title" variant="h6" component="h2">
        {texts.open_join_requests_title} ({requests.length})
      </Typography>
      <List>
        {requests.map((r) => (
          <ListItemButton key={r.id} onClick={() => onSelect(r.id)}>
            <ListItemAvatar>
              <Avatar
                src={getImageUrl(r.user_profile.image)}
                alt={`${r.user_profile.first_name} ${r.user_profile.last_name}`}
              />
            </ListItemAvatar>
            <ListItemText
              primary={`${r.user_profile.first_name} ${r.user_profile.last_name}`}
              secondary={[
                r.requested_at && new Date(r.requested_at).toLocaleDateString(locale),
                r.message,
              ]
                .filter(Boolean)
                .join(" · ")}
              slotProps={{ secondary: { noWrap: true } }}
            />
            <Button size="small" component="span">
              {texts.open_join_requests_view}
            </Button>
          </ListItemButton>
        ))}
      </List>
    </Wrapper>
  );
}
