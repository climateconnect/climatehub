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
import makeStyles from "@mui/styles/makeStyles";
import CloseIcon from "@mui/icons-material/Close";
import { string, func, bool } from "prop-types";
import React, { PropsWithChildren } from "react";
import theme from "../../themes/theme";

const useStyles = makeStyles<
  Theme,
  { fullScreen?: boolean; useApplyButton?: boolean; closeButtonRightSide?: boolean }
>((theme) => ({
  dialog: (props) => ({
    [theme.breakpoints.up("sm")]: {
      padding: props.fullScreen ? 0 : theme.spacing(8),
    },
  }),
  noScrollDialog: {
    overflow: "hidden",
  },
  dialogContent: (props) => ({
    padding: theme.spacing(2),
    height: props.fullScreen ? "100%" : "auto",
    [theme.breakpoints.down("lg")]: {
      padding: theme.spacing(2),
      paddingTop: 0,
    },
  }),
  scrollDialogContent: {
    height: "auto",
    overflow: "auto",
  },
  // MUI's FocusTrap moves focus onto this Paper (tabIndex={-1}) whenever the
  // dialog opens. Chrome shows a focus-visible ring on it when the dialog was
  // opened via a keyboard action (e.g. pasting an image with Ctrl/Cmd+V), so
  // it needs to match the brand color instead of the browser's default blue.
  dialogPaper: {
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  closeButtonLeft: {
    marginLeft: theme.spacing(-1),
    color: theme.palette.grey[500],
  },
  closeButtonRight: {
    color: theme.palette.grey[500],
  },
  titleText: (props) => ({
    marginLeft: props.closeButtonRightSide ? theme.spacing(-1) : theme.spacing(1),
    marginRight: props.closeButtonRightSide ? theme.spacing(5) : theme.spacing(2),
    fontSize: 20,
    color: theme.palette.text.primary,
    flex: 1,
  }),
  dialogTitle: (props) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: props.fullScreen ? "flex-start" : "flex-start",
  }),
  applyButtonArea: {
    marginLeft: "auto",
    flexShrink: 0,
  },
  saveIconButton: {
    background: theme.palette.primary.main,
    color: "white",
  },
  buttomBtnContainer: {
    textAlign: "center",
    marginBottom: theme.spacing(2),
  },
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
  const classes = useStyles({
    useApplyButton,
    fullScreen,
    closeButtonRightSide,
  });

  const isSmallScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));

  const handleCancel = () => {
    onClose(false);
  };

  const applyBadgeContent =
    activeFilterCount !== undefined && activeFilterCount > 0 ? activeFilterCount : undefined;

  return (
    <Dialog
      className={`${classes.dialog} ${topBarFixed && classes.noScrollDialog}`}
      onClose={handleCancel}
      open={open}
      maxWidth={maxWidth ? maxWidth : "md"}
      fullScreen={fullScreen}
      classes={{
        paper: `${classes.dialogPaper} ${paperClassName ?? ""}`.trim(),
      }}
      PaperProps={PaperProps}
      closeAfterTransition={false}
    >
      <DialogTitle className={classes.dialogTitle}>
        {onClose && !closeButtonRightSide && (
          <IconButton
            aria-label="close"
            className={classes.closeButtonLeft}
            onClick={() => onClose(false)}
            size={closeButtonSmall ? "small" : undefined}
          >
            <CloseIcon />
          </IconButton>
        )}
        <Typography className={`${titleTextClassName} ${classes.titleText}`}>{title}</Typography>
        {useApplyButton && applyText && !showApplyAtBottom && (
          <div className={classes.applyButtonArea}>
            {applyIcon && isSmallScreen ? (
              <Badge
                badgeContent={applyBadgeContent}
                color="secondary"
                max={9}
                aria-label={applyBadgeContent ? `${applyBadgeContent} active filters` : undefined}
              >
                <IconButton onClick={onApply} className={classes.saveIconButton} size="large">
                  <applyIcon.icon />
                </IconButton>
              </Badge>
            ) : (
              <Badge
                badgeContent={applyBadgeContent}
                color="secondary"
                max={9}
                aria-label={applyBadgeContent ? `${applyBadgeContent} active filters` : undefined}
              >
                <Button
                  variant="contained"
                  color="primary"
                  className={classes.applyButton}
                  onClick={onApply}
                >
                  {applyText}
                </Button>
              </Badge>
            )}
          </div>
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
      </DialogTitle>
      <div
        className={`${classes.dialogContent} ${
          topBarFixed && classes.scrollDialogContent
        } ${dialogContentClass}`}
      >
        {children}
        {useApplyButton && applyText && showApplyAtBottom && (
          <div className={classes.buttomBtnContainer}>
            {applyIcon && isSmallScreen ? (
              <IconButton className={classes.saveIconButton} size="large">
                <applyIcon.icon />
              </IconButton>
            ) : buttonAsLink ? (
              <Button
                variant="contained"
                color="primary"
                className={classes.applyButton}
                component="a"
                href={buttonAsLink}
              >
                {applyText}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                className={classes.applyButton}
                onClick={onApply}
              >
                {applyText}
              </Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
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
