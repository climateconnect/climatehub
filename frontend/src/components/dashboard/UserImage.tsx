import { Avatar } from "@mui/material";
import React from "react";
import { getImageUrl } from "../../../public/lib/imageOperations";

export default function UserImage({ user }) {
  return (
    <Avatar
      alt={user?.first_name + " " + user?.last_name + "'s picture"}
      component="div"
      src={getImageUrl(user?.image)}
    />
  );
}
