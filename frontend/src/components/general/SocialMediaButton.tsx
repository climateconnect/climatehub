import { styled } from "@mui/material/styles";
import React from "react";

const InheritColorLink = styled("a")({
  color: "inherit",
});

export default function SocialMediaButton({ href, socialMediaIcon, altText, isFooterIcon }) {
  return (
    <InheritColorLink href={href} target="_blank" rel="noopener noreferrer">
      <socialMediaIcon.icon
        alt={altText}
        sx={(theme) => ({
          height: 20,
          marginLeft: theme.spacing(1),
          color: isFooterIcon ? "inherit" : theme.palette.primary.main,
          "&:hover": {
            color: theme.palette.primary.main,
          },
        })}
      />
    </InheritColorLink>
  );
}
