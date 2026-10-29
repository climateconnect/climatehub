import { Badge, Link, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { PropsWithChildren, useContext } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import { getImageUrl } from "../../../public/lib/imageOperations";
import UserContext from "../context/UserContext";

const BadgeContainer = styled("div", {
  shouldForwardProp: (prop) => !String(prop).startsWith("$"),
})<{ $isDonorforestBadge?: boolean }>(({ theme, $isDonorforestBadge }) => ({
  ...($isDonorforestBadge && {
    background: "white",
    border: `1px solid ${theme.palette.primary.main}`,
    borderRadius: "100%",
  }),
}));

const BadgeIcon = styled("div", {
  shouldForwardProp: (prop) => !String(prop).startsWith("$"),
})<{ $size?: string }>(({ $size }) => ({
  height: $size === "small" ? 15 : $size === "medium" ? 25 : 55,
  width: $size === "small" ? 15 : $size === "medium" ? 25 : 55,
  backgroundRepeat: "no-repeat",
  backgroundPositionY: "center",
  backgroundPositionX: "center",
  backgroundSize: $size === "small" ? 11 : $size === "medium" ? 15 : 48,
}));

type Props = PropsWithChildren<{ className?: string; badge?; size?; contentOnly?: boolean }>;
export default function ProfileBadge({ className, badge, children, size, contentOnly }: Props) {
  // deactivated donorforest badge for now
  // as the donorforest is not up to date
  badge.is_donorforest_badge = false;

  if (contentOnly) {
    return <BadgeContent badge={badge} size={size} className={className} />;
  }

  return (
    <Badge
      classes={{
        badge: className,
      }}
      slotProps={{
        badge: {
          sx: {
            left: size === "small" ? "10%" : size === "medium" ? "10%" : "20%",
            bottom: size === "small" ? "10%" : size === "medium" ? "10%" : "10%",
          },
        },
      }}
      badgeContent={
        <BadgeContent badge={badge} size={size} withLink={badge.is_donorforest_badge} />
      }
      anchorOrigin={{
        horizontal: "left",
        vertical: "bottom",
      }}
      overlap="circular"
    >
      {children}
    </Badge>
  );
}

const BadgeContent = ({ badge, size, className, withLink }: any) => {
  const { locale } = useContext(UserContext);
  const enableDonorforestLinkForNow = false;
  return (
    <Tooltip title={badge.name}>
      <div>
        {/* disabled Link to donorforest for now */}
        {/* eslint-disable-next-line no-constant-condition */}
        {withLink && enableDonorforestLinkForNow ? (
          <Link href={`${getLocalePrefix(locale)}/donorforest`} target="_blank" underline="hover">
            <Content badge={badge} size={size} className={className} />
          </Link>
        ) : (
          <Content badge={badge} size={size} className={className} />
        )}
      </div>
    </Tooltip>
  );
};

const Content = ({ badge, size, className }) => {
  return (
    <BadgeContainer className={className} $isDonorforestBadge={!!badge.is_donorforest_badge}>
      <BadgeIcon $size={size} style={{ backgroundImage: `url(${getImageUrl(badge.image)})` }} />
    </BadgeContainer>
  );
};
