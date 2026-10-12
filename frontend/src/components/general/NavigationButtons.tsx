import { Button, CircularProgress, Theme, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { MouseEventHandler, useContext, useState } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import ConfirmDialog from "../dialogs/ConfirmDialog";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";

type WrapperProps = { $position?: "top" | "bottom"; $fixedOnMobile?: boolean; $sticky?: boolean };

const NavigationButtonWrapper = styled("div", {
  shouldForwardProp: (prop) =>
    prop !== "$position" && prop !== "$fixedOnMobile" && prop !== "$sticky",
})<WrapperProps>(({ theme, $position, $fixedOnMobile, $sticky }) => {
  // Sticky mode: fixed to the bottom of the viewport at ALL screen sizes
  if ($sticky) {
    return {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      display: "flex",
      flexWrap: "nowrap",
      justifyContent: "flex-end",
      alignItems: "stretch",
      columnGap: theme.spacing(1),
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(1.5),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
      background: theme.palette.background.paper,
      boxShadow: "0px -2px 8px rgba(0,0,0,0.12)",
      zIndex: 1100,
      // On very narrow screens reduce button padding so Draft + Next fit side-by-side
      [theme.breakpoints.down("sm")]: {
        "& .MuiButton-root": {
          paddingLeft: theme.spacing(1),
          paddingRight: theme.spacing(1),
        },
      },
    };
  }
  // Default (non-sticky) mode — unchanged
  return {
    marginTop: $position !== "top" ? theme.spacing(10) : theme.spacing(6),
    marginBottom: $position === "top" ? theme.spacing(4) : 0,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: theme.spacing(2),
    [theme.breakpoints.down("md")]: {
      ...($fixedOnMobile && {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        paddingBottom: theme.spacing(1),
        background: theme.palette.grey.light,
        zIndex: 10,
      }),
      display: "flex",
      justifyContent: "center",
    },
  };
});

const NextStepButtonsContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "$sticky",
})<{ $sticky?: boolean }>(({ theme, $sticky }) => ({
  [theme.breakpoints.down("sm")]: {
    display: "flex",
    justifyContent: "space-between",
  },
  ...($sticky && {
    // Fill remaining space so buttons inside have a real width to share
    flex: 1,
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "stretch",
    justifyContent: "flex-end",
    [theme.breakpoints.down("sm")]: {
      "& .MuiButton-root": {
        flex: 1,
        whiteSpace: "normal",
        maxWidth: 180,
      },
    },
  }),
}));

const PublishButtonOwnLine = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  marginTop: theme.spacing(1),
  marginRight: theme.spacing(2),
}));

const backButtonSx = (theme: Theme) => ({
  color: theme.palette.background.default_contrastText,
});

const draftButtonSx = (theme: Theme) => ({
  marginRight: theme.spacing(2),
});

type Args = {
  className?: string;
  onClickPreviousStep?: MouseEventHandler<HTMLButtonElement>;
  onClickCancel?: Function;
  nextStepButtonType?: "submit" | "save" | "publish";
  onClickNextStep?: MouseEventHandler<HTMLButtonElement>;
  saveAsDraft?: MouseEventHandler<HTMLButtonElement>;
  additionalButtons?: any;
  loadingSubmit?: boolean;
  loadingSubmitDraft?: boolean;
  position?: "top" | "bottom";
  fixedOnMobile?: boolean;
  /** When true the bar is always fixed at the viewport bottom (all screen sizes). */
  sticky?: boolean;
};

