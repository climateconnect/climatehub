import {
  Badge,
  Button,
  Dialog,
  DialogTitle,
  IconButton,
  Theme,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { string, func, bool } from "prop-types";
import React, { PropsWithChildren } from "react";
import theme from "../../themes/theme";

const StyledDialog = styled(Dialog, {
  shouldForwardProp: (p) => typeof p !== "string" || !p.startsWith("$"),
})<{ $fullScreen?: boolean; $topBarFixed?: boolean }>(({ theme, $fullScreen, $topBarFixed }) => ({
  [theme.breakpoints.up("sm")]: {
    padding: $fullScreen ? 0 : theme.spacing(8),
  },
  ...($topBarFixed && { overflow: "hidden" }),
}));

const StyledDialogTitle = styled(DialogTitle)({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
});

const DialogContentArea = styled("div", {
  shouldForwardProp: (p) => typeof p !== "string" || !p.startsWith("$"),
})<{ $fullScreen?: boolean; $topBarFixed?: boolean }>(({ theme, $fullScreen, $topBarFixed }) => ({
  padding: theme.spacing(2),
  // The dynamic JSS rule (height) used to be injected after the static scroll rule, so it won
  height: $fullScreen ? "100%" : "auto",
  ...($topBarFixed && { overflow: "auto" }),
  [theme.breakpoints.down("lg")]: {
    padding: theme.spacing(2),
    paddingTop: 0,
  },
}));

const CloseButtonLeft = styled(IconButton)(({ theme }) => ({
  marginLeft: theme.spacing(-1),
  color: theme.palette.grey[500],
}));

const TitleText = styled(Typography, {
  shouldForwardProp: (p) => typeof p !== "string" || !p.startsWith("$"),
})<{ $closeButtonRightSide?: boolean }>(({ theme, $closeButtonRightSide }) => ({
  marginLeft: $closeButtonRightSide ? theme.spacing(-1) : theme.spacing(1),
  marginRight: $closeButtonRightSide ? theme.spacing(5) : theme.spacing(2),
  fontSize: 20,
  color: theme.palette.text.primary,
  flex: 1,
}));

const ApplyButtonArea = styled("div")({
  marginLeft: "auto",
  flexShrink: 0,
});

const SaveIconButton = styled(IconButton)(({ theme }) => ({
  background: theme.palette.primary.main,
  color: "white",
}));

const BottomButtonContainer = styled("div")(({ theme }) => ({
  textAlign: "center",
  marginBottom: theme.spacing(2),
}));

type Props = PropsWithChildren<{
  activeFilterCount?: number;
  applyText?: string;
  fullScreen?: boolean;
  maxWidth?: "sm" | "lg";
  onApply?: () => void;
  // eslint-disable-next-line no-unused-vars
  onClose: ((arg: false) => void) | (() => void);
  open: boolean;
  title: string;
  topBarFixed?: boolean;
  useApplyButton?: boolean;
  paperClassName?: string;
  closeButtonRightSide?: boolean;
  closeButtonSmall?: boolean;
  titleTextClassName?: string;
  dialogContentClass?: string;
  applyIcon?: any;
  closeButtonRightStyle?: string;
  showApplyAtBottom?: boolean;
  buttonAsLink?: string;
  PaperProps?: any;
}>;

export default function GenericDialog({
  activeFilterCount,
  applyText,
  children,
  fullScreen,
  maxWidth,
  onApply,
  onClose,
  open,
  title,
  topBarFixed,
  useApplyButton,
  paperClassName,
  closeButtonRightSide,
  closeButtonSmall,
  titleTextClassName,
  dialogContentClass,
  applyIcon,
  closeButtonRightStyle,
  showApplyAtBottom,
  buttonAsLink,
  PaperProps,
}: Props) {
  const isSmallScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));

  const handleCancel = () => {
    onClose(false);
  };

  const applyBadgeContent =
    activeFilterCount !== undefined && activeFilterCount > 0 ? activeFilterCount : undefined;

  return (
    <StyledDialog
      $fullScreen={fullScreen}
      $topBarFixed={topBarFixed}
      onClose={handleCancel}
      open={open}
      maxWidth={maxWidth ? maxWidth : "md"}
      fullScreen={fullScreen}
      classes={{
        paper: paperClassName,
      }}
      PaperProps={PaperProps}
      closeAfterTransition={false}
    >
      <StyledDialogTitle>
        {onClose && !closeButtonRightSide && (
          <CloseButtonLeft
            aria-label="close"
            onClick={() => onClose(false)}
            size={closeButtonSmall ? "small" : undefined}
          >
            <CloseIcon />
          </CloseButtonLeft>
        )}
        <TitleText className={titleTextClassName} $closeButtonRightSide={closeButtonRightSide}>
          {title}
        </TitleText>
        {useApplyButton && applyText && !showApplyAtBottom && (
          <ApplyButtonArea>
            {applyIcon && isSmallScreen ? (
              <Badge
                badgeContent={applyBadgeContent}
                color="secondary"
                max={9}
                aria-label={applyBadgeContent ? `${applyBadgeContent} active filters` : undefined}
              >
                <SaveIconButton onClick={onApply} size="large">
                  <applyIcon.icon />
                </SaveIconButton>
              </Badge>
            ) : (
              <Badge
                badgeContent={applyBadgeContent}
                color="secondary"
                max={9}
                aria-label={applyBadgeContent ? `${applyBadgeContent} active filters` : undefined}
              >
                <Button variant="contained" color="primary" onClick={onApply}>
                  {applyText}
                </Button>
              </Badge>
            )}
          </ApplyButtonArea>
        )}
        {onClose && closeButtonRightSide && (
          <IconButton
            aria-label="close"
            className={`classes.closeButtonRight ${closeButtonRightStyle}`}
            onClick={() => onClose(false)}
            size={closeButtonSmall ? "small" : undefined}
          >
            <CloseIcon />
          </IconButton>
        )}
      </StyledDialogTitle>
      <DialogContentArea
        className={dialogContentClass}
        $fullScreen={fullScreen}
        $topBarFixed={topBarFixed}
      >
        {children}
        {useApplyButton && applyText && showApplyAtBottom && (
          <BottomButtonContainer>
            {applyIcon && isSmallScreen ? (
              <SaveIconButton size="large">
                <applyIcon.icon />
              </SaveIconButton>
            ) : buttonAsLink ? (
              <Button variant="contained" color="primary" component="a" href={buttonAsLink}>
                {applyText}
              </Button>
            ) : (
              <Button variant="contained" color="primary" onClick={onApply}>
                {applyText}
              </Button>
            )}
          </BottomButtonContainer>
        )}
      </DialogContentArea>
    </StyledDialog>
  );
}

GenericDialog.propTypes = {
  applyText: string,
  onApply: func,
  onClose: func.isRequired,
  open: bool.isRequired,
  title: string.isRequired,
  useApplyButton: bool,
};
