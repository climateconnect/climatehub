import React from "react";
import { Avatar, Box, Chip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { getImageUrl } from "../../../public/lib/imageOperations";

const Media = styled(Avatar)(({ theme }) => ({
  height: 80,
  width: 80,
  backgroundSize: "contain",
  margin: "0 auto",
  marginTop: theme.spacing(3),
}));

const ChipGroup = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginTop: "-15px",
});

const TypeChip = styled(Chip)({
  height: 20,
  position: "relative",
  margin: "1px 1px",
});

const HeaderWrapper = styled(Box)({
  justifyContent: "center",
});

const Header = styled(Typography)(({ theme }) => ({
  fontWeight: "bold",
  margin: "5px",
  overflow: "hidden",
  wordBreak: "break-word",
  lineHeight: 1.3,
  color: theme.palette.text.primary,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
})) as typeof Typography;

export default function OrganizationPreviewHeader({ organization }) {
  return (
    <div>
      <Media
        alt={organization.name}
        //TODO(unused) size="large"
        src={getImageUrl(organization.thumbnail_image)}
        component="div"
      />
      {organization.types?.length > 0 && (
        <ChipGroup>
          {organization.types.map((type) => (
            <TypeChip key={type.key} label={type.name} size="small" color="primary" />
          ))}
        </ChipGroup>
      )}
      <HeaderWrapper>
        <Header variant="h6" component="h2">
          {organization.name}
        </Header>
      </HeaderWrapper>
    </div>
  );
}
