import { Avatar, IconButton, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import React, { useContext } from "react";
import AppLink from "../general/AppLink";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { getImageUrl } from "./../../../public/lib/imageOperations";

const shouldForwardProp = (prop: string) => !prop.startsWith("$");

// Both avatar sizes only differ in their dimensions; "tiny" and "small" share the small one.
const OrgAvatar = styled(Avatar, { shouldForwardProp })<{
  $avatarSize?: number;
  $showBorder?: boolean;
}>(({ $avatarSize, $showBorder }) => ({
  ...($avatarSize && { height: $avatarSize, width: $avatarSize }),
  ...($avatarSize && $showBorder && { border: "0.5px solid gray" }),
}));

const AvatarWrapper = styled("div")(({ theme }) => ({
  display: "inline-block",
  verticalAlign: "middle",
  marginRight: theme.spacing(1),
  wordBreak: "break-word",
}));

const Wrapper = styled("div", { shouldForwardProp })<{ $inline?: boolean }>(({ $inline }) =>
  $inline
    ? {
        display: "inline-flex",
        alignItems: "center",
        verticalAlign: "middle",
      }
    : {
        display: "flex",
        alignItems: "center",
      }
);

type OrgNameVariant = "tiny" | "bold" | "inlineBold" | "medium" | "default";

// Every name also had the "tinyOrgName" class. Variants listed after it in the old stylesheet
// (medium, bold, inlineBold) override it; "default" (orgName) came before it and is fully overridden.
const OrgName = styled(Typography, { shouldForwardProp })<{ $variant: OrgNameVariant }>(
  ({ $variant }) => [
    {
      display: "-webkit-box",
      overflow: "hidden",
      textOverflow: "ellipsis",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: 3,
      lineHeight: 1.4,
      wordBreak: "break-word",
    },
    $variant === "medium" && {
      fontSize: 16,
      wordBreak: "break-word",
    },
    $variant === "bold" && {
      fontSize: 18,
      fontWeight: 600,
      display: "inline-block",
    },
    $variant === "inlineBold" && {
      fontSize: "inherit",
      fontWeight: 600,
      lineHeight: "inherit",
      display: "inline-block",
    },
  ]
);

export default function MiniOrganizationPreview({
  organization,
  className,
  size,
  onDelete,
  nolink,
  doNotShowName,
  inline,
}: any) {
  if (!organization) return null;
  if (!nolink)
    return (
      <AppLink
        className={className}
        color="inherit"
        href={`/organizations/${organization.url_slug}`}
        target="_blank"
        underline="hover"
      >
        <Content
          organization={organization}
          size={size}
          onDelete={onDelete}
          doNotShowName={doNotShowName}
          inline={inline}
        />
      </AppLink>
    );
  else
    return (
      <div className={className}>
        <Content
          organization={organization}
          size={size}
          onDelete={onDelete}
          doNotShowName={doNotShowName}
          inline={inline}
        />
      </div>
    );
}

function Content({ organization, size, onDelete, doNotShowName, inline }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "organization", locale: locale, organization: organization });
  const avatarSize = size === "tiny" || size === "small" ? 20 : size === "medium" ? 30 : undefined;
  return (
    <Wrapper $inline={inline}>
      <AvatarWrapper>
        <OrgAvatar
          alt={texts.organizations_logo}
          src={getImageUrl(organization.thumbnail_image)}
          $avatarSize={avatarSize}
          $showBorder={doNotShowName}
        />
      </AvatarWrapper>
      {!doNotShowName && (
        <>
          {size === "tiny" || size === "small" ? (
            size === "tiny" ? (
              <Tooltip title={organization.name} placement="bottom">
                <OrgName variant="body2" $variant="tiny">
                  {organization.name}
                </OrgName>
              </Tooltip>
            ) : (
              <Tooltip title={organization.name} placement="bottom">
                <OrgName variant="body2" $variant={inline ? "inlineBold" : "bold"}>
                  {organization.name}
                </OrgName>
              </Tooltip>
            )
          ) : size === "medium" ? (
            <Tooltip title={organization.name} placement="bottom">
              <OrgName $variant="medium">{organization.name}</OrgName>
            </Tooltip>
          ) : (
            <Tooltip title={organization.name} placement="bottom">
              <OrgName variant="body2" $variant="default">
                {organization.name}
              </OrgName>
            </Tooltip>
          )}
          {onDelete && (
            <IconButton onClick={() => onDelete(organization)} size="large">
              <CloseIcon />
            </IconButton>
          )}
        </>
      )}
    </Wrapper>
  );
}
