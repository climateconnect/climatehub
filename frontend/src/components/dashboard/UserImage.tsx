import { Avatar } from "@mui/material";
import React from "react";
import { THUMBNAIL_SOURCES, resolveVariantUrl } from "../general/ResponsiveImage";

export default function UserImage({ user }) {
  return (
    <Avatar
      alt={user?.first_name + " " + user?.last_name + "'s picture"}
      component="div"
      src={resolveVariantUrl(
        user?.image_variants,
        THUMBNAIL_SOURCES,
        user?.thumbnail_image || user?.image
      )}
    />
  );
}