export default function NavigationButtons({
  className,
  onClickPreviousStep,
  onClickCancel,
  nextStepButtonType,
  onClickNextStep,
  saveAsDraft,
  additionalButtons,
  loadingSubmit,
  loadingSubmitDraft,
  position,
  fixedOnMobile,
  sticky,
}: Args) {
  const [open, setOpen] = useState(false);
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));
  const isMobileScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });

  const onClickCancelDialogOpen = () => {
    setOpen(true);
  };

  const handleClickCancel = (cancelled) => {
    if (cancelled && onClickCancel) {
      onClickCancel();
      setOpen(false);
    } else setOpen(false);
  };

  const CancelButton = () => (
    <>
      <Button
        variant="contained"
        color="grey"
        onClick={onClickCancelDialogOpen}
        sx={(theme) => ({ ...backButtonSx(theme), ...draftButtonSx(theme) })}
      >
        {position === "top" || (isNarrowScreen && fixedOnMobile) ? <ArrowBackIcon /> : texts.cancel}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={handleClickCancel}
        cancelText={texts.no}
        confirmText={texts.yes}
        text={texts.do_you_really_want_to_leave_without_saving_your_changes}
        title={texts.leave_without_saving_changes}
      />
    </>
  );

  return (
    <NavigationButtonWrapper
      className={className}
      $position={position}
      $fixedOnMobile={fixedOnMobile}
      $sticky={sticky}
    >
      {onClickPreviousStep && (
        <Button
          variant="contained"
          color="grey"
          sx={(theme) => ({
            ...backButtonSx(theme),
            ...(sticky && { marginRight: "auto", flexShrink: 0 }),
          })}
          onClick={onClickPreviousStep}
          aria-label={sticky && isMobileScreen ? texts.back : undefined}
        >
          {sticky && isMobileScreen ? <ArrowBackIcon /> : texts.back}
        </Button>
      )}
      {position === "top" && onClickCancel && <CancelButton />}
      <NextStepButtonsContainer $sticky={sticky}>
        {onClickCancel && position !== "top" && <CancelButton />}
        {additionalButtons &&
          additionalButtons.map((b, index) => (
            <Button
              key={index}
              variant="contained"
              color={(b.color as any) || "grey"}
              onClick={b.onClick}
              aria-label={fixedOnMobile && isNarrowScreen ? b.ariaLabel : undefined}
              sx={(theme) => ({ ...(!b.color && backButtonSx(theme)), ...draftButtonSx(theme) })}
            >
              {fixedOnMobile && isNarrowScreen ? <b.icon /> : b.text}
            </Button>
          ))}
        {saveAsDraft && (
          <Button
            variant="contained"
            color="grey"
            onClick={saveAsDraft}
            sx={(theme) => ({ ...backButtonSx(theme), ...draftButtonSx(theme) })}
            disabled={loadingSubmitDraft || loadingSubmit}
          >
            {loadingSubmitDraft ? (
              <CircularProgress sx={{ color: "white" }} size={23} />
            ) : (
              texts.save_as_draft
            )}
          </Button>
        )}
        {!(fixedOnMobile && isMobileScreen && onClickCancel && additionalButtons.length > 1) && (
          <NextButtons
            nextStepButtonType={nextStepButtonType}
            onClickNextStep={onClickNextStep}
            texts={texts}
            loadingSubmit={loadingSubmit}
            loadingSubmitDraft={loadingSubmitDraft}
            fixedOnMobile={fixedOnMobile}
            isNarrowScreen={isNarrowScreen}
          />
        )}
      </NextStepButtonsContainer>
      {fixedOnMobile && isMobileScreen && onClickCancel && additionalButtons.length > 1 && (
        <PublishButtonOwnLine>
          <NextButtons
            nextStepButtonType={nextStepButtonType}
            onClickNextStep={onClickNextStep}
            texts={texts}
            loadingSubmit={loadingSubmit}
            loadingSubmitDraft={loadingSubmitDraft}
            fixedOnMobile={fixedOnMobile}
            isNarrowScreen={isNarrowScreen}
          />
        </PublishButtonOwnLine>
      )}
    </NavigationButtonWrapper>
  );
}

function NextButtons({
  nextStepButtonType,
  onClickNextStep,
  texts,
  loadingSubmit,
  loadingSubmitDraft,
  fixedOnMobile,
  isNarrowScreen,
}) {
  if (nextStepButtonType === "submit")
    return (
      <Button variant="contained" color="primary" type="submit">
        {texts.next_step}
      </Button>
    );
  else if (nextStepButtonType === "save")
    return (
      <Button variant="contained" color="primary" type="submit">
        {fixedOnMobile && isNarrowScreen ? <SaveIcon /> : texts.save_changes}
      </Button>
    );
  else if (nextStepButtonType === "publish")
    return (
      <Button
        variant="contained"
        color="primary"
        type="submit"
        disabled={loadingSubmit || loadingSubmitDraft}
      >
        {loadingSubmit ? <CircularProgress sx={{ color: "white" }} size={23} /> : texts.publish}
      </Button>
    );
  else
    return (
      <Button variant="contained" color="primary" type="submit" onClick={onClickNextStep}>
        {texts.next_step}
      </Button>
    );
}
